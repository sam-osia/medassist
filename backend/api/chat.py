from fastapi import APIRouter, HTTPException, Body, Depends
from fastapi.responses import StreamingResponse
from typing import Dict, Any
import logging

from core.llm_lib.inference import get_models, call_llm
from core.llm_lib.supervisor_worker_network.agents.supervisor import supervisor_stream
from core.process.process_v1_events import process_workflow_stream
from .dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)]
)
logger = logging.getLogger(__name__)


@router.get("/models-list")
def get_models_list() -> Dict[str, Any]:
    """Get list of available models."""
    try:
        models = get_models()
        return {"models": models}
    except Exception as e:
        logger.error(f"Error in get_models_list: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    

@router.post("/chat")
def chat(data: Dict[str, Any] = Body(...)):
    """Send messages to a model and get response."""

    model = data["model"]
    system_message = data["system_message"]
    messages = data["messages"]

    try:
        result = call_llm(
            prompt=messages,
            system_prompt=system_message,
            model=model
        )
        print(result)
        print()
        print(result.answer)
        return {"response": result.answer}
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    
@router.post("/supervisor-stream")
async def supervisor_stream_endpoint(data: Dict[str, Any] = Body(...)):
    """Send messages to a supervisor and get streaming response."""
    user_prompt = data["user_prompt"]
    mrn = data.get("mrn")
    csn = data.get("csn")
    dataset = data.get("dataset")
    chat_history = data.get("chat_history", [])
    
    # Build context from chat history if provided
    context_prompt = ""
    if chat_history:
        context_prompt = "Previous conversation:\n"
        for msg in chat_history:
            if msg.get("role") == "user":
                context_prompt += f"User: {msg.get('content', '')}\n"
            elif msg.get("role") == "assistant" and msg.get("content"):
                context_prompt += f"Assistant: {msg.get('content', '')}\n"
        context_prompt += "\n"
    
    # Append patient information to the user prompt if provided
    patient_info = []
    if dataset:
        patient_info.append(f"- Dataset: {dataset}")
    if mrn:
        patient_info.append(f"- MRN: {mrn}")
    if csn:
        patient_info.append(f"- CSN: {csn}")
    
    if patient_info:
        enhanced_prompt = f"{context_prompt}{user_prompt}\n\nPatient Information:\n" + "\n".join(patient_info)
    else:
        enhanced_prompt = f"{context_prompt}{user_prompt}"

    async def event_generator():
        try:
            for stream_output in supervisor_stream(enhanced_prompt, mrn=mrn, csn=csn, dataset=dataset):
                # Each stream_output is already a JSON string with a newline
                yield stream_output
        except Exception as e:
            logger.error(f"Error in supervisor_stream: {e}")
            # Send error event to client
            yield f'{{"event": "error", "detail": "Internal server error: {str(e)}"}}\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )
