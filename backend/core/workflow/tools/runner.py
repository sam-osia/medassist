from __future__ import annotations

import json
import time
from typing import Any, Dict, Tuple

from pydantic import BaseModel, ValidationError

from core.workflow.tools.base import Tool, ToolCallMeta
from core.workflow.tools.registry import discover, get_tool
from core.workflow.tools.resolver import resolve_tool



def _normalize_result(value: Any) -> Tuple[Any, Dict[str, Any]]:
    """Normalize tool result to JSON-serializable value and meta info."""
    meta: Dict[str, Any] = {}

    # Pydantic model → dict
    if isinstance(value, BaseModel):
        meta["output_kind"] = "object"
        return value.model_dump(), meta

    # Already JSON-serializable types
    if isinstance(value, (dict, list, bool, int, float)) or value is None:
        kind = (
            "object" if isinstance(value, dict)
            else "array" if isinstance(value, list)
            else "boolean" if isinstance(value, bool)
            else "number" if isinstance(value, (int, float))
            else "null"
        )
        meta["output_kind"] = kind
        return value, meta

    # Strings: attempt to parse JSON
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            meta["output_kind"] = "json"
            meta["parsed_json"] = True
            return parsed, meta
        except Exception:
            meta["output_kind"] = "text"
            meta["parsed_json"] = False
            return value, meta

    # Fallback: convert to string
    meta["output_kind"] = "text"
    return str(value), meta


def run_tool(tool_name: str, inputs: Dict[str, Any], allow_side_effects: bool = False, current_user: str = None) -> Dict[str, Any]:
    """Validate inputs, execute the tool, and return a normalized envelope."""
    discover()  # ensure registry is initialized

    # Lookup tool — use resolver if current_user provided (supports custom tools)
    try:
        if current_user:
            tool: Tool = resolve_tool(tool_name, current_user)
        else:
            tool: Tool = get_tool(tool_name)
    except KeyError:
        return {
            "ok": False,
            "error": {"code": "unknown_tool", "message": f"Unknown tool: {tool_name}"}
        }

    # Validate inputs via tool.Input
    model_cls = getattr(tool, 'Input', None)
    if model_cls is None:
        return {
            "ok": False,
            "error": {"code": "no_input_model", "message": f"No input model for tool: {tool_name}"}
        }

    try:
        validated: BaseModel = model_cls(**inputs)
    except ValidationError as ve:
        return {
            "ok": False,
            "error": {"code": "validation_error", "message": "Invalid inputs", "details": ve.errors()}
        }

    # Execute
    start = time.time()
    try:
        raw = tool(validated)  # tools return (domain_result, ToolCallMeta)

        # Unpack tuple
        if isinstance(raw, tuple) and len(raw) == 2:
            domain_result, call_meta = raw
        else:
            domain_result, call_meta = raw, ToolCallMeta()

        norm_result, meta = _normalize_result(domain_result)
        meta["duration_ms"] = int((time.time() - start) * 1000)

        # Merge cost metadata from LLM calls
        if call_meta.cost > 0:
            meta["cost"] = call_meta.cost
            meta["input_tokens"] = call_meta.input_tokens
            meta["output_tokens"] = call_meta.output_tokens

        return {
            "ok": True,
            "tool_name": tool_name,
            "result": norm_result,
            "meta": meta,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": {"code": "execution_error", "message": str(e)},
        }
