"""CRUD API for user-defined custom tool definitions."""

import uuid
import datetime
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import ValidationError

from core.auth import permissions
from core.dataloaders.custom_tool_loader import (
    delete_custom_tool,
    find_custom_tool_by_name,
    get_custom_tool,
    list_custom_tools_for_user,
    list_own_custom_tools,
    save_custom_tool,
)
from core.workflow.schemas.custom_tool_schema import CustomToolManifest
from core.workflow.tools.resolver import get_builtin_tool_names

from .dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
def list_tools(
    user: Optional[str] = None,
    current_user: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """List custom tools. Admin can pass ?user=X to see another user's tools."""
    try:
        if user and user != current_user:
            if not permissions.is_admin(current_user):
                raise HTTPException(403, "Admin access required to view other users' tools")
            tools = list_custom_tools_for_user(user, current_user)
        else:
            tools = list_own_custom_tools(current_user)
        return {"status": "success", "tools": tools}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing custom tools: {e}")
        raise HTTPException(500, str(e))


@router.post("/")
def create_tool(
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a new custom tool definition."""
    try:
        tool_name = data.get("tool_name")
        if not tool_name:
            raise HTTPException(400, "tool_name is required")

        # Check collision with builtin tools
        if tool_name in get_builtin_tool_names():
            raise HTTPException(400, f"tool_name '{tool_name}' conflicts with a builtin tool")

        # Check collision with user's existing custom tools
        if find_custom_tool_by_name(tool_name, current_user):
            raise HTTPException(400, f"You already have a custom tool named '{tool_name}'")

        # Auto-fill server-controlled fields
        now = datetime.datetime.utcnow().isoformat()
        tool_id = str(uuid.uuid4())
        data["tool_id"] = tool_id
        data["created_by"] = current_user
        data["created_at"] = now
        data["updated_at"] = now
        data.setdefault("schema_version", 1)
        data.setdefault("execution_type", "llm_structured")

        # Validate via Pydantic
        try:
            manifest = CustomToolManifest(**data)
        except ValidationError as ve:
            raise HTTPException(400, detail=ve.errors())

        save_custom_tool(tool_id, manifest.model_dump())
        return {"status": "success", "tool_id": tool_id, "tool": manifest.model_dump()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating custom tool: {e}")
        raise HTTPException(500, str(e))


@router.get("/{tool_id}")
def get_tool(
    tool_id: str,
    current_user: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get a specific custom tool (ownership check, admin bypass)."""
    try:
        tool = get_custom_tool(tool_id, current_user)
        if not tool:
            raise HTTPException(404, "Custom tool not found")
        return {"status": "success", "tool": tool}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting custom tool: {e}")
        raise HTTPException(500, str(e))


@router.patch("/{tool_id}")
def update_tool(
    tool_id: str,
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Partial update of a custom tool definition."""
    try:
        existing = get_custom_tool(tool_id, current_user)
        if not existing:
            raise HTTPException(404, "Custom tool not found")

        # Prevent overwriting server-controlled fields
        data.pop("tool_id", None)
        data.pop("created_by", None)
        data.pop("created_at", None)

        # Merge incoming fields onto existing
        merged = {**existing, **data}
        merged["updated_at"] = datetime.datetime.utcnow().isoformat()

        # If tool_name changed, re-check collisions
        new_name = merged.get("tool_name")
        if new_name != existing.get("tool_name"):
            if new_name in get_builtin_tool_names():
                raise HTTPException(400, f"tool_name '{new_name}' conflicts with a builtin tool")
            existing_with_name = find_custom_tool_by_name(new_name, existing["created_by"])
            if existing_with_name and existing_with_name.get("tool_id") != tool_id:
                raise HTTPException(400, f"You already have a custom tool named '{new_name}'")

        # Re-validate full manifest
        try:
            manifest = CustomToolManifest(**merged)
        except ValidationError as ve:
            raise HTTPException(400, detail=ve.errors())

        save_custom_tool(tool_id, manifest.model_dump())
        return {"status": "success", "tool": manifest.model_dump()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating custom tool: {e}")
        raise HTTPException(500, str(e))


@router.delete("/{tool_id}")
def delete_tool(
    tool_id: str,
    current_user: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a custom tool (ownership check, admin bypass)."""
    try:
        success = delete_custom_tool(tool_id, current_user)
        if not success:
            raise HTTPException(404, "Custom tool not found or access denied")
        return {"status": "success", "message": "Tool deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting custom tool: {e}")
        raise HTTPException(500, str(e))
