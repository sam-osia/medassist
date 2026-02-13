"""Main orchestrator with dynamic agent routing for workflow generation."""

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Generator, Optional, Tuple

from pydantic import BaseModel

from core.llm_provider import call

logger = logging.getLogger("workflow.orchestrator")
from core.workflow.schemas.workflow_schema import Workflow

from .state import WorkflowAgentState
from .schemas.orchestrator_schemas import OrchestratorDecision
from .schemas.trace_events import DecisionEvent, AgentResultEvent, FinalEvent, TraceEvent
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
from .utils.output_utils import derive_output_definitions
from .trace_recorder import TraceRecorder


class WorkflowOrchestrator:
    """
    Main orchestrator that dynamically routes between agents based on LLM decisions.
    Processes user messages and returns structured responses.
    """

    def __init__(self, dataset: str = None, key_name: str = None):
        self.dataset = dataset
        self.key_name = key_name
        self.agents = {
            "generator": GeneratorAgent(dataset, key_name=key_name),
            "editor": EditorAgent(dataset, key_name=key_name),
            "chunk_operator": ChunkOperatorAgent(dataset, key_name=key_name),
            "validator": ValidatorAgent(),
            "prompt_filler": PromptFillerAgent(dataset, key_name=key_name),
            "summarizer": SummarizerAgent(key_name=key_name),
            # "clarifier": ClarifierAgent(key_name=key_name),
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
            "analyze_note_with_span_and_reason": "Generate prompts to analyze notes and provide explanations with spans.",
            "summarize_note": "Generate prompts to summarize clinical notes.",
        }

    def process_message(self, user_message: str, state: WorkflowAgentState) -> Dict[str, Any]:
        """
        Sync wrapper for process_message_streaming.
        Consumes the generator and returns the final result.

        Returns:
            {
                "response_type": "text" | "workflow",
                "text": str,
                "workflow": Workflow | None,
                "summary": str | None
            }
        """
        result = None
        for event in self.process_message_streaming(user_message, state):
            if event.type == "final":
                result = event.result
        return result

    def process_message_streaming(
        self,
        user_message: str,
        state: WorkflowAgentState,
        trace_recorder: Optional[TraceRecorder] = None
    ) -> Generator[TraceEvent, None, None]:
        """
        Streaming entry point. Processes user message and yields trace events.

        Args:
            user_message: The user's message
            state: The workflow agent state
            trace_recorder: Optional recorder for detailed tracing

        Yields:
            DecisionEvent - when orchestrator decides next action
            AgentResultEvent - after each agent completes
            FinalEvent - when ready to respond to user
        """
        logger.info(f"[orchestrator] processing: {user_message[:80]}...")
        state.add_user_message(user_message)
        state.agent_call_log = []  # Clear log at start of new message

        # Record turn start and initial state if tracing
        if trace_recorder:
            trace_recorder.record_turn_start(user_message)
            trace_recorder.record_initial_state(state)

        # Track running cost totals
        total_cost = 0.0
        total_input_tokens = 0
        total_output_tokens = 0

        max_iterations = 20  # Safety limit
        iteration = 0

        try:
            while iteration < max_iterations:
                iteration += 1

                # Ask orchestrator LLM what to do next
                decision, context, system_prompt, decision_cost, decision_input_tokens, decision_output_tokens = self._get_orchestrator_decision(state, user_message)
                total_cost += decision_cost
                total_input_tokens += decision_input_tokens
                total_output_tokens += decision_output_tokens

                # Record decision if tracing
                if trace_recorder:
                    trace_recorder.record_decision(
                        orchestrator_context=context,
                        decision=decision,
                        cost=decision_cost,
                        input_tokens=decision_input_tokens,
                        output_tokens=decision_output_tokens,
                        system_prompt=system_prompt
                    )

                # Yield decision event
                yield DecisionEvent(
                    action=decision.action,
                    agent_task=decision.agent_task,
                    reasoning=decision.reasoning,
                    timestamp=datetime.now()
                )

                if decision.action == "respond_to_user":
                    result = self._build_response(decision, state, total_cost, total_input_tokens, total_output_tokens)

                    # Record final state and finalize trace
                    if trace_recorder:
                        trace_recorder.record_state_snapshot(state, trigger="final")
                        trace_recorder.finalize(total_cost, total_input_tokens, total_output_tokens)

                    yield FinalEvent(result=result, timestamp=datetime.now())
                    return

                # Build agent input and record it
                agent_name = decision.action.replace("call_", "")
                agent_input = self._build_agent_input(decision, state)

                # Record agent input if tracing
                if trace_recorder and agent_input:
                    trace_recorder.record_agent_input(agent_name, agent_input)

                # Call the appropriate agent with timing
                start_time = time.time()
                agent_result = self._call_agent_with_input(agent_name, agent_input)
                duration_ms = int((time.time() - start_time) * 1000)

                # Extract agent cost/tokens
                agent_cost = getattr(agent_result, 'cost', None) or 0.0
                agent_input_tokens = getattr(agent_result, 'input_tokens', None) or 0
                agent_output_tokens = getattr(agent_result, 'output_tokens', None) or 0
                total_cost += agent_cost
                total_input_tokens += agent_input_tokens
                total_output_tokens += agent_output_tokens

                # Record agent output if tracing
                if trace_recorder:
                    trace_recorder.record_agent_output(
                        agent=agent_name,
                        output_obj=agent_result,
                        duration_ms=duration_ms,
                        cost=agent_cost,
                        input_tokens=agent_input_tokens,
                        output_tokens=agent_output_tokens
                    )

                # Generate summary
                success, summary = self._generate_agent_summary(agent_name, agent_result)

                # Yield agent result event with cost info
                yield AgentResultEvent(
                    agent=agent_name,
                    success=success,
                    summary=summary,
                    duration_ms=duration_ms,
                    timestamp=datetime.now(),
                    cost=agent_cost,
                    input_tokens=agent_input_tokens,
                    output_tokens=agent_output_tokens
                )

                # Log the agent call (for orchestrator context)
                state.agent_call_log.append({
                    "agent": agent_name,
                    "success": success,
                    "summary": summary
                })

                # Update state with result
                state.last_agent = agent_name
                state.last_agent_result = agent_result

                # Handle specific agent results
                self._process_agent_result(decision.action, agent_result, state)

                # Record state snapshot after processing if tracing
                if trace_recorder:
                    trace_recorder.record_state_snapshot(state, trigger=f"after_{agent_name}")

            # Max iterations reached
            logger.warning(f"[orchestrator] max iterations ({max_iterations}) reached")
            result = {
                "response_type": "text",
                "text": "I was unable to complete the workflow generation. Please try again.",
                "workflow": None,
                "summary": None,
                "total_cost": total_cost,
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens
            }

            # Finalize trace on max iterations
            if trace_recorder:
                trace_recorder.record_error("Max iterations reached")
                trace_recorder.finalize(total_cost, total_input_tokens, total_output_tokens)

            yield FinalEvent(result=result, timestamp=datetime.now())

        except Exception as e:
            # Record error and finalize trace
            if trace_recorder:
                trace_recorder.record_error(str(e))
                trace_recorder.finalize(total_cost, total_input_tokens, total_output_tokens)
            raise

    def _get_orchestrator_decision(
        self,
        state: WorkflowAgentState,
        user_message: str
    ) -> Tuple[OrchestratorDecision, str, str, float, int, int]:
        """Call orchestrator LLM to decide next action.

        Returns:
            (decision, context_string, system_prompt, cost, input_tokens, output_tokens)
        """

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

        # Agent call history for this run
        if state.agent_call_log:
            history_lines = []
            for i, entry in enumerate(state.agent_call_log, 1):
                status = "success" if entry["success"] else "failed"
                history_lines.append(f"{i}. {entry['agent']}: {status} - {entry['summary']}")
            context_parts.append("AGENT HISTORY THIS RUN:\n" + "\n".join(history_lines))

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
            messages=messages,
            key_name=self.key_name,
            system=system_prompt,
            schema=OrchestratorDecision,
            temperature=0.5,
        )

        if result.parsed:
            decision = result.parsed
            task_preview = f" (task: {decision.agent_task[:60]}...)" if decision.agent_task and len(decision.agent_task) > 60 else (f" (task: {decision.agent_task})" if decision.agent_task else "")
            logger.info(f"[orchestrator] decision: {decision.action}{task_preview}")
            logger.debug(f"[orchestrator] full decision: {decision.model_dump_json()}")
            return decision, context, system_prompt, result.cost, result.input_tokens, result.output_tokens

        # Fallback: respond to user
        logger.warning("[orchestrator] failed to parse decision, falling back to respond_to_user")
        return (
            OrchestratorDecision(
                action="respond_to_user",
                response_text="I encountered an issue deciding the next step. Please try again."
            ),
            context,
            system_prompt,
            result.cost,
            result.input_tokens,
            result.output_tokens
        )

    def _format_agent_result(self, agent_name: str, result: Any) -> str:
        """Format agent result for context. Includes full workflow JSON (B2)."""
        if result is None:
            return "No result"

        if hasattr(result, 'model_dump'):
            data = result.model_dump(by_alias=True)
            # Strip cost/token fields - not needed in LLM context
            data.pop('cost', None)
            data.pop('input_tokens', None)
            data.pop('output_tokens', None)
            # B2: Include full workflow JSON instead of placeholder
            return json.dumps(data, default=str)

        return str(result)

    def _generate_agent_summary(self, agent_name: str, result: Any) -> tuple:
        """Generate concise summary for agent call log. Returns (success, summary)."""
        if result is None:
            return False, "no result"

        # Generator, Editor, ChunkOperator, PromptFiller, OutputDefinition - have success/error_message/workflow
        if hasattr(result, 'success'):
            if result.success:
                if agent_name == "generator" and hasattr(result, 'workflow') and result.workflow:
                    step_count = len(result.workflow.steps) if result.workflow.steps else 0
                    return True, f"created {step_count} steps"
                elif agent_name == "editor":
                    return True, "edited workflow"
                elif agent_name == "chunk_operator":
                    return True, "modified workflow"
                elif agent_name == "prompt_filler":
                    return True, "processed workflow"
                return True, "success"
            error = getattr(result, 'error_message', 'unknown error') or 'unknown error'
            return False, f"failed: {error[:40]}"

        # Validator - has valid/broken_reason
        if hasattr(result, 'valid'):
            if result.valid:
                return True, "valid"
            reason = getattr(result, 'broken_reason', 'unknown') or 'unknown'
            return False, f"invalid: {reason[:40]}"

        # Summarizer - has summary
        if hasattr(result, 'summary'):
            return True, "generated summary"

        return True, "completed"

    def _build_agent_input(self, decision: OrchestratorDecision, state: WorkflowAgentState) -> Optional[BaseModel]:
        """Build the input object for an agent based on decision."""
        action = decision.action

        if action == "call_clarifier":
            return ClarifierInput(
                user_request=decision.agent_task or state.conversation[-1].content,
                tool_specs=self.tool_specs,
                current_workflow=state.get_current_workflow()
            )

        elif action == "call_generator":
            return GeneratorInput(
                task_description=decision.agent_task or state.conversation[-1].content,
                tool_specs=self.tool_specs,
                patient_context={"mrn": state.mrn, "csn": state.csn}
            )

        elif action == "call_editor":
            current = state.pending_workflow or state.get_current_workflow()
            if not current:
                return None
            return EditorInput(
                current_workflow=current,
                edit_request=decision.agent_task or "",
                tool_specs=self.tool_specs
            )

        elif action == "call_chunk_operator":
            current = state.pending_workflow or state.get_current_workflow()
            if not current:
                return None
            return ChunkOperatorInput(
                current_workflow=current,
                operation=decision.chunk_operation or "append",
                description=decision.agent_task or "",
                tool_specs=self.tool_specs
            )

        elif action == "call_validator":
            workflow = state.pending_workflow or state.get_current_workflow()
            if not workflow:
                return None
            return ValidatorInput(workflow=workflow)

        elif action == "call_prompt_filler":
            workflow = state.pending_workflow or state.get_current_workflow()
            if not workflow:
                return None
            user_intent = state.conversation[-1].content if state.conversation else ""
            return PromptFillerInput(
                workflow=workflow,
                user_intent=user_intent,
                prompt_guides=self._prompt_guides
            )

        elif action == "call_summarizer":
            workflow = state.pending_workflow or state.get_current_workflow()
            if not workflow:
                return None
            return SummarizerInput(workflow=workflow)

        return None

    def _call_agent_with_input(self, agent_name: str, agent_input: Optional[BaseModel]) -> Any:
        """Call an agent with the given input."""
        if agent_input is None:
            # Return error dict for missing input
            if agent_name == "validator":
                return {"valid": False, "broken_reason": "No workflow to validate"}
            elif agent_name == "summarizer":
                return {"summary": "No workflow to summarize."}
            else:
                return {"success": False, "error_message": f"No input for {agent_name}"}

        if agent_name not in self.agents:
            return {"success": False, "error_message": f"Unknown agent: {agent_name}"}

        return self.agents[agent_name].run(agent_input)

    def _call_agent(self, decision: OrchestratorDecision, state: WorkflowAgentState) -> Any:
        """Route to appropriate agent based on decision. Legacy method for compatibility."""
        agent_name = decision.action.replace("call_", "")
        agent_input = self._build_agent_input(decision, state)
        return self._call_agent_with_input(agent_name, agent_input)

    def _process_agent_result(self, action: str, result: Any, state: WorkflowAgentState):
        """Update state based on agent result."""

        if action in ("call_generator", "call_editor", "call_chunk_operator"):
            # These agents produce workflows
            if hasattr(result, 'success') and result.success and hasattr(result, 'workflow'):
                state.pending_workflow = derive_output_definitions(result.workflow, self.tool_specs)

        elif action == "call_prompt_filler":
            # Prompt filler updates the workflow
            if hasattr(result, 'success') and result.success and hasattr(result, 'workflow'):
                state.pending_workflow = derive_output_definitions(result.workflow, self.tool_specs)

        elif action == "call_summarizer":
            # Store the summary
            if hasattr(result, 'summary'):
                state.pending_summary = result.summary

    def _build_response(
        self,
        decision: OrchestratorDecision,
        state: WorkflowAgentState,
        total_cost: float,
        total_input_tokens: int,
        total_output_tokens: int
    ) -> Dict[str, Any]:
        """Build final response for user."""

        response_text = decision.response_text or ""

        # Append workflow summary when returning a workflow
        if decision.include_workflow and state.pending_summary:
            response_text += f"\n\nHere's the summary of the new workflow:\n{state.pending_summary}"
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

            logger.info(f"[orchestrator] completed - response_type=workflow, workflow_id={workflow_id}")
            return {
                "response_type": "workflow",
                "text": response_text,
                "workflow": workflow,
                "summary": summary,
                "workflow_id": workflow_id,
                "total_cost": total_cost,
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens
            }
        else:
            # Text-only response
            state.add_assistant_message(response_text)

            logger.info("[orchestrator] completed - response_type=text")
            return {
                "response_type": "text",
                "text": response_text,
                "workflow": None,
                "summary": None,
                "total_cost": total_cost,
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens
            }
