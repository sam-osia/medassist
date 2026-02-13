import json
import logging
import os
from typing import List, Dict, Any, Optional
from threading import Lock
import datetime

logger = logging.getLogger(__name__)

# Configuration
EXPERIMENTS_DIR = "experiments"


class ExperimentCache:
    """Thread-safe singleton cache for experiment data."""
    _instance = None
    _lock = Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return

        with self._lock:
            if not self._initialized:
                self._index = None
                self._initialized = True

    def get_index(self) -> Optional[Dict[str, Any]]:
        """Get cached experiment index, loading it if necessary."""
        if self._index is None:
            with self._lock:
                if self._index is None:  # Double-check lock pattern
                    self._index = self._build_index()
        return self._index

    def invalidate(self):
        """Clear the cached index."""
        with self._lock:
            self._index = None

    def _build_index(self) -> Dict[str, Any]:
        """Build experiment index by scanning all experiment folders."""
        logger.info("Building experiment index...")

        patient_index = {}  # mrn -> list of experiment info
        experiment_index = {}  # experiment_name -> metadata + summary

        if not os.path.exists(EXPERIMENTS_DIR):
            return {
                "patient_index": patient_index,
                "experiment_index": experiment_index,
                "built_at": datetime.datetime.now().isoformat()
            }

        for experiment_name in os.listdir(EXPERIMENTS_DIR):
            experiment_path = os.path.join(EXPERIMENTS_DIR, experiment_name)
            if not os.path.isdir(experiment_path):
                continue

            try:
                # Load metadata
                metadata_path = os.path.join(experiment_path, "metadata.json")
                results_path = os.path.join(experiment_path, "results.json")

                if not (os.path.exists(metadata_path) and os.path.exists(results_path)):
                    continue

                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)

                with open(results_path, 'r') as f:
                    results = json.load(f)

                # Process experiment data
                experiment_info = {
                    "experiment_name": experiment_name,
                    "metadata": metadata,
                    "patient_count": 0,
                    "total_encounters": 0,
                    "total_flags_detected": 0,
                    "total_cost": results.get("cost_summary", {}).get("totals", {}).get("total_cost", 0)
                }

                output_values = results.get("output_values", [])

                # Track unique patients and encounters
                patients_seen = set()
                encounters_seen = {}  # (mrn, csn) -> flags_detected count

                for v in output_values:
                    patient_id = v.get("metadata", {}).get("patient_id", "")
                    encounter_id = v.get("metadata", {}).get("encounter_id", "")

                    if not patient_id:
                        continue

                    patients_seen.add(str(patient_id))
                    enc_key = (str(patient_id), str(encounter_id))

                    if enc_key not in encounters_seen:
                        encounters_seen[enc_key] = 0

                    # Count detected flags
                    if v.get("values", {}).get("detected") is True:
                        encounters_seen[enc_key] += 1
                        experiment_info["total_flags_detected"] += 1

                experiment_info["patient_count"] = len(patients_seen)
                experiment_info["total_encounters"] = len(encounters_seen)

                # Add to patient index
                for (mrn, csn), flags_detected in encounters_seen.items():
                    if mrn not in patient_index:
                        patient_index[mrn] = []

                    patient_index[mrn].append({
                        "experiment_name": experiment_name,
                        "csn": csn,
                        "run_date": metadata.get("created_date"),
                        "flags_detected": flags_detected
                    })

                experiment_index[experiment_name] = experiment_info

            except Exception as e:
                logger.error(f"Error processing experiment {experiment_name}: {e}")
                continue

        logger.info(f"Built index with {len(experiment_index)} experiments and {len(patient_index)} patients")

        return {
            "patient_index": patient_index,
            "experiment_index": experiment_index,
            "built_at": datetime.datetime.now().isoformat()
        }

    def get_experiments_for_patient(self, mrn: str) -> List[Dict[str, Any]]:
        """Get all experiments containing a specific patient."""
        index = self.get_index()
        if not index:
            return []

        patient_experiments = index["patient_index"].get(str(mrn), [])

        # Enrich with experiment metadata
        enriched_experiments = []
        for exp_info in patient_experiments:
            experiment_name = exp_info["experiment_name"]
            experiment_meta = index["experiment_index"].get(experiment_name, {})

            enriched_experiments.append({
                **exp_info,
                "experiment_metadata": experiment_meta.get("metadata", {}),
                "total_patients": experiment_meta.get("patient_count", 0)
            })

        # Sort by run date (newest first)
        enriched_experiments.sort(
            key=lambda x: x.get("run_date", ""),
            reverse=True
        )

        return enriched_experiments

    def get_all_experiments(self) -> List[Dict[str, Any]]:
        """Get all experiments with summary information."""
        index = self.get_index()
        if not index:
            return []

        experiments = []
        for experiment_name, experiment_info in index["experiment_index"].items():
            experiments.append({
                "experiment_name": experiment_name,
                "created_date": experiment_info["metadata"].get("created_date"),
                "patient_count": experiment_info["patient_count"],
                "total_encounters": experiment_info["total_encounters"],
                "total_flags_detected": experiment_info["total_flags_detected"],
                "total_cost": experiment_info.get("total_cost", 0)
            })

        # Sort by creation date (newest first)
        experiments.sort(
            key=lambda x: x.get("created_date", ""),
            reverse=True
        )

        return experiments

    def get_experiment_details(self, experiment_name: str) -> Optional[Dict[str, Any]]:
        """Load full experiment details from disk."""
        experiment_path = os.path.join(EXPERIMENTS_DIR, experiment_name)

        if not os.path.exists(experiment_path):
            return None

        metadata_path = os.path.join(experiment_path, "metadata.json")
        results_path = os.path.join(experiment_path, "results.json")

        if not (os.path.exists(metadata_path) and os.path.exists(results_path)):
            return None

        try:
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)

            with open(results_path, 'r') as f:
                results = json.load(f)

            return {
                "experiment_name": experiment_name,
                "metadata": metadata,
                "results": results
            }

        except Exception as e:
            logger.error(f"Error loading experiment {experiment_name}: {e}")
            return None

    def get_experiments_for_project(self, project_name: str) -> List[Dict[str, Any]]:
        """Get all experiments (workflow runs) for a specific project."""
        index = self.get_index()
        if not index:
            return []

        project_experiments = []

        # Filter experiments by project_name in metadata
        for experiment_name, experiment_info in index["experiment_index"].items():
            metadata = experiment_info.get("metadata", {})
            if metadata.get("project_name") == project_name:
                project_experiments.append({
                    "experiment_name": experiment_name,
                    "workflow_name": metadata.get("workflow_name", "Unknown"),
                    "run_date": metadata.get("created_date"),
                    "dataset_name": metadata.get("dataset_name", "Unknown"),
                    "patient_count": experiment_info.get("patient_count", 0),
                    "total_encounters": experiment_info.get("total_encounters", 0),
                    "total_flags_detected": experiment_info.get("total_flags_detected", 0),
                    "total_cost": experiment_info.get("total_cost", 0)
                })

        # Sort by run date (newest first)
        project_experiments.sort(
            key=lambda x: x.get("run_date", ""),
            reverse=True
        )

        return project_experiments

    def get_patient_experiments_for_project(self, mrn: str, project_name: str) -> List[Dict[str, Any]]:
        """Get all experiments for a specific patient within a specific project."""
        index = self.get_index()
        if not index:
            return []

        # Get all patient experiments
        patient_experiments = index["patient_index"].get(str(mrn), [])

        # Filter by project_name using experiment metadata
        project_scoped_experiments = []
        for exp_info in patient_experiments:
            experiment_name = exp_info["experiment_name"]
            experiment_meta = index["experiment_index"].get(experiment_name, {})

            # Check if this experiment belongs to the specified project
            if experiment_meta.get("metadata", {}).get("project_name") == project_name:
                project_scoped_experiments.append({
                    **exp_info,
                    "experiment_metadata": experiment_meta.get("metadata", {}),
                    "total_patients": experiment_meta.get("patient_count", 0)
                })

        # Sort by run date (newest first)
        project_scoped_experiments.sort(
            key=lambda x: x.get("run_date", ""),
            reverse=True
        )

        return project_scoped_experiments


# Initialize the global cache instance
_cache = ExperimentCache()


def get_experiments_for_patient(mrn: str, current_user: str = None) -> List[Dict[str, Any]]:
    """Get all experiments containing a specific patient, filtered by project access."""
    all_experiments = _cache.get_experiments_for_patient(mrn)

    if not current_user:
        return all_experiments

    from core.auth import permissions

    if permissions.is_admin(current_user):
        return all_experiments

    # Filter experiments by project access
    filtered = []
    for exp in all_experiments:
        project_name = exp.get("experiment_metadata", {}).get("project_name")
        if project_name and permissions.has_project_access(current_user, project_name):
            filtered.append(exp)

    return filtered


def get_experiments_for_project(project_name: str, current_user: str = None) -> List[Dict[str, Any]]:
    """Get all experiments (workflow runs) for a specific project, with access validation."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_project_access(current_user, project_name):
            return []
    return _cache.get_experiments_for_project(project_name)


def get_patient_experiments_for_project(mrn: str, project_name: str, current_user: str = None) -> List[Dict[str, Any]]:
    """Get all experiments for a specific patient within a specific project, with access validation."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_project_access(current_user, project_name):
            return []
    return _cache.get_patient_experiments_for_project(mrn, project_name)


def get_all_experiments(current_user: str = None) -> List[Dict[str, Any]]:
    """Get all experiments with summary information, filtered by project access."""
    all_experiments = _cache.get_all_experiments()

    if not current_user:
        return all_experiments

    from core.auth import permissions

    if permissions.is_admin(current_user):
        return all_experiments

    # Filter experiments by project access
    index = _cache.get_index()
    if not index:
        return []

    filtered = []
    for exp in all_experiments:
        experiment_name = exp.get("experiment_name")
        experiment_info = index["experiment_index"].get(experiment_name, {})
        project_name = experiment_info.get("metadata", {}).get("project_name")

        if project_name and permissions.has_project_access(current_user, project_name):
            filtered.append(exp)

    return filtered


def get_experiment_details(experiment_name: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Get full experiment details, with access validation."""
    details = _cache.get_experiment_details(experiment_name)

    if not details:
        return None

    if current_user:
        from core.auth import permissions
        project_name = details.get("metadata", {}).get("project_name")

        if project_name and not permissions.has_project_access(current_user, project_name):
            return None

    return details


def invalidate_experiment_cache():
    """Force reload of experiment cache."""
    _cache.invalidate()


def reload_experiments():
    """Force reload of experiments from disk."""
    _cache.invalidate()
    return _cache.get_index()
