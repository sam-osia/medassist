"""Unified resolver — merges builtin and custom tools into one catalog and run path."""

from typing import Any, Dict, List

from core.dataloaders.custom_tool_loader import find_custom_tool_by_name, list_own_custom_tools
from core.workflow.schemas.custom_tool_schema import CustomToolManifest
from core.workflow.tools.base import Tool
from core.workflow.tools.custom_tool import UserDefinedTool
from core.workflow.tools.registry import (
    _build_input_schema,
    _build_output_schema,
    discover,
    get_catalog,
    get_tool,
    list_tools,
)


def _manifest_to_tool(manifest_dict: Dict[str, Any]) -> UserDefinedTool:
    manifest = CustomToolManifest(**manifest_dict)
    return UserDefinedTool(manifest)


def _build_custom_metadata(tool: UserDefinedTool) -> Dict[str, Any]:
    """Build catalog metadata for a custom tool in the same shape as builtin metadata."""
    return {
        "name": tool.name,
        "display_name": tool.display_name,
        "category": tool.category,
        "description": tool.description,
        "user_description": tool.user_description,
        "input_schema": _build_input_schema(tool),
        "output_schema": _build_output_schema(tool),
        "input_help": tool.input_help,
        "role": tool.role,
        "uses_llm": tool.uses_llm,
        "is_custom": True,
        "prompt_defaults": tool.prompt_defaults,
    }


def get_catalog_for_user(username: str) -> Dict[str, Any]:
    """Return combined catalog of builtin + user's custom tools."""
    discover()
    catalog = get_catalog()
    items = list(catalog.get("tools", []))

    # Append custom tools for this user
    custom_tools = list_own_custom_tools(username)
    for ct_dict in custom_tools:
        try:
            tool = _manifest_to_tool(ct_dict)
            items.append(_build_custom_metadata(tool))
        except Exception:
            continue

    items.sort(key=lambda x: (x.get("category") or "", x["name"]))
    return {
        "tools": items,
        "last_updated": catalog.get("last_updated"),
    }


def resolve_tool(tool_name: str, username: str) -> Tool:
    """Resolve a tool by name — tries builtin first, then custom."""
    discover()
    try:
        return get_tool(tool_name)
    except KeyError:
        pass

    ct_dict = find_custom_tool_by_name(tool_name, username)
    if ct_dict:
        return _manifest_to_tool(ct_dict)

    raise KeyError(f"Unknown tool: {tool_name}")


def get_builtin_tool_names() -> List[str]:
    """Return list of builtin tool names (for collision checking)."""
    discover()
    return list_tools()
