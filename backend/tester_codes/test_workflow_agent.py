"""Tests for the workflow agent system."""

import sys
sys.path.insert(0, '/home/saman/medassist/backend')

from core.workflow.orchestrator import WorkflowOrchestrator
from core.workflow.state import WorkflowAgentState
from core.workflow.schemas.orchestrator_schemas import OrchestratorDecision
from core.workflow.schemas.agent_schemas import (
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
    OutputDefinitionInput,
    OutputDefinitionOutput,
)
from core.workflow.schemas.output_schemas import (
    OutputDefinitionSpec,
    OutputMapping,
    FieldSpec,
    DirectEvidenceSchema,
    AggregatedEvidenceSchema,
    EvidenceSource,
    EvidenceSourceMapping,
    FieldBinding,
    ValueSource,
)
from core.workflow.agents import (
    GeneratorAgent,
    EditorAgent,
    ChunkOperatorAgent,
    ValidatorAgent,
    PromptFillerAgent,
    SummarizerAgent,
    ClarifierAgent,
    OutputDefinitionAgent,
)
from core.workflow.utils.tool_specs import get_tool_specs_for_agents
from core.workflow.schemas.workflow_schema import (
    Workflow,
    ToolStep,
    LoopStep,
)
from core.workflow.schemas.trace_events import DecisionEvent, AgentResultEvent, FinalEvent


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
    from core.workflow.schemas.tool_inputs import (
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

    from core.workflow.schemas.tool_inputs import (
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
    assert len(orchestrator.agents) == 7  # clarifier is currently disabled, output_definition added
    assert "generator" in orchestrator.agents
    assert "editor" in orchestrator.agents
    assert "validator" in orchestrator.agents
    assert "output_definition" in orchestrator.agents
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

    from core.workflow.schemas.tool_inputs import (
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


def test_output_definition_schema():
    """Test output definition schema validation."""
    direct_def = OutputDefinitionSpec(
        id="def_depression",
        name="depression_indicator",
        label="Depression Indicator",
        output_type="direct",
        output_fields=[
            FieldSpec(name="detected", type="boolean"),
            FieldSpec(name="reasoning", type="text"),
        ],
        evidence_schema=DirectEvidenceSchema(
            resource_type="note",
            fields=[FieldSpec(name="span", type="text")]
        )
    )
    assert direct_def.id == "def_depression"
    assert len(direct_def.output_fields) == 2
    print("✓ Direct output definition schema test passed")


def test_aggregated_output_definition_schema():
    """Test aggregated output definition schema."""
    agg_def = OutputDefinitionSpec(
        id="def_adverse_reaction",
        name="adverse_reaction",
        label="Adverse Reaction",
        output_type="aggregated",
        output_fields=[
            FieldSpec(name="detected", type="boolean"),
            FieldSpec(name="reasoning", type="text"),
        ],
        evidence_schema=AggregatedEvidenceSchema(
            sources=[
                EvidenceSource(resource_type="medication", role="trigger", fields=[]),
                EvidenceSource(resource_type="note", role="source", fields=[
                    FieldSpec(name="span", type="text")
                ]),
            ]
        )
    )
    assert agg_def.output_type == "aggregated"
    assert len(agg_def.evidence_schema.sources) == 2
    print("✓ Aggregated output definition schema test passed")


def test_output_mapping_schema():
    """Test output mapping schema."""
    mapping = OutputMapping(
        output_definition_id="def_depression",
        value_sources=[
            ValueSource(output_field="detected", variable_path="analysis_result.flag_state"),
            ValueSource(output_field="reasoning", variable_path="analysis_result.reasoning"),
        ],
        evidence_sources=[
            EvidenceSourceMapping(
                step_id="analyze_step",
                resource_type="note",
                role="source",
                field_bindings=[FieldBinding(field_name="span", variable_path="analysis_result.span")]
            )
        ]
    )
    assert mapping.output_definition_id == "def_depression"
    assert len(mapping.value_sources) == 2
    print("✓ Output mapping schema test passed")


def test_plan_with_output_definitions():
    """Test Plan schema accepts output definitions."""
    from core.workflow.schemas.tool_inputs import GetPatientNotesIdsInput

    workflow = Workflow(
        steps=[
            ToolStep(
                id="get_notes",
                step_summary="Get note IDs",
                type="tool",
                tool="get_patient_notes_ids",
                inputs=GetPatientNotesIdsInput(mrn=1, csn=1),
                output="note_ids"
            )
        ],
        output_definitions=[
            OutputDefinitionSpec(
                id="def_test",
                name="test_output",
                label="Test Output",
                output_fields=[FieldSpec(name="detected", type="boolean")],
                evidence_schema=DirectEvidenceSchema(resource_type="note")
            )
        ],
        output_mappings=[
            OutputMapping(
                output_definition_id="def_test",
                value_sources=[ValueSource(output_field="detected", variable_path="note_ids.flag")]
            )
        ]
    )

    assert len(workflow.output_definitions) == 1
    assert len(workflow.output_mappings) == 1
    print("✓ Plan with output definitions test passed")


def test_validator_skips_output_validation():
    """Test validator currently skips output validation (always passes)."""
    validator = ValidatorAgent()

    from core.workflow.schemas.tool_inputs import GetPatientNotesIdsInput

    # Even with invalid output mappings, validator should pass
    workflow = Workflow(
        steps=[
            ToolStep(
                id="step1",
                step_summary="Get notes",
                type="tool",
                tool="get_patient_notes_ids",
                inputs=GetPatientNotesIdsInput(mrn=1, csn=1),
                output="note_ids"
            )
        ],
        output_definitions=[
            OutputDefinitionSpec(
                id="def_test",
                name="test",
                label="Test",
                output_fields=[FieldSpec(name="value", type="text")],
                evidence_schema=DirectEvidenceSchema(resource_type="note")
            )
        ],
        output_mappings=[
            OutputMapping(
                output_definition_id="def_test",
                value_sources=[ValueSource(output_field="value", variable_path="undefined_var.something")]
            )
        ]
    )

    result = validator.run(ValidatorInput(workflow=workflow))
    # Output validation is currently skipped, so this should pass
    assert result.valid
    print("✓ Validator skips output validation test passed")


def test_output_definition_agent(run_llm: bool = False):
    """Test output definition agent generates definitions."""
    if not run_llm:
        print("⏭ Output definition agent test skipped (set run_llm=True)")
        return

    from core.workflow.schemas.tool_inputs import GetPatientNotesIdsInput, AnalyzeNoteWithSpanAndReasonInput

    agent = OutputDefinitionAgent()

    workflow = Workflow(
        steps=[
            ToolStep(
                id="get_notes",
                step_summary="Get note IDs",
                type="tool",
                tool="get_patient_notes_ids",
                inputs=GetPatientNotesIdsInput(mrn=1, csn=1),
                output="note_ids"
            ),
            LoopStep(
                id="loop_notes",
                step_summary="Analyze each note",
                type="loop",
                **{"for": "note_id", "in": "note_ids"},
                body=[
                    ToolStep(
                        id="analyze",
                        step_summary="Analyze for depression",
                        type="tool",
                        tool="analyze_note_with_span_and_reason",
                        inputs=AnalyzeNoteWithSpanAndReasonInput(note="{{ note_content }}", prompt=None),
                        output="analysis_result"
                    )
                ]
            )
        ]
    )

    result = agent.run(OutputDefinitionInput(
        workflow=workflow,
        user_intent="Analyze notes for signs of depression"
    ))

    assert result.success
    assert result.workflow is not None
    assert len(result.workflow.output_definitions) > 0
    print(f"✓ Output definition agent test passed - generated {len(result.workflow.output_definitions)} definitions")


def test_full_create_workflow_flow(run_llm: bool = False):
    """Test complete flow: user asks to create workflow with streaming trace."""
    if not run_llm:
        print("⏭ Full create workflow test skipped (set run_llm=True to run)")
        return

    orchestrator = WorkflowOrchestrator()
    state = WorkflowAgentState(mrn=12345, csn=67890)

    user_message = (
        "read every patient note. For each note, "
        "analyze for signs of depression with a span and reasoning. "
        "If they show signs of depression, summarize its reasoning"
    )

    print(f"\n{'='*60}")
    print(f"USER: {user_message}")
    print(f"{'='*60}\n")

    result = None
    for event in orchestrator.process_message_streaming(user_message, state):
        if isinstance(event, DecisionEvent):
            print(f"[DECISION] {event.action}")
            if event.reasoning:
                print(f"  Reasoning: {event.reasoning}")
            if event.agent_task:
                task_preview = event.agent_task[:80] + "..." if len(event.agent_task) > 80 else event.agent_task
                print(f"  Task: {task_preview}")
            print()

        elif isinstance(event, AgentResultEvent):
            status = "SUCCESS" if event.success else "FAILED"
            print(f"[AGENT RESULT] {event.agent}: {status}")
            print(f"  Summary: {event.summary}")
            print(f"  Duration: {event.duration_ms}ms")
            print()

        elif isinstance(event, FinalEvent):
            result = event.result
            print(f"[FINAL] Response ready")
            print()

    assert result is not None
    assert result["response_type"] in ("text", "workflow")
    if result["response_type"] == "workflow":
        assert result["workflow"] is not None
        assert result["summary"] is not None

    print(f"{'='*60}")
    print("✓ Full create workflow flow test passed")
    print(f"  Response type: {result['response_type']}")
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

    # Output definition tests (no LLM)
    test_output_definition_schema()
    test_aggregated_output_definition_schema()
    test_output_mapping_schema()
    test_plan_with_output_definitions()
    test_validator_skips_output_validation()

    # LLM-based tests (optional)
    test_generator_agent(run_llm=args.run_llm)
    test_summarizer_agent(run_llm=args.run_llm)
    test_output_definition_agent(run_llm=args.run_llm)
    test_full_create_workflow_flow(run_llm=args.run_llm)

    print("\n✅ All tests completed!")
