"""Trace recorder for capturing detailed workflow orchestration events."""

import json
import logging
from datetime import datetime
from dataclasses import asdict
from typing import List, Optional, Any
from pathlib import Path

from pydantic import BaseModel

from core.dataloders.conversation_loader import save_trace

logger = logging.getLogger(__name__)


class TraceRecorder:
    """Records detailed trace events during a workflow orchestration turn.

    Captures:
    - Initial and final state snapshots
    - Orchestrator decisions with full context
    - Agent inputs and outputs
    - State changes
    - Errors

    Events are stored as JSON lines and saved to disk via save_trace().
    """

    def __init__(self, conversation_id: str, turn_number: int):
        """Initialize a new trace recorder.

        Args:
            conversation_id: The conversation ID
            turn_number: The turn number (1-indexed, based on user message count)
        """
        self.conversation_id = conversation_id
        self.turn_number = turn_number
        self.events: List[str] = []  # JSON strings, one per event
        self._finalized = False
        self._start_time = datetime.now()  # Track turn start for relative timestamps

    def _serialize(self, obj: Any) -> Any:
        """Serialize an object to JSON-compatible format."""
        if obj is None:
            return None
        if isinstance(obj, BaseModel):
            return obj.model_dump(by_alias=True)
        if hasattr(obj, '__dataclass_fields__'):
            return asdict(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, (list, tuple)):
            return [self._serialize(item) for item in obj]
        if isinstance(obj, dict):
            return {k: self._serialize(v) for k, v in obj.items()}
        # For primitives and other types, return as-is
        return obj

    def _add_event(self, event_type: str, **kwargs):
        """Add an event to the trace."""
        if self._finalized:
            logger.warning(f"Attempted to add event to finalized trace: {event_type}")
            return

        now = datetime.now()
        relative_ms = int((now - self._start_time).total_seconds() * 1000)

        event = {
            "event": event_type,
            "ts": now.isoformat(),
            "ts_relative_ms": relative_ms,
            **{k: self._serialize(v) for k, v in kwargs.items()}
        }
        self.events.append(json.dumps(event, default=str))

    def record_turn_start(self, user_message: str):
        """Record turn start with user message.

        Args:
            user_message: The user's message that triggered this turn
        """
        self._add_event(
            "turn_start",
            user_message=user_message,
            turn_number=self.turn_number
        )

    def record_initial_state(self, state: Any):
        """Record the initial state at the start of a turn.

        Args:
            state: WorkflowAgentState object
        """
        self._add_event(
            "initial_state",
            state=self._serialize_state(state)
        )

    def record_decision(
        self,
        orchestrator_context: str,
        decision: BaseModel,
        cost: float = 0.0,
        input_tokens: int = 0,
        output_tokens: int = 0,
        system_prompt: str = ""
    ):
        """Record an orchestrator decision.

        Args:
            orchestrator_context: The context string sent to the orchestrator LLM
            decision: The OrchestratorDecision object
            cost: LLM call cost
            input_tokens: Input token count
            output_tokens: Output token count
            system_prompt: The full system prompt sent to the orchestrator LLM
        """
        self._add_event(
            "decision",
            context=orchestrator_context,
            system_prompt=system_prompt,
            decision=decision,
            cost=cost,
            input_tokens=input_tokens,
            output_tokens=output_tokens
        )

    def record_agent_input(self, agent: str, input_obj: BaseModel):
        """Record the input sent to an agent.

        Args:
            agent: Agent name (e.g., "generator", "validator")
            input_obj: The agent's input object
        """
        self._add_event(
            "agent_input",
            agent=agent,
            input=input_obj
        )

    def record_agent_output(
        self,
        agent: str,
        output_obj: Any,
        duration_ms: int = 0,
        cost: float = 0.0,
        input_tokens: int = 0,
        output_tokens: int = 0
    ):
        """Record the output from an agent.

        Args:
            agent: Agent name
            output_obj: The agent's output object
            duration_ms: How long the agent call took
            cost: LLM call cost (if applicable)
            input_tokens: Input token count
            output_tokens: Output token count
        """
        self._add_event(
            "agent_output",
            agent=agent,
            output=output_obj,
            duration_ms=duration_ms,
            cost=cost,
            input_tokens=input_tokens,
            output_tokens=output_tokens
        )

    def record_state_snapshot(self, state: Any, trigger: str = ""):
        """Record a state snapshot after a state change.

        Args:
            state: WorkflowAgentState object
            trigger: What triggered this snapshot (e.g., "after_generator")
        """
        self._add_event(
            "state_snapshot",
            trigger=trigger,
            state=self._serialize_state(state)
        )

    def record_error(self, error: str):
        """Record an error that occurred during processing.

        Args:
            error: Error message
        """
        self._add_event("error", message=error)

    def _serialize_state(self, state: Any) -> dict:
        """Serialize WorkflowAgentState to a dict.

        Captures all relevant fields for debugging.
        """
        if state is None:
            return {}

        # Get workflow summaries instead of full workflow JSON for readability
        workflow_history_summary = {}
        if hasattr(state, 'workflow_history') and state.workflow_history:
            for wf_id, wf in state.workflow_history.items():
                if hasattr(wf, 'steps'):
                    workflow_history_summary[wf_id] = {
                        "step_count": len(wf.steps) if wf.steps else 0,
                        "step_ids": [s.id for s in wf.steps] if wf.steps else []
                    }

        # Serialize pending workflow fully since it's the active one
        pending_workflow = None
        if hasattr(state, 'pending_workflow') and state.pending_workflow:
            pending_workflow = self._serialize(state.pending_workflow)

        # Serialize last agent result
        last_agent_result = None
        if hasattr(state, 'last_agent_result') and state.last_agent_result:
            last_agent_result = self._serialize(state.last_agent_result)

        return {
            "conversation_length": len(state.conversation) if hasattr(state, 'conversation') else 0,
            "workflow_history": workflow_history_summary,
            "current_workflow_id": getattr(state, 'current_workflow_id', None),
            "pending_workflow": pending_workflow,
            "pending_summary": getattr(state, 'pending_summary', None),
            "last_agent": getattr(state, 'last_agent', None),
            "last_agent_result": last_agent_result,
            "agent_call_log": getattr(state, 'agent_call_log', []),
            "mrn": getattr(state, 'mrn', 0),
            "csn": getattr(state, 'csn', 0),
        }

    def finalize(self, total_cost: float = 0.0, total_input_tokens: int = 0, total_output_tokens: int = 0) -> Optional[str]:
        """Finalize the trace and save to disk.

        Args:
            total_cost: Total cost for this turn
            total_input_tokens: Total input tokens
            total_output_tokens: Total output tokens

        Returns:
            Path to the saved trace file, or None if save failed
        """
        if self._finalized:
            logger.warning("Trace already finalized")
            return None

        # Add final event
        self._add_event(
            "final",
            total_cost=total_cost,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens
        )

        self._finalized = True

        # Save to disk
        trace_path = save_trace(self.conversation_id, self.turn_number, self.events)

        if trace_path:
            logger.info(f"Trace saved: {trace_path}")
        else:
            logger.error(f"Failed to save trace for conversation {self.conversation_id}, turn {self.turn_number}")

        return trace_path
