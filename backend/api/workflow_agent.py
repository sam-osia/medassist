"""API endpoint for the multi-agent workflow system."""

from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any
import logging
import datetime
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


def state_to_stored_messages(state: WorkflowAgentState) -> list:
    """Convert WorkflowAgentState back to storage format."""
    messages = []
    for entry in state.conversation:
        if entry.workflow_ref:
            # This is a plan message
            workflow = state.workflow_history.get(entry.workflow_ref)
            if workflow:
                messages.append({
                    "id": str(uuid4()),
                    "type": "plan",
                    "planData": {"raw_plan": workflow.model_dump()},
                    "message": entry.content,
                    "timestamp": datetime.datetime.now().isoformat()
                })
        else:
            messages.append({
                "id": str(uuid4()),
                "type": entry.role,
                "content": entry.content,
                "timestamp": datetime.datetime.now().isoformat()
            })
    return messages


@router.post("/message")
def process_message(data: Dict[str, Any] = Body(...), current_user: str = Depends(get_current_user)):
    """Process a message through the workflow agent system."""
    try:
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

        # Process through orchestrator
        orchestrator = WorkflowOrchestrator(dataset=dataset)
        result = orchestrator.process_message(user_message, state)

        # Convert state back to messages for storage
        updated_messages = state_to_stored_messages(state)

        # Save conversation
        if conversation_id:
            save_conversation(conversation_id, updated_messages, current_user)

        # Build response
        response = {
            "status": "success",
            "response_type": result["response_type"],
            "message": result["text"]
        }

        if result["response_type"] == "workflow" and result["workflow"]:
            response["workflow_data"] = {
                "raw_plan": result["workflow"].model_dump(),
                "summary": result.get("summary")
            }

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in process_message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
