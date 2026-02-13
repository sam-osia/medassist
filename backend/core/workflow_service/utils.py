"""
Shared utilities for workflow result handling.

This module provides functions to create and transform workflow results
in the definition-based format that supports evaluations.
"""
import os
import datetime
import json
import time
import uuid
from typing import Dict, Any, List, Optional

from core.workflow.tools.base import ToolCallMeta


# =============================================================================
# Resource Type Constants
# =============================================================================
RESOURCE_TYPE_PATIENT = 1
RESOURCE_TYPE_ENCOUNTER = 2
RESOURCE_TYPE_NOTE = 3
RESOURCE_TYPE_MEDICATION = 4
RESOURCE_TYPE_DIAGNOSIS = 5
RESOURCE_TYPE_FLOWSHEET = 6

# Map string names to integer types
RESOURCE_TYPE_MAP = {
    "patient": RESOURCE_TYPE_PATIENT,
    "encounter": RESOURCE_TYPE_ENCOUNTER,
    "note": RESOURCE_TYPE_NOTE,
    "medication": RESOURCE_TYPE_MEDICATION,
    "diagnosis": RESOURCE_TYPE_DIAGNOSIS,
    "flowsheet": RESOURCE_TYPE_FLOWSHEET,
}

# Reverse map for display
RESOURCE_TYPE_NAMES = {
    RESOURCE_TYPE_PATIENT: "patient",
    RESOURCE_TYPE_ENCOUNTER: "encounter",
    RESOURCE_TYPE_NOTE: "note",
    RESOURCE_TYPE_MEDICATION: "medication",
    RESOURCE_TYPE_DIAGNOSIS: "diagnosis",
    RESOURCE_TYPE_FLOWSHEET: "flowsheet",
}


# =============================================================================
# Field Type Constants
# =============================================================================
FIELD_TYPE_BOOLEAN = 1
FIELD_TYPE_TEXT = 2
FIELD_TYPE_NUMERIC = 3
FIELD_TYPE_CATEGORICAL = 4

FIELD_TYPE_MAP = {
    "boolean": FIELD_TYPE_BOOLEAN,
    "text": FIELD_TYPE_TEXT,
    "numeric": FIELD_TYPE_NUMERIC,
    "categorical": FIELD_TYPE_CATEGORICAL,
}


# =============================================================================
# Output Definition Creation
# =============================================================================

def create_output_definition(
    name: str,
    label: str,
    resource_type: int,
    fields: List[dict],
    metadata: Optional[dict] = None
) -> dict:
    """
    Create an output definition.

    Args:
        name: Machine name for the output (e.g., "DSM_5_criteria_1")
        label: Human-readable label (e.g., "DSM-5 Criteria 1 (Attention)")
        resource_type: Resource type constant (e.g., RESOURCE_TYPE_NOTE)
        fields: List of field definitions, each with "name" and "type"
        metadata: Additional metadata (e.g., criteria text)

    Returns:
        dict: Output definition ready for storage
    """
    # Use deterministic ID based on name so definitions properly dedupe across runs
    return {
        "id": f"def_{name}",
        "name": name,
        "label": label,
        "resource_type": resource_type,
        "fields": fields,
        "metadata": metadata or {}
    }


# =============================================================================
# Output Value Creation
# =============================================================================

def create_output_value(
    output_definition_id: str,
    resource_id: str,
    values: dict,
    metadata: Optional[dict] = None
) -> dict:
    """
    Create an output value entry.

    Args:
        output_definition_id: ID of the output definition this value belongs to
        resource_id: ID of the specific resource (note_id, order_id, etc.)
        values: The actual values (e.g., {"detected": True, "highlighted_text": "..."})
        metadata: Additional metadata (patient_id, encounter_id, resource_details)

    Returns:
        dict: Output value ready for storage
    """
    return {
        "id": f"val_{uuid.uuid4().hex[:12]}",
        "output_definition_id": output_definition_id,
        "resource_id": str(resource_id),
        "values": values,
        "metadata": metadata or {}
    }


# =============================================================================
# Experiment File Utilities
# =============================================================================

def create_experiment_folder(experiment_name):
    """Create experiment directory structure"""
    experiment_dir = os.path.join("experiments", experiment_name)
    os.makedirs(experiment_dir, exist_ok=True)
    return experiment_dir


def save_experiment_metadata(experiment_name):
    """Save experiment metadata.json"""
    experiment_dir = os.path.join("experiments", experiment_name)
    current_time = datetime.datetime.now().isoformat()

    metadata = {
        "name": experiment_name,
        "created_date": current_time,
        "last_modified_date": current_time
    }

    metadata_path = os.path.join(experiment_dir, "metadata.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved experiment metadata to {metadata_path}")


def save_experiment_results(experiment_name, results_data):
    """Save experiment results.json"""
    experiment_dir = os.path.join("experiments", experiment_name)
    results_path = os.path.join(experiment_dir, "results.json")

    with open(results_path, 'w') as f:
        json.dump(results_data, f, indent=2)

    print(f"Saved experiment results to {results_path}")


def collect_patient_results(mrn, csn, flags):
    """Format single patient data for storage"""
    return {
        "mrn": mrn,
        "encounters": [
            {
                "csn": csn,
                "flags": flags
            }
        ]
    }


# =============================================================================
# Cost Tracking
# =============================================================================

class CostTracker:
    """Accumulates per-tool-name cost/token/timing stats during a workflow run."""

    def __init__(self):
        self.entries = {}  # tool_name -> {calls, input_tokens, output_tokens, cost, duration_ms}
        self.api_key_entries = {}  # api_key_name -> {api_key_id, calls, input_tokens, output_tokens, cost}

    def record(self, tool_name: str, meta: ToolCallMeta, duration_ms: int):
        if tool_name not in self.entries:
            self.entries[tool_name] = {
                "calls": 0, "input_tokens": 0, "output_tokens": 0,
                "cost": 0.0, "duration_ms": 0
            }
        e = self.entries[tool_name]
        e["calls"] += 1
        e["input_tokens"] += meta.input_tokens
        e["output_tokens"] += meta.output_tokens
        e["cost"] += meta.cost
        e["duration_ms"] += duration_ms

        # Track by API key if present
        key_name = getattr(meta, 'api_key_name', None)
        if key_name:
            if key_name not in self.api_key_entries:
                self.api_key_entries[key_name] = {
                    "api_key_id": getattr(meta, 'api_key_id', None),
                    "calls": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0
                }
            k = self.api_key_entries[key_name]
            k["calls"] += 1
            k["input_tokens"] += meta.input_tokens
            k["output_tokens"] += meta.output_tokens
            k["cost"] += meta.cost

    def merge(self, other: "CostTracker"):
        for tool_name, data in other.entries.items():
            if tool_name not in self.entries:
                self.entries[tool_name] = {
                    "calls": 0, "input_tokens": 0, "output_tokens": 0,
                    "cost": 0.0, "duration_ms": 0
                }
            e = self.entries[tool_name]
            for key in ("calls", "input_tokens", "output_tokens", "cost", "duration_ms"):
                e[key] += data[key]

        # Merge API key entries
        for key_name, data in other.api_key_entries.items():
            if key_name not in self.api_key_entries:
                self.api_key_entries[key_name] = {
                    "api_key_id": data.get("api_key_id"),
                    "calls": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0
                }
            k = self.api_key_entries[key_name]
            for key in ("calls", "input_tokens", "output_tokens", "cost"):
                k[key] += data[key]

    def summary(self) -> dict:
        result = {
            "tool_costs": dict(self.entries),
            "totals": {
                "total_calls": sum(e["calls"] for e in self.entries.values()),
                "total_input_tokens": sum(e["input_tokens"] for e in self.entries.values()),
                "total_output_tokens": sum(e["output_tokens"] for e in self.entries.values()),
                "total_cost": sum(e["cost"] for e in self.entries.values()),
                "total_duration_ms": sum(e["duration_ms"] for e in self.entries.values()),
            }
        }
        if self.api_key_entries:
            result["api_key_costs"] = dict(self.api_key_entries)
        return result


def call_tool(tool, inputs, tracker=None):
    """Call a tool, unpack the (result, ToolCallMeta) tuple, optionally record to tracker."""
    start = time.time()
    raw = tool(inputs=inputs)
    duration_ms = int((time.time() - start) * 1000)

    if isinstance(raw, tuple) and len(raw) == 2:
        result, meta = raw
    else:
        result, meta = raw, ToolCallMeta()

    if tracker is not None:
        tracker.record(tool.name, meta, duration_ms)

    return result
