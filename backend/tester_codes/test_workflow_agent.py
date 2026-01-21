"""Tests for the workflow agent system."""

import sys
sys.path.insert(0, '/home/saman/medassist/backend')

from core.llm_lib.supervisor_worker_network.workflow_agent import (
    WorkflowOrchestrator,
    WorkflowAgentState,
)
from core.llm_lib.supervisor_worker_network.workflow_agent.schemas import (
    OrchestratorDecision,
    GeneratorInput,
    GeneratorOutput,
    EditorInput,
    EditorOutput,
    ChunkOperatorInput,
    ChunkOperatorOutput,
    ValidatorInput,
    ValidatorOutput,
    PromptFillerInput,
    PromptFillerOutput,
    SummarizerInput,
    SummarizerOutput,
    ClarifierInput,
    ClarifierOutput,
)
from core.llm_lib.supervisor_worker_network.workflow_agent.agents import (
    GeneratorAgent,
    EditorAgent,
    ChunkOperatorAgent,
    ValidatorAgent,
    PromptFillerAgent,
    SummarizerAgent,
    ClarifierAgent,
)
from core.llm_lib.supervisor_worker_network.workflow_agent.utils.tool_specs import (
    get_tool_specs_for_agents,
)
from core.llm_lib.supervisor_worker_network.schemas.plan_schema import (
    Plan as Workflow,
    ToolStep,
    LoopStep,
)


def test_state_management():
    """Test state properly tracks workflow versions and conversation."""
    state = WorkflowAgentState(mrn=12345, csn=67890)

    # Test conversation tracking
    state.add_user_message("Create a workflow")
    state.add_assistant_message("Here's your workflow", workflow_ref="workflow_v1")

    assert len(state.conversation) == 2
    assert state.conversation[0].role == "user"
    assert state.conversation[1].role == "assistant"
    assert state.conversation[1].workflow_ref == "workflow_v1"

    print("✓ State management test passed")


def test_tool_specs():
    """Test tool specs generation."""
    specs = get_tool_specs_for_agents()

    assert "get_patient_notes_ids" in specs
    assert "read_patient_note" in specs
    assert "summarize_patient_note" in specs

    # Check structure
    for name, spec in specs.items():
        assert "description" in spec
        assert "parameters" in spec
        assert "returns" in spec

    print(f"✓ Tool specs test passed ({len(specs)} tools)")


def test_validator_catches_undefined_variable():
    """Test validator catches variable used before definition."""
    validator = ValidatorAgent()

    # Create workflow with undefined variable reference
    workflow = Workflow(steps=[
        LoopStep(
            id="loop1",
            step_summary="Loop over undefined variable",
            type="loop",
            **{"for": "note_id", "in": "undefined_var"},
            body=[]
        )
    ])

    result = validator.run(ValidatorInput(workflow=workflow))

    assert not result.valid
    assert "undefined" in result.broken_reason.lower()
    print("✓ Validator undefined variable test passed")


def test_validator_catches_duplicate_id():
    """Test validator catches duplicate step IDs."""
    validator = ValidatorAgent()

    # Create workflow with duplicate step IDs
    from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
        GetPatientNotesIdsInput,
        ReadPatientNoteInput,
    )

    workflow = Workflow(steps=[
        ToolStep(
            id="step1",
            step_summary="Get notes",
            type="tool",
            tool="get_patient_notes_ids",
            inputs=GetPatientNotesIdsInput(mrn=1, csn=1),
            output="notes1"
        ),
        ToolStep(
            id="step1",  # Duplicate!
            step_summary="Read note",
            type="tool",
            tool="read_patient_note",
            inputs=ReadPatientNoteInput(mrn=1, csn=1, note_id=1),
            output="note"
        )
    ])

    result = validator.run(ValidatorInput(workflow=workflow))

    assert not result.valid
    assert "duplicate" in result.broken_reason.lower()
    print("✓ Validator duplicate ID test passed")


def test_valid_workflow_passes_validation():
    """Test that a valid workflow passes validation."""
    validator = ValidatorAgent()

    from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
        GetPatientNotesIdsInput,
        ReadPatientNoteInput,
    )

    workflow = Workflow(steps=[
        ToolStep(
            id="get_notes",
            step_summary="Get all note IDs",
            type="tool",
            tool="get_patient_notes_ids",
            inputs=GetPatientNotesIdsInput(mrn=1, csn=1),
            output="note_ids"
        ),
        LoopStep(
            id="loop_notes",
            step_summary="Loop through notes",
            type="loop",
            **{"for": "note_id", "in": "note_ids"},
            body=[
                ToolStep(
                    id="read_note",
                    step_summary="Read each note",
                    type="tool",
                    tool="read_patient_note",
                    inputs=ReadPatientNoteInput(mrn=1, csn=1, note_id="{{ note_id }}"),
                    output="note_content"
                )
            ]
        )
    ])

    result = validator.run(ValidatorInput(workflow=workflow))

    assert result.valid
    print("✓ Valid workflow passes validation")


def test_orchestrator_initialization():
    """Test orchestrator initializes correctly."""
    orchestrator = WorkflowOrchestrator()

    assert orchestrator.agents is not None
    assert len(orchestrator.agents) == 7
    assert "generator" in orchestrator.agents
    assert "editor" in orchestrator.agents
    assert "validator" in orchestrator.agents
    assert orchestrator.tool_specs is not None

    print("✓ Orchestrator initialization test passed")


def test_generator_agent(run_llm: bool = False):
    """Test generator creates workflow skeleton (optionally with LLM)."""
    if not run_llm:
        print("⏭ Generator agent test skipped (set run_llm=True to run)")
        return

    generator = GeneratorAgent()
    tool_specs = get_tool_specs_for_agents()

    inputs = GeneratorInput(
        task_description="Get all patient notes and summarize each one",
        tool_specs=tool_specs,
        patient_context={"mrn": 12345, "csn": 67890}
    )

    result = generator.run(inputs)

    assert result.success
    assert result.workflow is not None
    assert len(result.workflow.steps) > 0

    print("✓ Generator agent test passed")


def test_summarizer_agent(run_llm: bool = False):
    """Test summarizer generates summary (optionally with LLM)."""
    if not run_llm:
        print("⏭ Summarizer agent test skipped (set run_llm=True to run)")
        return

    from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
        GetPatientNotesIdsInput,
    )

    summarizer = SummarizerAgent()

    workflow = Workflow(steps=[
        ToolStep(
            id="get_notes",
            step_summary="Get all note IDs for patient",
            type="tool",
            tool="get_patient_notes_ids",
            inputs=GetPatientNotesIdsInput(mrn=1, csn=1),
            output="note_ids"
        )
    ])

    result = summarizer.run(SummarizerInput(workflow=workflow))

    assert result.summary
    assert len(result.summary) > 10

    print(f"✓ Summarizer test passed: {result.summary[:100]}...")


def test_full_create_workflow_flow(run_llm: bool = False):
    """Test complete flow: user asks to create workflow."""
    if not run_llm:
        print("⏭ Full create workflow test skipped (set run_llm=True to run)")
        return

    orchestrator = WorkflowOrchestrator()
    state = WorkflowAgentState(mrn=12345, csn=67890)

    result = orchestrator.process_message(
        "Create a workflow to get all patient notes and summarize each one",
        state
    )

    assert result["response_type"] in ("text", "workflow")
    if result["response_type"] == "workflow":
        assert result["workflow"] is not None
        assert result["summary"] is not None

    print("✓ Full create workflow flow test passed")
    print(f"  Response: {result['text'][:200] if result['text'] else 'No text'}...")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--run-llm", action="store_true", help="Run tests that make LLM calls")
    args = parser.parse_args()

    print("Running workflow agent tests...\n")

    # Unit tests (no LLM calls)
    test_state_management()
    test_tool_specs()
    test_validator_catches_undefined_variable()
    test_validator_catches_duplicate_id()
    test_valid_workflow_passes_validation()
    test_orchestrator_initialization()

    # LLM-based tests (optional)
    test_generator_agent(run_llm=args.run_llm)
    test_summarizer_agent(run_llm=args.run_llm)
    test_full_create_workflow_flow(run_llm=args.run_llm)

    print("\n✅ All tests completed!")
