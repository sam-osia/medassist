import json
import logging
import os
import datetime
from typing import List, Dict, Any
from threading import Lock

logger = logging.getLogger(__name__)

PROJECTS_DIR = "projects"
_file_lock = Lock()


def _billing_path(project_name: str) -> str:
    return os.path.join(PROJECTS_DIR, project_name, "billing.json")


def _read_billing(project_name: str) -> List[Dict[str, Any]]:
    path = _billing_path(project_name)
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"Error reading billing for {project_name}: {e}")
        return []


def _write_billing(project_name: str, entries: List[Dict[str, Any]]):
    path = _billing_path(project_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(entries, f, indent=2)


def append_billing_entry(
    project_name: str,
    experiment_name: str,
    workflow_name: str,
    cost_summary: Dict[str, Any],
) -> None:
    entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "category": "workflow_execution",
        "experiment_name": experiment_name,
        "workflow_name": workflow_name,
        "total_cost": cost_summary.get("totals", {}).get("total_cost", 0.0),
        "total_input_tokens": cost_summary.get("totals", {}).get("total_input_tokens", 0),
        "total_output_tokens": cost_summary.get("totals", {}).get("total_output_tokens", 0),
        "total_calls": cost_summary.get("totals", {}).get("total_calls", 0),
        "tool_costs": cost_summary.get("tool_costs", {}),
        "api_key_costs": cost_summary.get("api_key_costs", {}),
    }
    with _file_lock:
        entries = _read_billing(project_name)
        entries.append(entry)
        _write_billing(project_name, entries)
    logger.info(f"Appended billing entry for {experiment_name} to project {project_name}")


def get_billing(project_name: str) -> Dict[str, Any]:
    entries = _read_billing(project_name)
    total_cost = sum(e.get("total_cost", 0.0) for e in entries)
    total_input_tokens = sum(e.get("total_input_tokens", 0) for e in entries)
    total_output_tokens = sum(e.get("total_output_tokens", 0) for e in entries)
    total_calls = sum(e.get("total_calls", 0) for e in entries)

    # Aggregate per-API-key totals across all entries
    api_key_totals = {}
    for entry in entries:
        for key_name, data in entry.get("api_key_costs", {}).items():
            if key_name not in api_key_totals:
                api_key_totals[key_name] = {
                    "api_key_id": data.get("api_key_id"),
                    "calls": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0
                }
            t = api_key_totals[key_name]
            t["calls"] += data.get("calls", 0)
            t["input_tokens"] += data.get("input_tokens", 0)
            t["output_tokens"] += data.get("output_tokens", 0)
            t["cost"] += data.get("cost", 0.0)

    return {
        "totals": {
            "total_cost": total_cost,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "total_calls": total_calls,
        },
        "api_key_totals": api_key_totals,
        "entries": entries,
    }
