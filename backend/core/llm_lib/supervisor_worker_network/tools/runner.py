from __future__ import annotations

import json
import time
from typing import Any, Dict, Tuple

from pydantic import BaseModel, ValidationError

from core.llm_lib.supervisor_worker_network.tools.base import Tool
from core.llm_lib.supervisor_worker_network.tools.registry import discover, get_tool

# Import Pydantic input models for validation
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
    GetPatientNotesIdsInput,
    ReadPatientNoteInput,
    SummarizePatientNoteInput,
    HighlightPatientNoteInput,
    KeywordCountInput,
    IdentifyFlagInput,
    AnalyzeNoteWithSpanAndReasonInput,
    ReadFlowsheetsTableInput,
    SummarizeFlowsheetsTableInput,
    AnalyzeFlowsheetInstanceInput,
    GetMedicationsIdsInput,
    ReadMedicationInput,
    GetDiagnosisIdsInput,
    ReadDiagnosisInput,
    FilterMedicationInput,
)


def _pydantic_input_model_map() -> Dict[str, type[BaseModel]]:
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
        "filter_medication": FilterMedicationInput,

        # Diagnosis
        "get_diagnosis_ids": GetDiagnosisIdsInput,
        "read_diagnosis": ReadDiagnosisInput,
    }


# Tools that can mutate state and require explicit opt-in
_MUTATING_TOOLS = {"store_note_result"}


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


def run_tool(tool_name: str, inputs: Dict[str, Any], allow_side_effects: bool = False) -> Dict[str, Any]:
    """Validate inputs, execute the tool, and return a normalized envelope."""
    discover()  # ensure registry is initialized

    # Lookup tool
    try:
        tool: Tool = get_tool(tool_name)
    except KeyError:
        return {
            "ok": False,
            "error": {"code": "unknown_tool", "message": f"Unknown tool: {tool_name}"}
        }

    # Guard side effects
    if tool_name in _MUTATING_TOOLS and not allow_side_effects:
        return {
            "ok": False,
            "error": {
                "code": "side_effects_not_allowed",
                "message": f"Tool '{tool_name}' requires allow_side_effects=true"
            }
        }

    # Validate inputs via Pydantic
    model_map = _pydantic_input_model_map()
    model_cls = model_map.get(tool_name)
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
        raw_result = tool(validated)  # tools accept pydantic inputs
        norm_result, meta = _normalize_result(raw_result)
        meta["duration_ms"] = int((time.time() - start) * 1000)
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

