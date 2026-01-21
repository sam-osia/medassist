"""Orchestrator decision schema for workflow agent system."""

from pydantic import BaseModel
from typing import Literal, Optional


class OrchestratorDecision(BaseModel):
    """Output of the orchestrator LLM - decides next action."""

    action: Literal[
        "call_generator",
        "call_editor",
        "call_chunk_operator",
        "call_validator",
        "call_prompt_filler",
        "call_summarizer",
        "call_clarifier",
        "respond_to_user"
    ]

    # For respond_to_user action
    response_text: Optional[str] = None
    include_workflow: bool = False  # Whether to include current workflow in response

    # For call_* actions - context/instructions to pass to the agent
    agent_task: Optional[str] = None

    # For call_chunk_operator specifically
    chunk_operation: Optional[Literal["insert", "append", "remove"]] = None
