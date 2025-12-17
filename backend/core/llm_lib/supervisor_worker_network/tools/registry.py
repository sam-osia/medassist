"""
Tool Registry
-------------

A minimal adapter that discovers existing Tool classes and exposes a
schema-driven catalog for the frontend to generate input forms.

For proof of concept, each catalog entry includes only the fields
necessary to render a form:
- name
- category
- description
- input_schema (JSON Schema)

Where possible, input_schema is generated from the authoritative
Pydantic input model for each tool. If a tool does not have a mapped
input model, the registry falls back to the tool's own `parameters`
definition.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import BaseModel

# Base/tool implementations
from core.llm_lib.supervisor_worker_network.tools.base import Tool
from core.llm_lib.supervisor_worker_network.tools.notes import (
    GetPatientNotesIds,
    ReadPatientNote,
    SummarizePatientNote,
    HighlightPatientNote,
    KeywordCount,
    IdentifyFlag,
    AnalyzeNoteWithSpanAndReason
)
from core.llm_lib.supervisor_worker_network.tools.flowsheets import (
    ReadFlowsheetsTable,
    SummarizeFlowsheetsTable,
    AnalyzeFlowsheetInstance,
)
from core.llm_lib.supervisor_worker_network.tools.medications import (
    GetMedicationsIds,
    ReadMedication,
)
from core.llm_lib.supervisor_worker_network.tools.diagnosis import (
    GetDiagnosisIds,
    ReadDiagnosis,
)

# Authoritative Pydantic input models for schema generation
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
    GetPatientNotesIdsInput,
    ReadPatientNoteInput,
    SummarizePatientNoteInput,
    HighlightPatientNoteInput,
    KeywordCountInput,
    IdentifyFlagInput,
    ReadFlowsheetsTableInput,
    SummarizeFlowsheetsTableInput,
    AnalyzeFlowsheetInstanceInput,
    GetMedicationsIdsInput,
    ReadMedicationInput,
    GetDiagnosisIdsInput,
    ReadDiagnosisInput,
    AnalyzeNoteWithSpanAndReasonInput
)

# Authoritative Pydantic output models for schema generation
from core.llm_lib.supervisor_worker_network.schemas.tool_outputs import (
    KeywordCountOutput,
    IdentifyFlagOutput,
    AnalyzeNoteWithSpanAndReasonOutput
)


# -----------------------------
# Internal module state (cache)
# -----------------------------
_TOOLS_BY_NAME: Dict[str, Tool] = {}
_METADATA_BY_NAME: Dict[str, Dict[str, Any]] = {}
_LAST_UPDATED: Optional[str] = None


def _pydantic_input_model_map() -> Dict[str, type[BaseModel]]:
    """Map tool names to their Pydantic input model classes.

    This mirrors/centralizes the mapping used elsewhere (e.g., supervisor).
    """
    return {
        # Notes
        "get_patient_notes_ids": GetPatientNotesIdsInput,
        "read_patient_note": ReadPatientNoteInput,
        "summarize_patient_note": SummarizePatientNoteInput,
        "highlight_patient_note": HighlightPatientNoteInput,
        "keyword_count": KeywordCountInput,
        "identify_flag": IdentifyFlagInput,
        "analyze_note_with_span_and_reason": AnalyzeNoteWithSpanAndReasonInput,

        # Flowsheets
        "read_flowsheets_table": ReadFlowsheetsTableInput,
        "summarize_flowsheets_table": SummarizeFlowsheetsTableInput,
        "analyze_flowsheet_instance": AnalyzeFlowsheetInstanceInput,

        # Medications
        "get_medications_ids": GetMedicationsIdsInput,
        "read_medication": ReadMedicationInput,

        # Diagnosis
        "get_diagnosis_ids": GetDiagnosisIdsInput,
        "read_diagnosis": ReadDiagnosisInput,
    }


def _pydantic_output_model_map() -> Dict[str, type[BaseModel]]:
    """Map tool names to their Pydantic output model classes.

    Only tools with structured outputs are mapped here.
    """
    return {
        "keyword_count": KeywordCountOutput,
        "identify_flag": IdentifyFlagOutput,
        "analyze_note_with_span_and_reason": AnalyzeNoteWithSpanAndReasonOutput,
    }


def _instantiate_all_tools() -> List[Tool]:
    """Create a single instance of each known Tool implementation.

    For PoC stability, we use an explicit allowlist rather than dynamic discovery.
    """
    return [
        # Notes
        GetPatientNotesIds(),
        ReadPatientNote(),
        SummarizePatientNote(),
        HighlightPatientNote(),
        KeywordCount(),
        IdentifyFlag(),
        AnalyzeNoteWithSpanAndReason(),

        # Flowsheets
        ReadFlowsheetsTable(),
        SummarizeFlowsheetsTable(),
        AnalyzeFlowsheetInstance(),

        # Medications
        GetMedicationsIds(),
        ReadMedication(),

        # Diagnosis
        GetDiagnosisIds(),
        ReadDiagnosis(),
    ]


def _build_input_schema(tool: Tool) -> Dict[str, Any]:
    """Return JSON Schema for the tool's inputs.

    Preference order:
    1) Pydantic input model (authoritative)
    2) Tool.parameters fallback (already JSON-Schema-like)
    """
    model_map = _pydantic_input_model_map()
    model_cls = model_map.get(tool.name)

    if model_cls is not None and issubclass(model_cls, BaseModel):
        try:
            # Pydantic v2
            schema = model_cls.model_json_schema()
            # Ensure we present the schema with type=object at the root for form generation
            if schema.get("type") != "object":
                schema = {
                    "type": "object",
                    "properties": schema.get("properties", {}),
                    "required": schema.get("required", []),
                    "additionalProperties": schema.get("additionalProperties", False),
                    "title": schema.get("title", model_cls.__name__),
                    "description": schema.get("description", ""),
                }
            return schema
        except Exception:
            # Fall through to tool.parameters if schema generation fails
            pass

    # Fallback to the tool's declared parameters
    try:
        params = tool.parameters  # type: ignore[attr-defined]
        # Expecting JSON Schema object
        if isinstance(params, dict) and params.get("type") == "object":
            return params
    except Exception:
        pass

    # Last resort: minimal empty object schema
    return {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    }


def _build_output_schema(tool: Tool) -> Dict[str, Any]:
    """Return JSON Schema for the tool's outputs.

    Preference order:
    1) Pydantic output model (authoritative)
    2) Tool.returns fallback (already JSON-Schema-like)
    """
    model_map = _pydantic_output_model_map()
    model_cls = model_map.get(tool.name)

    if model_cls is not None and issubclass(model_cls, BaseModel):
        try:
            # Pydantic v2
            schema = model_cls.model_json_schema()
            # Ensure we present the schema with type=object at the root
            if schema.get("type") != "object":
                schema = {
                    "type": "object",
                    "properties": schema.get("properties", {}),
                    "required": schema.get("required", []),
                    "additionalProperties": schema.get("additionalProperties", False),
                    "title": schema.get("title", model_cls.__name__),
                    "description": schema.get("description", ""),
                }
            return schema
        except Exception:
            # Fall through to tool.returns if schema generation fails
            pass

    # Fallback to the tool's declared returns
    try:
        returns = tool.returns  # type: ignore[attr-defined]
        # Expecting JSON Schema object
        if isinstance(returns, dict):
            return returns
    except Exception:
        pass

    # Last resort: generic object schema
    return {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    }


def discover(refresh: bool = False) -> None:
    """Discover tools and build the minimal metadata catalog.

    Populates internal caches used by the public accessors below.
    """
    global _TOOLS_BY_NAME, _METADATA_BY_NAME, _LAST_UPDATED

    if _TOOLS_BY_NAME and _METADATA_BY_NAME and not refresh:
        return

    tools = _instantiate_all_tools()

    _TOOLS_BY_NAME = {t.name: t for t in tools}
    _METADATA_BY_NAME = {}

    for tool in tools:
        _METADATA_BY_NAME[tool.name] = {
            "name": tool.name,
            "category": getattr(tool, "category", None),
            "description": getattr(tool, "description", None),
            "input_schema": _build_input_schema(tool),
            "output_schema": _build_output_schema(tool),
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

