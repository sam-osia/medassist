"""Trace event schemas for streaming workflow orchestration."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel


class DecisionEvent(BaseModel):
    """Emitted when the orchestrator makes a decision about what to do next."""
    type: Literal["decision"] = "decision"
    action: str
    agent_task: Optional[str] = None
    reasoning: Optional[str] = None
    timestamp: datetime


class AgentResultEvent(BaseModel):
    """Emitted after an agent completes its work."""
    type: Literal["agent_result"] = "agent_result"
    agent: str
    success: bool
    summary: str
    duration_ms: int
    timestamp: datetime


class FinalEvent(BaseModel):
    """Emitted when the orchestrator is ready to respond to the user."""
    type: Literal["final"] = "final"
    result: Dict[str, Any]
    timestamp: datetime


class ErrorEvent(BaseModel):
    """Emitted when an error occurs during processing."""
    type: Literal["error"] = "error"
    message: str
    partial_trace: List[Dict[str, Any]] = []
    timestamp: datetime


TraceEvent = Union[DecisionEvent, AgentResultEvent, FinalEvent, ErrorEvent]
