"""API endpoint for the multi-agent workflow system with streaming support."""

from fastapi import APIRouter, HTTPException, Body, Depends
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List, Optional
import logging
import datetime
import json
from uuid import uuid4

from core.workflow.orchestrator import WorkflowOrchestrator
from core.workflow.state import WorkflowAgentState
from core.workflow.schemas.workflow_schema import Workflow
from core.dataloders.conversation_loader import (
    save_conversation, get_conversation, list_conversations,
    delete_conversation, conversation_exists
)
from core.auth import permissions
from .dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


def state_from_stored_messages(conv_data: dict, mrn: int, csn: int) -> WorkflowAgentState:
    """Convert stored format to WorkflowAgentState.

    Args:
        conv_data: Dict with 'messages' (list) and 'workflows' (dict) keys
        mrn: Medical record number
        csn: Contact serial number
    """
    state = WorkflowAgentState(mrn=mrn, csn=csn)

    messages = conv_data.get("messages", [])
    workflows = conv_data.get("workflows", {})

    # Reconstruct workflow_history from stored workflows
    for workflow_id, workflow_data in workflows.items():
        workflow = Workflow.model_validate(workflow_data["raw_workflow"])
        state.workflow_history[workflow_id] = workflow

    # Reconstruct conversation
    for msg in messages:
        if msg['type'] == 'user':
            state.add_user_message(msg['content'])
        elif msg['type'] == 'assistant':
            workflow_ref = msg.get('workflow_ref')
            state.add_assistant_message(msg['content'], workflow_ref=workflow_ref)

    return state


def state_to_stored_messages_with_trace(
    state: WorkflowAgentState,
    trace: List[Dict[str, Any]],
    error_message: Optional[str] = None
) -> dict:
    """Convert WorkflowAgentState to storage format.

    Returns dict with 'messages' and 'workflows' keys.
    Trace is attached to the final assistant message.
    """
    messages = []
    conversation_len = len(state.conversation)

    for i, entry in enumerate(state.conversation):
        is_last = (i == conversation_len - 1)

        msg = {
            "id": str(uuid4()),
            "type": entry.role,
            "content": entry.content,
            "timestamp": datetime.datetime.now().isoformat()
        }

        # Add workflow_ref if present
        if entry.workflow_ref:
            msg["workflow_ref"] = entry.workflow_ref

        # Attach trace to final assistant message
        if is_last and entry.role == "assistant" and trace:
            msg["trace"] = trace

        messages.append(msg)

    # If error occurred, add error message with trace
    if error_message:
        messages.append({
            "id": str(uuid4()),
            "type": "assistant",
            "content": f"Error: {error_message}",
            "trace": trace,
            "timestamp": datetime.datetime.now().isoformat()
        })

    # Build workflows dict from state.workflow_history
    workflows = {}
    for workflow_id, workflow in state.workflow_history.items():
        workflows[workflow_id] = {"raw_workflow": workflow.model_dump()}

    return {"messages": messages, "workflows": workflows}


@router.post("/message")
async def process_message_stream(data: Dict[str, Any] = Body(...), current_user: str = Depends(get_current_user)):
    """Process a message through the workflow agent system with streaming trace events."""
    user_message = data.get("message")
    conversation_id = data.get("conversation_id")
    mrn = data.get("mrn", 0)
    csn = data.get("csn", 0)
    dataset = data.get("dataset")

    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    # Load existing conversation or create new state
    if conversation_id and conversation_exists(conversation_id):
        conv = get_conversation(conversation_id, current_user)
        if conv:
            conv_data = {
                "messages": conv.get('messages', []),
                "workflows": conv.get('workflows', {})
            }
        else:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        conv_data = {"messages": [], "workflows": {}}

    # Convert to state
    state = state_from_stored_messages(conv_data, mrn, csn)

    async def event_generator():
        trace = []  # Collect trace events for persistence
        orchestrator = WorkflowOrchestrator(dataset=dataset)

        try:
            for event in orchestrator.process_message_streaming(user_message, state):
                # Convert event to stream format
                if event.type == "decision":
                    event_data = {
                        "event": "decision",
                        "action": event.action,
                        "agent_task": event.agent_task,
                        "reasoning": event.reasoning,
                        "timestamp": event.timestamp.isoformat()
                    }
                    trace.append(event_data)
                    yield json.dumps(event_data) + "\n"

                elif event.type == "agent_result":
                    event_data = {
                        "event": "agent_result",
                        "agent": event.agent,
                        "success": event.success,
                        "summary": event.summary,
                        "duration_ms": event.duration_ms,
                        "timestamp": event.timestamp.isoformat()
                    }
                    trace.append(event_data)
                    yield json.dumps(event_data) + "\n"

                elif event.type == "final":
                    result = event.result

                    # Convert state back to messages for storage with trace
                    updated_messages = state_to_stored_messages_with_trace(state, trace)

                    # Save conversation
                    if conversation_id:
                        save_conversation(conversation_id, updated_messages, current_user)

                    # Yield final event
                    final_data = {
                        "event": "final",
                        "response_type": result["response_type"],
                        "text": result["text"],
                    }
                    if result["response_type"] == "workflow" and result.get("workflow"):
                        final_data["workflow_data"] = {
                            "raw_workflow": result["workflow"].model_dump()
                        }
                        final_data["workflow_id"] = result.get("workflow_id")
                    yield json.dumps(final_data) + "\n"

        except Exception as e:
            logger.error(f"Error in process_message_stream: {e}", exc_info=True)
            error_data = {
                "event": "error",
                "message": str(e),
                "partial_trace": trace
            }

            # Save error state with partial trace
            if conversation_id:
                error_messages = state_to_stored_messages_with_trace(
                    state, trace, error_message=str(e)
                )
                save_conversation(conversation_id, error_messages, current_user)

            yield json.dumps(error_data) + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )


# =============================================================================
# Conversation Endpoints (migrated from planning.py)
# =============================================================================

@router.get("/conversations")
def list_saved_conversations(current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get list of all saved conversations for current user."""
    try:
        conversations = list_conversations(current_user)

        return {
            "status": "success",
            "total_conversations": len(conversations),
            "conversations": conversations
        }

    except Exception as e:
        logger.error(f"Error in list_saved_conversations: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/conversations/{conversation_id}")
def get_saved_conversation(conversation_id: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get a specific saved conversation."""
    try:
        conversation_data = get_conversation(conversation_id, current_user)

        if not conversation_data:
            raise HTTPException(status_code=404, detail=f"Conversation '{conversation_id}' not found")

        return {
            "status": "success",
            "conversation_id": conversation_data.get("conversation_id"),
            "messages": conversation_data.get("messages", []),
            "workflows": conversation_data.get("workflows", {}),
            "created_date": conversation_data.get("created_date"),
            "last_message_date": conversation_data.get("last_message_date"),
            "title": conversation_data.get("title", "Untitled Conversation")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_saved_conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/conversations/{conversation_id}")
def delete_saved_conversation(conversation_id: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Delete a saved conversation."""
    try:
        # Check if conversation exists
        conversation_data = get_conversation(conversation_id, current_user)
        if not conversation_data:
            raise HTTPException(status_code=404, detail=f"Conversation '{conversation_id}' not found")

        # Check permissions (admin or creator)
        if not permissions.is_admin(current_user) and conversation_data.get('created_by') != current_user:
            raise HTTPException(
                status_code=403,
                detail="Only conversation creator or admin can delete this conversation"
            )

        success = delete_conversation(conversation_id)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete conversation")

        return {
            "status": "success",
            "message": f"Conversation '{conversation_id}' deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_saved_conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
