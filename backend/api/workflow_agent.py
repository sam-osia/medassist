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
from core.workflow.schemas.plan_schema import Plan as Workflow
from core.dataloders.conversation_loader import (
    save_conversation, get_conversation,
    conversation_exists
)
from .dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


def state_from_stored_messages(messages: list, mrn: int, csn: int) -> WorkflowAgentState:
    """Convert stored message format to WorkflowAgentState."""
    state = WorkflowAgentState(mrn=mrn, csn=csn)
    for msg in messages:
        if msg['type'] == 'user':
            state.add_user_message(msg['content'])
        elif msg['type'] == 'assistant':
            state.add_assistant_message(msg['content'])
        elif msg['type'] == 'plan':
            # Reconstruct workflow and add to history
            workflow = Workflow.model_validate(msg['planData']['raw_plan'])
            workflow_id = state.add_workflow(workflow)
            # Don't duplicate assistant message - plan messages include the response
    return state


def state_to_stored_messages_with_trace(
    state: WorkflowAgentState,
    trace: List[Dict[str, Any]],
    error_message: Optional[str] = None
) -> list:
    """Convert WorkflowAgentState to storage format, attaching trace to final message."""
    messages = []
    conversation_len = len(state.conversation)

    for i, entry in enumerate(state.conversation):
        is_last = (i == conversation_len - 1)

        if entry.workflow_ref:
            # This is a plan message
            workflow = state.workflow_history.get(entry.workflow_ref)
            if workflow:
                msg = {
                    "id": str(uuid4()),
                    "type": "plan",
                    "planData": {"raw_plan": workflow.model_dump()},
                    "message": entry.content,
                    "timestamp": datetime.datetime.now().isoformat()
                }
                # Attach trace to final plan message
                if is_last and trace:
                    msg["trace"] = trace
                messages.append(msg)
        else:
            msg = {
                "id": str(uuid4()),
                "type": entry.role,
                "content": entry.content,
                "timestamp": datetime.datetime.now().isoformat()
            }
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

    return messages


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
    messages = []
    if conversation_id and conversation_exists(conversation_id):
        conv = get_conversation(conversation_id, current_user)
        if conv:
            messages = conv.get('messages', [])
        else:
            raise HTTPException(status_code=403, detail="Access denied")

    # Convert to state
    state = state_from_stored_messages(messages, mrn, csn)

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
                            "raw_plan": result["workflow"].model_dump(),
                            "summary": result.get("summary")
                        }
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
