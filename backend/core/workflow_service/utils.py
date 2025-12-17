import os
import datetime
import json


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