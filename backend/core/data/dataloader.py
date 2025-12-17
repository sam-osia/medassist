import json
import logging
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from threading import Lock
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configuration
DATASET_BASE_PATH = os.getenv("DATASET_BASE_PATH", "/home/saman/delirium/backend/dataset")
DATASETS = {
    # "SickKids ICU": str(Path(DATASET_BASE_PATH) / "patient_mock.json"),
    # "SDoH": str(Path(DATASET_BASE_PATH) / "sdoh_parsed.json"),
    "SDoH Demo": str(Path(DATASET_BASE_PATH) / "sdoh_parsed_demo.json"),
    "SickKids Demo": str(Path(DATASET_BASE_PATH) / "sk_demo.json"),
}

class DatasetCache:
    """Thread-safe singleton cache for multiple patient datasets."""
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
                self._datasets = {}  # Will store all loaded datasets
                self._initialized = True
    
    def get_data(self, dataset_name: str = None) -> Optional[Dict[str, Any]]:
        """Get cached dataset by name, loading it if necessary."""
        if dataset_name is None:
            # Return all datasets
            return self._load_all_datasets()
            
        if dataset_name not in self._datasets:
            with self._lock:
                if dataset_name not in self._datasets:  # Double-check lock pattern
                    self._datasets[dataset_name] = self._load_single_dataset(dataset_name)
        return self._datasets[dataset_name]
    
    def invalidate(self, dataset_name: str = None):
        """Clear cached dataset(s)."""
        with self._lock:
            if dataset_name:
                self._datasets.pop(dataset_name, None)
            else:
                self._datasets = {}
    
    @staticmethod
    def _load_json_file(file_path: str) -> List[Dict[str, Any]]:
        """Load a single JSON file containing patient blobs."""
        try:
            with open(file_path, 'r') as fp:
                return json.load(fp)
        except FileNotFoundError:
            logger.warning(f"File not found: {file_path}")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            return []

    def _load_single_dataset(self, dataset_name: str) -> Dict[str, Any]:
        """Load a single dataset by name."""
        if dataset_name not in DATASETS:
            logger.error(f"Dataset '{dataset_name}' not found in configuration")
            return {
                "status": "error",
                "data_source": dataset_name,
                "total_patients": 0,
                "patients": []
            }
        
        file_path = DATASETS[dataset_name]
        logger.info(f"Loading dataset '{dataset_name}' from {file_path}")
        patient_blobs = self._load_json_file(file_path)
        
        return {
            "status": "success",
            "data_source": dataset_name,
            "total_patients": len(patient_blobs),
            "patients": patient_blobs
        }
    
    def _load_all_datasets(self) -> Dict[str, Any]:
        """Load all configured datasets."""
        datasets = {}
        available_datasets = list(DATASETS.keys())
        
        for dataset_name in available_datasets:
            if dataset_name not in self._datasets:
                self._datasets[dataset_name] = self._load_single_dataset(dataset_name)
            datasets[dataset_name] = self._datasets[dataset_name]
        
        return {
            "available_datasets": available_datasets,
            "datasets": datasets
        }


# Initialize the global cache instance
_cache = DatasetCache()


def get_patient_dataset(dataset_name: str = None) -> Dict[str, Any]:
    """Get patient dataset from cache. If dataset_name is None, returns all datasets."""
    return _cache.get_data(dataset_name)


def get_available_datasets() -> List[str]:
    """Get list of available dataset names."""
    return list(DATASETS.keys())


def create_encounter_summary(encounter: Dict[str, Any]) -> Dict[str, Any]:
    """Create a summary of an encounter with only metadata."""
    # Handle both old and new data structures for flowsheets
    # Try new structure first (flowsheets_raw), then fall back to old structure (flowsheets)
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

def get_patient_dataset_summary(dataset_name: str = None) -> Dict[str, Any]:
    """Return lightweight summary. If dataset_name is None, returns all datasets with summaries."""
    if dataset_name is None:
        # Return all datasets with their summaries
        all_data = get_patient_dataset()
        if "available_datasets" not in all_data:
            return {"error": "No datasets available"}
            
        summaries = {}
        for ds_name in all_data["available_datasets"]:
            dataset = all_data["datasets"][ds_name]
            if dataset.get("patients"):
                summaries[ds_name] = {
                    "status": dataset["status"],
                    "data_source": dataset["data_source"],
                    "total_patients": dataset["total_patients"],
                    "patients": [
                        create_patient_summary(patient)
                        for patient in dataset["patients"]
                    ]
                }
            else:
                summaries[ds_name] = dataset
        
        return {
            "available_datasets": all_data["available_datasets"],
            "datasets": summaries
        }
    else:
        # Return specific dataset summary
        dataset = get_patient_dataset(dataset_name)
        
        if not dataset.get("patients"):
            return dataset
        
        return {
            "status": dataset["status"],
            "data_source": dataset["data_source"],
            "total_patients": dataset["total_patients"],
            "patients": [
                create_patient_summary(patient)
                for patient in dataset["patients"]
            ]
        }


def get_patient_details(mrn: str, dataset_name: str) -> Optional[Dict[str, Any]]:
    """Return full details for single patient from specific dataset."""
    dataset = get_patient_dataset(dataset_name)
    
    if not dataset or "patients" not in dataset:
        return None
    
    # Find the patient
    patient = next(
        (p for p in dataset.get("patients", []) 
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


def reload_dataset(dataset_name: str = None):
    """Force reload of dataset(s) from disk."""
    _cache.invalidate(dataset_name)
    return get_patient_dataset(dataset_name)
