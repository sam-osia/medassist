"""Main orchestrator with dynamic agent routing for workflow generation."""

import json
from pathlib import Path
from typing import Dict, Any, Optional

from core.llm_provider import call
from core.workflow.schemas.plan_schema import Plan as Workflow

from .state import WorkflowAgentState
from .schemas.orchestrator_schemas import OrchestratorDecision
from .schemas.agent_schemas import (
    GeneratorInput,
    EditorInput,
    ChunkOperatorInput,
    ValidatorInput,
    PromptFillerInput,
    SummarizerInput,
    ClarifierInput,
)
from .agents import (
    GeneratorAgent,
    EditorAgent,
    ChunkOperatorAgent,
    ValidatorAgent,
    PromptFillerAgent,
    SummarizerAgent,
    ClarifierAgent,
)
from .utils.tool_specs import get_tool_specs_for_agents


class WorkflowOrchestrator:
    """
    Main orchestrator that dynamically routes between agents based on LLM decisions.
    Processes user messages and returns structured responses.
    """

    def __init__(self, dataset: str = None):
        self.dataset = dataset
        self.agents = {
            "generator": GeneratorAgent(dataset),
            "editor": EditorAgent(dataset),
            "chunk_operator": ChunkOperatorAgent(dataset),
            "validator": ValidatorAgent(),
            "prompt_filler": PromptFillerAgent(dataset),
            "summarizer": SummarizerAgent(),
            "clarifier": ClarifierAgent(),
        }
        self.tool_specs = get_tool_specs_for_agents(dataset)
        self._prompt = self._load_prompt()
        self._prompt_guides = self._get_prompt_guides()

    def _load_prompt(self) -> str:
        """Load orchestrator prompt from file."""
        prompt_path = Path(__file__).parent / "prompts" / "orchestrator_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_prompt()

    def _default_prompt(self) -> str:
        return """You are a workflow orchestrator. Your job is to decide which agent to call next
based on the current state and user request.

AVAILABLE AGENTS:
- clarifier: Asks clarifying questions when request is ambiguous
- generator: Creates new workflows from scratch
- editor: Modifies existing workflows
- chunk_operator: Performs insert/append/remove operations on workflows
- validator: Validates workflow correctness
- prompt_filler: Fills in prompt fields for tools that need them
- summarizer: Generates human-readable summaries

RECOMMENDED FLOWS:
1. New workflow: clarifier → generator → validator → prompt_filler → validator → summarizer → respond
2. Edit workflow: editor → validator → prompt_filler (if needed) → validator → summarizer → respond
3. Insert/append/remove: chunk_operator → validator → prompt_filler → validator → summarizer → respond

DECISION MAKING:
- Look at last_agent_result to understand what just happened
- If validation failed, you may need to retry or report to user
- If clarifier has questions, respond to user with them
- When workflow is ready and summarized, respond to user with include_workflow=true

Always provide agent_task with clear instructions for the agent you're calling."""

    def _get_prompt_guides(self) -> Dict[str, str]:
        """Get prompt guides for tools that need prompts."""
        # Simple hardcoded guides for now
        return {
            "highlight_patient_note": "Generate prompts to highlight specific information in clinical notes.",
            "analyze_note_with_span_and_reason": "Generate prompts to analyze notes and provide explanations with spans.",
            "summarize_note": "Generate prompts to summarize clinical notes.",
        }

    def process_message(self, user_message: str, state: WorkflowAgentState) -> Dict[str, Any]:
        """
        Main entry point. Processes user message through dynamic agent routing.

        Returns:
            {
                "response_type": "text" | "workflow",
                "text": str,
                "workflow": Workflow | None,
                "summary": str | None
            }
        """
        state.add_user_message(user_message)

        max_iterations = 20  # Safety limit
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            # Ask orchestrator LLM what to do next
            decision = self._get_orchestrator_decision(state, user_message)

            if decision.action == "respond_to_user":
                return self._build_response(decision, state)

            # Call the appropriate agent
            agent_result = self._call_agent(decision, state)

            # Update state with result
            state.last_agent = decision.action.replace("call_", "")
            state.last_agent_result = agent_result

            # Handle specific agent results
            self._process_agent_result(decision.action, agent_result, state)

        # Max iterations reached
        return {
            "response_type": "text",
            "text": "I was unable to complete the workflow generation. Please try again.",
            "workflow": None,
            "summary": None
        }

    def _get_orchestrator_decision(
        self,
        state: WorkflowAgentState,
        user_message: str
    ) -> OrchestratorDecision:
        """Call orchestrator LLM to decide next action."""

        # Build context
        context_parts = [f"USER MESSAGE: {user_message}"]

        # Current workflow
        current_wf = state.get_current_workflow()
        if current_wf:
            context_parts.append(f"CURRENT WORKFLOW EXISTS: Yes (ID: {state.current_workflow_id})")
        else:
            context_parts.append("CURRENT WORKFLOW EXISTS: No")

        # Pending workflow
        if state.pending_workflow:
            context_parts.append("PENDING WORKFLOW: Yes (being built/modified)")

        # Last agent result
        if state.last_agent:
            result_str = self._format_agent_result(state.last_agent, state.last_agent_result)
            context_parts.append(f"LAST AGENT: {state.last_agent}")
            context_parts.append(f"LAST RESULT: {result_str}")

        # Pending summary
        if state.pending_summary:
            context_parts.append(f"PENDING SUMMARY: {state.pending_summary}")

        context = "\n\n".join(context_parts)

        system_prompt = f"""{self._prompt}

CURRENT CONTEXT:
{context}

Decide what to do next. If the workflow is ready and summarized, respond to user."""

        messages = [{"role": "user", "content": "What should we do next?"}]

        result = call(
            model="gpt-4o",
            messages=messages,
            system=system_prompt,
            schema=OrchestratorDecision,
            temperature=0.5,
        )

        if result.parsed:
            return result.parsed

        # Fallback: respond to user
        return OrchestratorDecision(
            action="respond_to_user",
            response_text="I encountered an issue deciding the next step. Please try again."
        )

    def _format_agent_result(self, agent_name: str, result: Any) -> str:
        """Format agent result for context."""
        if result is None:
            return "No result"

        if hasattr(result, 'model_dump'):
            data = result.model_dump()
            # Keep it concise
            if 'workflow' in data:
                data['workflow'] = "[Workflow object]" if data['workflow'] else None
            return json.dumps(data, default=str)

        return str(result)

    def _call_agent(self, decision: OrchestratorDecision, state: WorkflowAgentState) -> Any:
        """Route to appropriate agent based on decision."""
        action = decision.action

        if action == "call_clarifier":
            inputs = ClarifierInput(
                user_request=decision.agent_task or state.conversation[-1].content,
                tool_specs=self.tool_specs,
                current_workflow=state.get_current_workflow()
            )
            return self.agents["clarifier"].run(inputs)

        elif action == "call_generator":
            inputs = GeneratorInput(
                task_description=decision.agent_task or state.conversation[-1].content,
                tool_specs=self.tool_specs,
                patient_context={"mrn": state.mrn, "csn": state.csn}
            )
            return self.agents["generator"].run(inputs)

        elif action == "call_editor":
            current = state.pending_workflow or state.get_current_workflow()
            if not current:
                return {"success": False, "error_message": "No workflow to edit"}

            inputs = EditorInput(
                current_workflow=current,
                edit_request=decision.agent_task or "",
                tool_specs=self.tool_specs
            )
            return self.agents["editor"].run(inputs)

        elif action == "call_chunk_operator":
            current = state.pending_workflow or state.get_current_workflow()
            if not current:
                return {"success": False, "error_message": "No workflow for chunk operation"}

            inputs = ChunkOperatorInput(
                current_workflow=current,
                operation=decision.chunk_operation or "append",
                description=decision.agent_task or "",
                tool_specs=self.tool_specs
            )
            return self.agents["chunk_operator"].run(inputs)

        elif action == "call_validator":
            workflow = state.pending_workflow or state.get_current_workflow()
            if not workflow:
                return {"valid": False, "broken_reason": "No workflow to validate"}

            inputs = ValidatorInput(workflow=workflow)
            return self.agents["validator"].run(inputs)

        elif action == "call_prompt_filler":
            workflow = state.pending_workflow or state.get_current_workflow()
            if not workflow:
                return {"success": False, "error_message": "No workflow for prompt filling"}

            # Get user intent from conversation
            user_intent = state.conversation[-1].content if state.conversation else ""

            inputs = PromptFillerInput(
                workflow=workflow,
                user_intent=user_intent,
                prompt_guides=self._prompt_guides
            )
            return self.agents["prompt_filler"].run(inputs)

        elif action == "call_summarizer":
            workflow = state.pending_workflow or state.get_current_workflow()
            if not workflow:
                return {"summary": "No workflow to summarize."}

            inputs = SummarizerInput(workflow=workflow)
            return self.agents["summarizer"].run(inputs)

        return None

    def _process_agent_result(self, action: str, result: Any, state: WorkflowAgentState):
        """Update state based on agent result."""

        if action in ("call_generator", "call_editor", "call_chunk_operator"):
            # These agents produce workflows
            if hasattr(result, 'success') and result.success and hasattr(result, 'workflow'):
                state.pending_workflow = result.workflow

        elif action == "call_prompt_filler":
            # Prompt filler updates the workflow
            if hasattr(result, 'success') and result.success and hasattr(result, 'workflow'):
                state.pending_workflow = result.workflow

        elif action == "call_summarizer":
            # Store the summary
            if hasattr(result, 'summary'):
                state.pending_summary = result.summary

    def _build_response(
        self,
        decision: OrchestratorDecision,
        state: WorkflowAgentState
    ) -> Dict[str, Any]:
        """Build final response for user."""

        response_text = decision.response_text or ""
        workflow = None
        summary = None

        if decision.include_workflow and state.pending_workflow:
            # Commit pending workflow
            workflow_id = state.add_workflow(state.pending_workflow)
            workflow = state.pending_workflow
            summary = state.pending_summary

            # Clear pending state
            state.clear_pending()

            # Add to conversation
            state.add_assistant_message(response_text, workflow_ref=workflow_id)

            return {
                "response_type": "workflow",
                "text": response_text,
                "workflow": workflow,
                "summary": summary,
                "workflow_id": workflow_id
            }
        else:
            # Text-only response
            state.add_assistant_message(response_text)

            return {
                "response_type": "text",
                "text": response_text,
                "workflow": None,
                "summary": None
            }
