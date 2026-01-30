from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any
import logging
import copy

from core.deprecated.planning.plan_supervisor_agent import conversational_planning_agent
from core.dataloders.workflow_def_loader import save_workflow_def, get_workflow_def, list_workflow_defs, delete_workflow_def, workflow_def_exists
from core.dataloders.conversation_loader import (
    save_conversation, get_conversation, list_conversations,
    delete_conversation, conversation_exists
)
from core.auth import permissions

from .dependencies import get_current_user
import datetime
from uuid import uuid4
import json

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


def convert_to_openai_format(stored_messages: list) -> list:
    """
    Convert storage format to OpenAI format.
    Plan messages become assistant messages with 'plan_v#: <json>' format.

    Args:
        stored_messages: List of messages in storage format with 'type' field

    Returns:
        List of messages in OpenAI format with 'role' field
    """
    openai_messages = []
    plan_version = 0

    for msg in stored_messages:
        if msg['type'] == 'user':
            openai_messages.append({
                "role": "user",
                "content": msg['content']
            })
        elif msg['type'] == 'assistant':
            openai_messages.append({
                "role": "assistant",
                "content": msg['content']
            })
        elif msg['type'] == 'plan':
            plan_version += 1
            plan_json = json.dumps(msg['planData']['raw_plan'], indent=2)
            openai_messages.append({
                "role": "assistant",
                "content": f"plan_v{plan_version}: {plan_json}"
            })

    return openai_messages


@router.post("/conversational-plan")
def conversational_plan(data: Dict[str, Any] = Body(...), current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Generate a response using the conversational planning agent."""
    try:
        user_prompt = data.get("prompt")
        mrn = data.get("mrn", 0)
        csn = data.get("csn", 0)
        dataset = data.get("dataset")
        conversation_id = data.get("conversation_id")  # Conversation ID for stateful tracking

        if not user_prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        # Load existing conversation if conversation_id provided
        messages = []
        if conversation_id:
            if conversation_exists(conversation_id):
                conv = get_conversation(conversation_id, current_user)
                if conv:
                    messages = conv.get('messages', [])
                else:
                    # User doesn't have access to this conversation
                    raise HTTPException(status_code=403, detail="Access denied to this conversation")
            else:
                # New conversation - will be created when saved
                logger.info(f"Creating new conversation: {conversation_id}")
        else:
            # No conversation_id provided - log warning but continue
            logger.warning("No conversation_id provided to conversational_plan endpoint")

        # Append user message to conversation
        user_message = {
            "id": str(uuid4()),
            "type": "user",
            "content": user_prompt,
            "timestamp": datetime.datetime.now().isoformat()
        }
        messages.append(user_message)

        # Convert to OpenAI format (includes all history + new message)
        openai_messages = convert_to_openai_format(messages)

        result = conversational_planning_agent(openai_messages, mrn, csn, dataset)

        # Append response messages to conversation based on response type
        if result["response_type"] == "text":
            # Add assistant text message
            assistant_message = {
                "id": str(uuid4()),
                "type": "assistant",
                "content": result["text_response"],
                "timestamp": datetime.datetime.now().isoformat()
            }
            messages.append(assistant_message)

            # Save conversation if conversation_id provided
            if conversation_id:
                save_conversation(conversation_id, messages, current_user)

            return {
                "status": "success",
                "response_type": "text",
                "message": result["text_response"]
            }
        elif result["response_type"] == "plan":
            # Generate plan ID similar to original endpoint
            plan_id = f"plan_{result['plan_data']['raw_plan']['steps'][0]['id'] if result['plan_data']['raw_plan'].get('steps') else 'generated'}_{mrn}_{csn}"

            # Add assistant message
            assistant_message = {
                "id": str(uuid4()),
                "type": "assistant",
                "content": result["text_response"],
                "timestamp": datetime.datetime.now().isoformat()
            }
            messages.append(assistant_message)

            # Add plan message
            plan_message = {
                "id": str(uuid4()),
                "type": "plan",
                "planData": {
                    "raw_plan": result["plan_data"]["raw_plan"]
                },
                "message": result["text_response"],
                "timestamp": datetime.datetime.now().isoformat()
            }
            messages.append(plan_message)

            # Save conversation if conversation_id provided
            if conversation_id:
                save_conversation(conversation_id, messages, current_user)

            return {
                "status": "success",
                "response_type": "plan",
                "message": result["text_response"],
                "plan_data": {
                    "plan_id": plan_id,
                    "raw_plan": result["plan_data"]["raw_plan"]
                }
            }


    except Exception as e:
        logger.error(f"Error in conversational_plan: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/edit-plan-step")
def edit_plan_step(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Edit a specific step in a plan."""
    try:
        original_prompt = data.get("original_prompt")
        original_plan = data.get("original_plan")
        step_id = data.get("step_id")
        change_request = data.get("change_request")

        if not all([original_prompt, original_plan, step_id, change_request]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: original_prompt, original_plan, step_id, change_request"
            )

        # Build a minimal conversation context with the plan and edit request
        # This simulates a conversation where the plan was just created
        messages = [
            {"role": "user", "content": original_prompt},
            {"role": "assistant", "content": f"plan_v1: {json.dumps(original_plan, indent=2)}"},
            {"role": "user", "content": change_request}
        ]

        # Use conversational planning agent to handle the edit
        result = conversational_planning_agent(
            messages=messages,
            mrn=0,
            csn=0,
            dataset=None
        )

        # Check if a plan was generated
        if result["response_type"] != "plan":
            raise HTTPException(
                status_code=500,
                detail=f"Expected plan response but got: {result['response_type']}"
            )

        # Extract plan data from result
        plan_data = result["plan_data"]

        return {
            "status": "success",
            "message": result["text_response"],
            "plan_data": {
                "plan_id": f"plan_edited_{step_id}",
                "raw_plan": plan_data["raw_plan"]
            }
        }

    except Exception as e:
        logger.error(f"Error in edit_plan_step: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/plans")
def list_saved_plans(current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get list of all saved plans."""
    try:
        plans = list_workflow_defs(current_user)

        return {
            "status": "success",
            "total_plans": len(plans),
            "plans": plans
        }

    except Exception as e:
        logger.error(f"Error in list_saved_plans: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


def _find_and_update_step_prompt(steps: list, step_id: str, new_prompt: Dict[str, Any]) -> bool:
    """
    Recursively find a step by ID and update its prompt input.
    Returns True if step was found and updated, False otherwise.
    """
    for step in steps:
        # Check if this is the target step
        if step.get('id') == step_id:
            # Validate step has the required structure
            if step.get('type') != 'tool':
                raise ValueError(f"Step '{step_id}' is not a tool step")
            if 'inputs' not in step:
                raise ValueError(f"Step '{step_id}' has no inputs")

            # Update the prompt
            step['inputs']['prompt'] = new_prompt
            return True

        # Search in nested structures
        # Loop bodies
        if step.get('type') == 'loop' and 'body' in step:
            if _find_and_update_step_prompt(step['body'], step_id, new_prompt):
                return True

        # If/then branches
        if step.get('type') == 'if' and 'then' in step:
            if _find_and_update_step_prompt([step['then']], step_id, new_prompt):
                return True

    return False


@router.post("/plans/update-step-prompt")
def update_step_prompt(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Update a specific step's prompt input without LLM regeneration."""
    try:
        raw_plan = data.get("raw_plan")
        step_id = data.get("step_id")
        new_prompt = data.get("new_prompt")

        # Validate required fields
        if not all([raw_plan, step_id, new_prompt]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: raw_plan, step_id, new_prompt"
            )

        # Validate prompt structure
        if not isinstance(new_prompt, dict):
            raise HTTPException(status_code=400, detail="new_prompt must be an object")
        if not new_prompt.get("system_prompt") or not new_prompt.get("user_prompt"):
            raise HTTPException(
                status_code=400,
                detail="new_prompt must have system_prompt and user_prompt fields"
            )

        # Deep copy to avoid mutations
        updated_plan = copy.deepcopy(raw_plan)

        # Find and update the step
        steps = updated_plan.get('steps', [])
        if not _find_and_update_step_prompt(steps, step_id, new_prompt):
            raise HTTPException(status_code=400, detail=f"Step '{step_id}' not found in plan")

        return {
            "status": "success",
            "raw_plan": updated_plan
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_step_prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/plans/{plan_name}")
def get_saved_plan(plan_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get a specific saved plan."""
    try:
        plan_data = get_workflow_def(plan_name, current_user)

        if not plan_data:
            raise HTTPException(status_code=404, detail=f"Plan '{plan_name}' not found")

        return {
            "status": "success",
            **plan_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_saved_plan: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/plans/{plan_name}")
def save_new_plan(plan_name: str, data: Dict[str, Any] = Body(...), current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Save or update a plan."""
    try:
        raw_plan = data.get("raw_plan")

        if not raw_plan:
            raise HTTPException(
                status_code=400,
                detail="Missing required field: raw_plan"
            )

        # Validate plan name (alphanumeric and underscores only)
        if not plan_name.replace('_', '').replace('-', '').isalnum():
            raise HTTPException(
                status_code=400,
                detail="Plan name can only contain letters, numbers, hyphens, and underscores"
            )

        success = save_workflow_def(plan_name, raw_plan, created_by=current_user)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to save plan")

        return {
            "status": "success",
            "message": f"Plan '{plan_name}' saved successfully",
            "plan_name": plan_name
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in save_new_plan: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/plans/{plan_name}")
def delete_saved_plan(plan_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Delete a saved plan."""
    try:
        if not workflow_def_exists(plan_name):
            raise HTTPException(status_code=404, detail=f"Plan '{plan_name}' not found")

        # Check permissions (admin or creator)
        if not permissions.has_plan_access(current_user, plan_name):
            raise HTTPException(
                status_code=403,
                detail="Only plan creator or admin can delete this plan"
            )

        success = delete_workflow_def(plan_name)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete plan")

        return {
            "status": "success",
            "message": f"Plan '{plan_name}' deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_saved_plan: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


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