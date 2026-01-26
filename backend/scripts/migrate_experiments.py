"""
Migration script to convert existing experiments from flat results format
to definition-based output format.

Usage: python -m backend.scripts.migrate_experiments

This script will:
1. Scan all experiments in the experiments/ directory
2. Convert results.json from flat format to definition-based format
3. Fix definition IDs to be deterministic (based on flag name)
4. Create a backup of the original file as results_backup.json
5. Skip experiments that are already in the correct format
"""
import json
import os
import uuid
import shutil
from datetime import datetime

# Get the directory where this script is located, then go up to experiments
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXPERIMENTS_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "experiments")

# Resource type constants
RESOURCE_TYPE_MAP = {
    "patient": 1,
    "encounter": 2,
    "note": 3,
    "medication": 4,
    "diagnosis": 5,
    "flowsheet": 6,
}

# Field type constants
FIELD_TYPE_BOOLEAN = 1
FIELD_TYPE_TEXT = 2


def infer_resource_type(resource_type_str: str) -> int:
    """Convert string resource type to integer constant."""
    return RESOURCE_TYPE_MAP.get(resource_type_str.lower(), 2)  # Default to encounter


def infer_fields_from_result(output_result: dict) -> list:
    """Infer field definitions from a result's output_result structure."""
    fields = []

    # Always include detected as first field
    fields.append({"name": "detected", "type": FIELD_TYPE_BOOLEAN})

    # Check for common text fields
    for key in ["highlighted_text", "span", "reasoning", "matched_medication", "matched_diagnosis"]:
        if key in output_result and key != "detected" and key != "resource_details":
            fields.append({"name": key, "type": FIELD_TYPE_TEXT})

    return fields


def fix_definition_ids(experiment_path: str, data: dict):
    """
    Fix definition IDs to be deterministic and dedupe definitions by name.
    Also updates output_value references to use the new IDs.
    """
    results_path = os.path.join(experiment_path, "results.json")

    # Backup original
    backup_path = os.path.join(experiment_path, "results_backup.json")
    if not os.path.exists(backup_path):
        shutil.copy(results_path, backup_path)
        print(f"  Created backup: results_backup.json")

    # Build mapping from old IDs to new deterministic IDs
    # Also dedupe definitions by name
    old_to_new_id = {}
    deduped_definitions = {}  # name -> definition

    for d in data.get("output_definitions", []):
        name = d["name"]
        old_id = d["id"]
        new_id = f"def_{name}"

        old_to_new_id[old_id] = new_id

        # Keep only one definition per name (first one wins, but update ID)
        if name not in deduped_definitions:
            deduped_definitions[name] = {
                **d,
                "id": new_id
            }

    # Update output_values to reference new IDs
    updated_values = []
    for v in data.get("output_values", []):
        old_def_id = v.get("output_definition_id")
        new_def_id = old_to_new_id.get(old_def_id, old_def_id)
        updated_values.append({
            **v,
            "output_definition_id": new_def_id
        })

    # Write fixed data
    new_data = {
        "output_definitions": list(deduped_definitions.values()),
        "output_values": updated_values
    }

    with open(results_path, 'w') as f:
        json.dump(new_data, f, indent=2)

    print(f"  Fixed: {len(deduped_definitions)} unique definitions (was {len(data.get('output_definitions', []))})")


def migrate_experiment(experiment_path: str) -> bool:
    """
    Migrate a single experiment to new format.

    Returns True if migration was successful, False otherwise.
    """
    results_path = os.path.join(experiment_path, "results.json")
    experiment_name = os.path.basename(experiment_path)

    if not os.path.exists(results_path):
        print(f"  No results.json found, skipping")
        return False

    with open(results_path, 'r') as f:
        old_data = json.load(f)

    # Check if already migrated (has "output_definitions" key)
    if "output_definitions" in old_data:
        # Check if definitions need ID fix (random UUIDs -> deterministic)
        needs_id_fix = False
        for d in old_data.get("output_definitions", []):
            expected_id = f"def_{d['name']}"
            if d.get("id") != expected_id:
                needs_id_fix = True
                break

        if needs_id_fix:
            print(f"  Fixing definition IDs to be deterministic")
            fix_definition_ids(experiment_path, old_data)
            return True
        else:
            print(f"  Already migrated with correct IDs, skipping")
            return True

    # Check if empty or unknown format
    if "results" not in old_data:
        print(f"  Unknown format (no 'results' key), skipping")
        return False

    results_list = old_data.get("results", [])
    if not results_list:
        print(f"  Empty results, creating empty new format")
        new_data = {"output_definitions": [], "output_values": []}
        with open(results_path, 'w') as f:
            json.dump(new_data, f, indent=2)
        return True

    # Backup original
    backup_path = os.path.join(experiment_path, "results_backup.json")
    shutil.copy(results_path, backup_path)
    print(f"  Created backup: results_backup.json")

    # Build definitions from unique output_names (using deterministic IDs)
    definitions = {}  # output_name -> definition dict

    for r in results_list:
        output_name = r.get("output_name", "unknown")
        if output_name not in definitions:
            resource_type_str = r.get("resource_type", "encounter")
            output_result = r.get("output_result", {})

            # Use deterministic ID based on name
            definitions[output_name] = {
                "id": f"def_{output_name}",
                "name": output_name,
                "label": output_name.replace("_", " ").title(),
                "resource_type": infer_resource_type(resource_type_str),
                "fields": infer_fields_from_result(output_result),
                "metadata": {}
            }

    # Convert each result to an output value
    output_values = []
    for r in results_list:
        output_name = r.get("output_name", "unknown")
        definition = definitions.get(output_name)
        if not definition:
            continue

        output_result = r.get("output_result", {})
        resource_details = output_result.pop("resource_details", {})

        # Build values dict from output_result (excluding resource_details)
        values = {}
        for key, val in output_result.items():
            if key != "resource_details":
                values[key] = val

        # Build metadata
        metadata = {
            "patient_id": str(r.get("patient_id", "")),
            "encounter_id": str(r.get("encounter_id", "")),
            "resource_details": resource_details
        }

        output_values.append({
            "id": f"val_{uuid.uuid4().hex[:12]}",
            "output_definition_id": definition["id"],
            "resource_id": str(r.get("resource_id", "")),
            "values": values,
            "metadata": metadata
        })

    # Write new format
    new_data = {
        "output_definitions": list(definitions.values()),
        "output_values": output_values
    }
    with open(results_path, 'w') as f:
        json.dump(new_data, f, indent=2)

    print(f"  Migrated: {len(definitions)} definitions, {len(output_values)} values")
    return True


def main():
    """Migrate all experiments."""
    print(f"Migration script started at {datetime.now().isoformat()}")
    print(f"Scanning {EXPERIMENTS_DIR}/ directory...\n")

    if not os.path.exists(EXPERIMENTS_DIR):
        print("No experiments directory found")
        return

    experiments = [
        d for d in os.listdir(EXPERIMENTS_DIR)
        if os.path.isdir(os.path.join(EXPERIMENTS_DIR, d))
    ]

    print(f"Found {len(experiments)} experiment(s) to check\n")

    migrated = 0
    skipped = 0
    failed = 0

    for exp_name in sorted(experiments):
        exp_path = os.path.join(EXPERIMENTS_DIR, exp_name)
        print(f"Processing: {exp_name}")

        try:
            if migrate_experiment(exp_path):
                migrated += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  Error: {e}")
            failed += 1

        print()

    print("=" * 50)
    print(f"Migration complete:")
    print(f"  - Migrated: {migrated}")
    print(f"  - Skipped:  {skipped}")
    print(f"  - Failed:   {failed}")
    print(f"\nFinished at {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
