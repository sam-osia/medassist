"""
Tool Registry
-------------

Discovers existing Tool classes and exposes a schema-driven catalog
for the frontend to generate input forms.

Each tool class defines its own Input (and optionally Output) Pydantic
models. The registry reads tool.Input / tool.Output directly — no
manual mapping dicts needed.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import BaseModel

# Base/tool implementations
from core.workflow.tools.base import Tool
from core.workflow.tools.notes import (
    GetPatientNotesIds,
    ReadPatientNote,
    SummarizePatientNote,
    SemanticKeywordCount,
    ExactKeywordCount,
    AnalyzeNoteWithSpanAndReason
)
from core.workflow.tools.flowsheets import (
    ReadFlowsheetsTable,
    SummarizeFlowsheetsTable,
    AnalyzeFlowsheetInstance,
)
from core.workflow.tools.medications import (
    GetMedicationsIds,
    ReadMedication,
    FilterMedication,
    HighlightMedication,
)
from core.workflow.tools.diagnosis import (
    GetDiagnosisIds,
    ReadDiagnosis,
    HighlightDiagnosis,
)
from core.workflow.tools.variable_management import (
    InitStore,
    StoreAppend,
    StoreRead,
    BuildText,
)


# -----------------------------
# Internal module state (cache)
# -----------------------------
_TOOLS_BY_NAME: Dict[str, Tool] = {}
_METADATA_BY_NAME: Dict[str, Dict[str, Any]] = {}
_LAST_UPDATED: Optional[str] = None


def _instantiate_all_tools() -> List[Tool]:
    """Create a single instance of each known Tool implementation.

    For PoC stability, we use an explicit allowlist rather than dynamic discovery.
    """
    return [
        # Notes
        GetPatientNotesIds(),
        ReadPatientNote(),
        SummarizePatientNote(),
        SemanticKeywordCount(),
        ExactKeywordCount(),
        AnalyzeNoteWithSpanAndReason(),

        # Flowsheets
        ReadFlowsheetsTable(),
        SummarizeFlowsheetsTable(),
        AnalyzeFlowsheetInstance(),

        # Medications
        GetMedicationsIds(),
        ReadMedication(),
        FilterMedication(),
        HighlightMedication(),

        # Diagnosis
        GetDiagnosisIds(),
        ReadDiagnosis(),
        HighlightDiagnosis(),

        # Variable Management
        InitStore(),
        StoreAppend(),
        StoreRead(),
        BuildText(),
    ]


def _build_input_schema(tool: Tool) -> Dict[str, Any]:
    """Return JSON Schema for the tool's inputs (auto-derived from tool.Input)."""
    try:
        schema = tool.Input.model_json_schema()
        if schema.get("type") != "object":
            schema = {
                "type": "object",
                "properties": schema.get("properties", {}),
                "required": schema.get("required", []),
                "additionalProperties": schema.get("additionalProperties", False),
                "title": schema.get("title", tool.Input.__name__),
                "description": schema.get("description", ""),
            }
        return schema
    except Exception:
        return {"type": "object", "properties": {}, "required": [], "additionalProperties": False}


def _build_output_schema(tool: Tool) -> Dict[str, Any]:
    """Return JSON Schema for the tool's outputs (auto-derived from tool.Output or tool.returns)."""
    if tool.Output is not None:
        try:
            schema = tool.Output.model_json_schema()
            if schema.get("type") != "object":
                schema = {
                    "type": "object",
                    "properties": schema.get("properties", {}),
                    "required": schema.get("required", []),
                    "additionalProperties": schema.get("additionalProperties", False),
                    "title": schema.get("title", tool.Output.__name__),
                    "description": schema.get("description", ""),
                }
            return schema
        except Exception:
            pass

    # Fallback to _returns_schema() (for tools returning primitives)
    try:
        returns = tool.returns
        if isinstance(returns, dict):
            return returns
    except Exception:
        pass

    return {"type": "object", "properties": {}, "required": [], "additionalProperties": False}


def discover(refresh: bool = False) -> None:
    """Discover tools and build the minimal metadata catalog."""
    global _TOOLS_BY_NAME, _METADATA_BY_NAME, _LAST_UPDATED

    if _TOOLS_BY_NAME and _METADATA_BY_NAME and not refresh:
        return

    tools = _instantiate_all_tools()

    _TOOLS_BY_NAME = {t.name: t for t in tools}
    _METADATA_BY_NAME = {}

    for tool in tools:
        _METADATA_BY_NAME[tool.name] = {
            "name": tool.name,
            "display_name": getattr(tool, "display_name", tool.name),
            "category": getattr(tool, "category", None),
            "description": getattr(tool, "description", None),
            "user_description": getattr(tool, "user_description", None),
            "input_schema": _build_input_schema(tool),
            "output_schema": _build_output_schema(tool),
            "input_help": getattr(tool, "input_help", {}),
            "role": getattr(tool, "role", "compute"),
            "uses_llm": getattr(tool, "uses_llm", False),
        }

    _LAST_UPDATED = datetime.utcnow().isoformat()


def list_tools() -> List[str]:
    """List registered tool names."""
    discover()
    return sorted(_TOOLS_BY_NAME.keys())


def get_tool(name: str) -> Tool:
    """Get a tool instance by name."""
    discover()
    if name not in _TOOLS_BY_NAME:
        raise KeyError(f"Unknown tool: {name}")
    return _TOOLS_BY_NAME[name]


def get_metadata(name: str) -> Dict[str, Any]:
    """Get minimal metadata for a specific tool (for form generation)."""
    discover()
    if name not in _METADATA_BY_NAME:
        raise KeyError(f"Unknown tool: {name}")
    return _METADATA_BY_NAME[name]


def get_input_schema(name: str) -> Dict[str, Any]:
    """Get input JSON Schema for a specific tool."""
    return get_metadata(name)["input_schema"]


def get_catalog() -> Dict[str, Any]:
    """Return the minimal catalog suitable for frontend form generation."""
    discover()
    items = sorted(_METADATA_BY_NAME.values(), key=lambda x: (x.get("category") or "", x["name"]))
    return {
        "tools": items,
        "last_updated": _LAST_UPDATED,
    }
