"""Migrate legacy workflow from plans/ to workflow_defs/ format."""

import json
import sys
from pathlib import Path

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from core.dataloaders.workflow_def_loader import save_workflow_def


def find_last_plan(conversation_history: list) -> dict | None:
    """Find the last plan entry in conversation history."""
    last_plan = None
    for entry in conversation_history:
        if entry.get("type") == "plan":
            last_plan = entry
    return last_plan


def count_analyze_steps_in_loop(steps: list) -> int:
    """Count analyze_note_with_span_and_reason steps inside loops."""
    count = 0
    for step in steps:
        if step.get("type") == "loop" and "body" in step:
            for body_step in step["body"]:
                if body_step.get("tool") == "analyze_note_with_span_and_reason":
                    count += 1
    return count


def migrate_workflow(legacy_path: str, workflow_name: str, created_by: str = "migrated"):
    """Migrate a legacy workflow to the new format."""
    legacy_file = Path(legacy_path)

    if not legacy_file.exists():
        print(f"Error: Legacy file not found: {legacy_path}")
        return False

    # Read legacy file
    with open(legacy_file, 'r') as f:
        legacy_data = json.load(f)

    conversation_history = legacy_data.get("conversation_history", [])
    if not conversation_history:
        print("Error: No conversation_history found in legacy file")
        return False

    # Find the last plan
    last_plan_entry = find_last_plan(conversation_history)
    if not last_plan_entry:
        print("Error: No plan entry found in conversation_history")
        return False

    # Extract raw_plan
    plan_data = last_plan_entry.get("planData", {})
    raw_plan = plan_data.get("raw_plan")
    if not raw_plan:
        print("Error: No raw_plan found in planData")
        return False

    # Add empty output_definitions and output_mappings
    raw_plan["output_definitions"] = []
    raw_plan["output_mappings"] = []

    # Validate: count analyze steps in loops
    steps = raw_plan.get("steps", [])
    analyze_count = count_analyze_steps_in_loop(steps)
    print(f"Found {analyze_count} analyze_note_with_span_and_reason steps in loops")

    if analyze_count != 9:
        print(f"Warning: Expected 9 analyze steps, found {analyze_count}")

    # Save using the existing save function
    success = save_workflow_def(workflow_name, raw_plan, created_by=created_by)

    if success:
        print(f"Successfully migrated workflow to: workflow_defs/{workflow_name}.json")
    else:
        print("Error: Failed to save workflow")

    return success


if __name__ == "__main__":
    legacy_path = backend_dir / "plans" / "sdoh.json"
    migrate_workflow(str(legacy_path), "sdoh", created_by="migrated")
