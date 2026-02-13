import json
import logging
import os
from typing import List, Dict, Any, Optional
from threading import Lock
from core.dataloaders import user_loader

logger = logging.getLogger(__name__)

# Configuration
DATASETS_DIR = "datasets"

# Datasets to exclude from being served
EXCLUDED_DATASETS = set()


class DatasetCache:
    """Thread-safe singleton cache for dataset metadata and patient data."""
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
                self._metadata_cache = None
                self._patients_cache = {}  # Store patient data separately
                self._initialized = True

    def get_metadata_cache(self) -> Dict[str, Any]:
        """Get cached dataset metadata, loading if necessary."""
        if self._metadata_cache is None:
            with self._lock:
                if self._metadata_cache is None:  # Double-check lock pattern
                    self._metadata_cache = self._load_all_metadata()
        return self._metadata_cache

    def invalidate(self, dataset_name: str = None):
        """Clear cached metadata and/or patient data."""
        with self._lock:
            if dataset_name:
                # Clear specific dataset
                self._patients_cache.pop(dataset_name, None)
                if self._metadata_cache is not None and dataset_name in self._metadata_cache:
                    # Reload all metadata to be safe
                    self._metadata_cache = None
            else:
                # Clear everything
                self._metadata_cache = None
                self._patients_cache = {}

    @staticmethod
    def _load_json_file(file_path: str) -> Any:
        """Load a single JSON file."""
        try:
            with open(file_path, 'r') as fp:
                return json.load(fp)
        except FileNotFoundError:
            logger.warning(f"File not found: {file_path}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            return None

    def _calculate_patient_count(self, dataset_dir: str) -> int:
        """Calculate patient count from dataset.json."""
        dataset_path = os.path.join(dataset_dir, "dataset.json")
        data = self._load_json_file(dataset_path)
        if data is None:
            return 0
        if isinstance(data, list):
            return len(data)
        return 0

    def _load_all_metadata(self) -> Dict[str, Any]:
        """Load all dataset metadata from disk."""
        logger.info("Loading dataset metadata from disk...")

        datasets = {}

        if not os.path.exists(DATASETS_DIR):
            os.makedirs(DATASETS_DIR, exist_ok=True)
            logger.info(f"Created datasets directory: {DATASETS_DIR}")
            return datasets

        for dataset_name in os.listdir(DATASETS_DIR):
            # Skip excluded datasets
            if dataset_name in EXCLUDED_DATASETS:
                logger.info(f"Skipping excluded dataset: {dataset_name}")
                continue

            dataset_path = os.path.join(DATASETS_DIR, dataset_name)
            if not os.path.isdir(dataset_path):
                continue

            metadata_path = os.path.join(dataset_path, "metadata.json")

            if not os.path.exists(metadata_path):
                logger.warning(f"No metadata.json found for dataset: {dataset_name}")
                continue

            try:
                metadata = self._load_json_file(metadata_path)
                if metadata is None:
                    continue

                # Validate required fields
                required_fields = ['name', 'owner', 'created_date']
                if not all(field in metadata for field in required_fields):
                    logger.warning(f"Dataset {dataset_name} missing required fields, skipping")
                    continue

                # Calculate patient count
                patient_count = self._calculate_patient_count(dataset_path)

                # Store metadata with patient count
                datasets[dataset_name] = {
                    "dataset_name": dataset_name,
                    "name": metadata.get("name"),
                    "owner": metadata.get("owner"),
                    "created_date": metadata.get("created_date"),
                    "last_modified_date": metadata.get("last_modified_date"),
                    "patient_count": patient_count
                }

            except Exception as e:
                logger.error(f"Error loading dataset metadata {dataset_name}: {e}")
                continue

        logger.info(f"Loaded {len(datasets)} datasets from disk")
        return datasets

    def get_dataset_metadata(self, dataset_name: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific dataset."""
        metadata = self.get_metadata_cache()
        return metadata.get(dataset_name)

    def get_dataset_patients(self, dataset_name: str) -> Optional[List[Dict[str, Any]]]:
        """Load and cache patient data for a specific dataset."""
        # Check if already cached
        if dataset_name in self._patients_cache:
            return self._patients_cache[dataset_name]

        # Load from disk
        with self._lock:
            if dataset_name not in self._patients_cache:  # Double-check lock pattern
                dataset_path = os.path.join(DATASETS_DIR, dataset_name, "dataset.json")
                patient_data = self._load_json_file(dataset_path)

                if patient_data is None or not isinstance(patient_data, list):
                    logger.error(f"Invalid or missing patient data for dataset: {dataset_name}")
                    return None

                self._patients_cache[dataset_name] = patient_data

        return self._patients_cache[dataset_name]

    def list_datasets(self) -> List[Dict[str, Any]]:
        """Get all datasets with summary information."""
        metadata = self.get_metadata_cache()

        dataset_list = []
        for dataset_name, dataset_data in metadata.items():
            dataset_list.append({
                "dataset_name": dataset_name,
                "name": dataset_data.get("name"),
                "owner": dataset_data.get("owner"),
                "patient_count": dataset_data.get("patient_count", 0),
                "created_date": dataset_data.get("created_date")
            })

        # Sort by created date (newest first)
        dataset_list.sort(
            key=lambda x: x.get("created_date", ""),
            reverse=True
        )

        return dataset_list

    def dataset_exists(self, dataset_name: str) -> bool:
        """Check if a dataset exists."""
        metadata = self.get_metadata_cache()
        return dataset_name in metadata


# Initialize the global cache instance
_cache = DatasetCache()


def list_datasets(current_user: str = None) -> List[Dict[str, Any]]:
    """Get all datasets with summary information, filtered by user access."""
    all_datasets = _cache.list_datasets()

    # No filtering if no user specified (backward compatibility)
    if not current_user:
        return all_datasets

    # Import here to avoid circular dependency
    from core.auth import permissions

    # Admin sees everything
    if permissions.is_admin(current_user):
        return all_datasets

    # Filter by allowed_datasets
    user = user_loader.get_user(current_user)
    if not user:
        return []

    allowed = set(user.get('allowed_datasets', []))
    return [d for d in all_datasets if d['dataset_name'] in allowed]


def get_dataset(dataset_name: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Get metadata for a specific dataset, with access validation."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_dataset_access(current_user, dataset_name):
            return None
    return _cache.get_dataset_metadata(dataset_name)


def get_dataset_patients(dataset_name: str, current_user: str = None) -> Optional[List[Dict[str, Any]]]:
    """Get patient data for a specific dataset, with access validation."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_dataset_access(current_user, dataset_name):
            return None
    return _cache.get_dataset_patients(dataset_name)


def dataset_exists(dataset_name: str) -> bool:
    """Check if a dataset exists."""
    return _cache.dataset_exists(dataset_name)


def invalidate_dataset_cache(dataset_name: str = None):
    """Force reload of dataset cache."""
    _cache.invalidate(dataset_name)


# Patient-level helper functions (for compatibility with existing API)

def create_encounter_summary(encounter: Dict[str, Any]) -> Dict[str, Any]:
    """Create a summary of an encounter with only metadata."""
    # Handle both old and new data structures for flowsheets
    flowsheet_data = encounter.get("flowsheets_raw", encounter.get("flowsheets", []))

    total_flowsheet_records = sum(
        len(group.get("records", []))
        for group in flowsheet_data
    )

    return {
        "csn": encounter.get("csn"),
        "metrics": {
            "flowsheet_count": total_flowsheet_records,
            "medication_count": len(encounter.get("medications", [])),
            "diagnosis_count": len(encounter.get("diagnoses", [])),
            "note_count": len(encounter.get("notes", []))
        }
    }


def create_patient_summary(patient: Dict[str, Any]) -> Dict[str, Any]:
    """Create a summary of a patient with only metadata."""
    return {
        "mrn": patient.get("mrn"),
        "sex": patient.get("sex"),
        "date_of_birth": patient.get("date_of_birth"),
        "encounters": [
            create_encounter_summary(enc)
            for enc in patient.get("encounters", [])
        ]
    }


def get_patient_dataset_summary(dataset_name: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Return lightweight summary of patients in a dataset, with access validation."""
    patients = get_dataset_patients(dataset_name, current_user)

    if not patients:
        return None

    # Get metadata to include the friendly name
    metadata = get_dataset(dataset_name, current_user)
    display_name = metadata.get("name", dataset_name) if metadata else dataset_name

    return {
        "status": "success",
        "data_source": dataset_name,
        "name": display_name,
        "total_patients": len(patients),
        "patients": [
            create_patient_summary(patient)
            for patient in patients
        ]
    }


def get_patient_details(mrn: str, dataset_name: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Return full details for single patient from specific dataset, with access validation."""
    patients = get_dataset_patients(dataset_name, current_user)

    if not patients:
        return None

    # Find the patient
    patient = next(
        (p for p in patients
         if str(p.get("mrn")) == str(mrn)),
        None
    )

    if not patient:
        return None

    return {
        "mrn": patient.get("mrn"),
        "sex": patient.get("sex"),
        "date_of_birth": patient.get("date_of_birth"),
        "encounters": patient.get("encounters", []),
        "summary": create_patient_summary(patient)
    }