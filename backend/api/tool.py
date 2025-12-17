from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any
import logging

from core.llm_lib.supervisor_worker_network.tools.registry import discover, get_catalog
from core.llm_lib.supervisor_worker_network.tools.runner import run_tool as run_tool_service

from .dependencies import get_current_user


router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


@router.get("/catalog")
def tools_catalog() -> Dict[str, Any]:
    try:
        discover()  # Ensure registry is initialized
        catalog = get_catalog()
        return {"status": "success", **catalog}
    except Exception as e:
        logger.error(f"Error in tools_catalog: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/run")
def tools_run(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Execute a tool with validated inputs and return a normalized envelope."""
    try:
        tool_name = data.get("tool_name")
        inputs = data.get("inputs", {})
        allow_side_effects = bool(data.get("allow_side_effects", False))

        if not tool_name:
            raise HTTPException(status_code=400, detail="Field 'tool_name' is required")

        result = run_tool_service(tool_name, inputs, allow_side_effects)

        # Map error cases to HTTP codes for transport semantics
        if not result.get("ok", False):
            code = result.get("error", {}).get("code")
            if code in {"unknown_tool", "validation_error", "side_effects_not_allowed", "no_input_model"}:
                raise HTTPException(status_code=400, detail=result["error"])
            else:
                raise HTTPException(status_code=500, detail=result.get("error", {"message": "Unknown error"}))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in tools_run: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
