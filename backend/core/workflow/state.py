"""State management for workflow agent system."""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Literal

from core.workflow.schemas.plan_schema import Plan as Workflow


@dataclass
class ConversationEntry:
    """Single entry in conversation history."""
    role: Literal["user", "assistant"]
    content: str
    workflow_ref: Optional[str] = None  # e.g., "workflow_v2"


@dataclass
class WorkflowAgentState:
    """
    Manages all state for a workflow agent session.
    Tracks conversation, workflow history, and intermediate results.
    """

    # Conversation tracking
    conversation: List[ConversationEntry] = field(default_factory=list)
    workflow_history: Dict[str, Workflow] = field(default_factory=dict)
    current_workflow_id: Optional[str] = None

    # Patient context
    mrn: int = 0
    csn: int = 0

    # Last agent result (for orchestrator context)
    last_agent: Optional[str] = None
    last_agent_result: Optional[Any] = None

    # Intermediate state during multi-agent flow
    pending_workflow: Optional[Workflow] = None  # Workflow being built/modified
    pending_summary: Optional[str] = None

    def get_current_workflow(self) -> Optional[Workflow]:
        """Get the current active workflow."""
        if self.current_workflow_id:
            return self.workflow_history.get(self.current_workflow_id)
        return None

    def add_workflow(self, workflow: Workflow) -> str:
        """Add a new workflow and make it current. Returns the workflow ID."""
        version = len(self.workflow_history) + 1
        workflow_id = f"workflow_v{version}"
        self.workflow_history[workflow_id] = workflow
        self.current_workflow_id = workflow_id
        return workflow_id

    def add_user_message(self, content: str):
        """Add a user message to conversation history."""
        self.conversation.append(ConversationEntry(role="user", content=content))

    def add_assistant_message(self, content: str, workflow_ref: Optional[str] = None):
        """Add an assistant message to conversation history."""
        self.conversation.append(ConversationEntry(
            role="assistant",
            content=content,
            workflow_ref=workflow_ref
        ))

    def get_conversation_for_llm(self) -> List[Dict[str, str]]:
        """Format conversation history for LLM messages."""
        return [
            {"role": entry.role, "content": entry.content}
            for entry in self.conversation
        ]

    def clear_pending(self):
        """Clear pending state after committing workflow."""
        self.pending_workflow = None
        self.pending_summary = None
        self.last_agent = None
        self.last_agent_result = None
