import sys

from core.dataloders.datasets_loader import get_dataset_patients
from core.workflow.tools.base import Tool
from core.workflow.schemas.tool_inputs import (
    GetDiagnosisIdsInput, ReadDiagnosisInput, HighlightDiagnosisInput
)
from core.workflow.schemas.tool_outputs import ReadDiagnosisOutput
import json
from typing import List, Dict, Any


class GetDiagnosisIds(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "get_diagnosis_ids"

    @property
    def description(self) -> str:
        return "Return a list of diagnosis IDs for a given patient MRN and CSN encounter."

    @property
    def display_name(self) -> str:
        return "Get Diagnosis IDs"

    @property
    def user_description(self) -> str:
        return "Return a list of diagnosis IDs for a given patient MRN and CSN encounter."

    @property
    def category(self) -> str:
        return "diagnosis"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "array",
            "items": {
                "type": "integer"
            },
            "description": "List of diagnosis IDs for the specified patient encounter"
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "mrn": {
                    "type": "integer",
                    "description": "Medical Record Number"
                },
                "csn": {
                    "type": "integer",
                    "description": "CSN encounter ID"
                }
            },
            "required": ["mrn", "csn"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: GetDiagnosisIdsInput) -> List[int]:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return [diagnosis['diagnosis_id'] for diagnosis in encounter.get('diagnoses', [])]
        return []

class ReadDiagnosis(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "read_diagnosis"

    @property
    def description(self) -> str:
        return "Return details about a specific diagnosis as a JSON string."

    @property
    def display_name(self) -> str:
        return "Read Diagnosis"

    @property
    def user_description(self) -> str:
        return "Return details about a specific diagnosis as a JSON string."

    @property
    def category(self) -> str:
        return "diagnosis"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "diagnosis_id": {"type": "integer", "description": "Unique diagnosis identifier"},
                "pat_id": {"type": "string", "description": "Patient identifier"},
                "dx_id": {"type": "integer", "description": "Diagnosis code identifier"},
                "diagnosis_name": {"type": "string", "description": "Name of the diagnosis"},
                "diagnosis_code": {"type": "string", "description": "Diagnosis code (e.g., ICD code)"},
                "code_set": {"type": "string", "description": "Code set used (e.g., ICD-10)"},
                "diagnosis_source": {"type": "string", "description": "Source of the diagnosis"},
                "date": {"type": "string", "description": "Diagnosis date"},
                "date_resolution": {"type": "string", "description": "Resolution of the date"},
                "date_description": {"type": "string", "description": "Description of the date"},
                "resolved_date": {"type": "string", "description": "Date the diagnosis was resolved"},
                "is_chronic": {"type": "boolean", "description": "Whether the diagnosis is chronic"},
                "etl_datetime": {"type": "string", "description": "ETL processing timestamp"},
            },
            "required": ["diagnosis_id"]
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "mrn": {
                    "type": "integer",
                    "description": "Medical Record Number"
                },
                "csn": {
                    "type": "integer",
                    "description": "CSN encounter ID"
                },
                "diagnosis_id": {
                    "type": "integer",
                    "description": "The specific diagnosis ID to retrieve"
                }
            },
            "required": ["mrn", "csn", "diagnosis_id"],
            "additionalProperties": False
        }

    def __call__(self, inputs: ReadDiagnosisInput) -> ReadDiagnosisOutput:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        # Find the specific diagnosis
                        for diagnosis in encounter.get('diagnoses', []):
                            if int(diagnosis['diagnosis_id']) == int(inputs.diagnosis_id):
                                return ReadDiagnosisOutput(**diagnosis)
        return ReadDiagnosisOutput()


class HighlightDiagnosis(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "highlight_diagnosis"

    @property
    def description(self) -> str:
        return "Highlight the diagnosis if the diagnosis is in the list of diagnoses you are searching for."

    @property
    def display_name(self) -> str:
        return "Highlight Diagnosis"

    @property
    def user_description(self) -> str:
        return "Highlight the diagnosis if the diagnosis is in the list of diagnoses you are searching for."

    @property
    def category(self) -> str:
        return "diagnosis"

    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "The diagnosis string if found, otherwise an empty string."
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "diagnosis_name": {
                    "type": "string",
                    "description": "The diagnosis to search for."
                },
                "diagnoses_list": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of diagnosis names to search within."
                }
            },
            "required": ["diagnosis_name", "diagnoses_list"],
            "additionalProperties": False
        }

    def __call__(self, inputs: HighlightDiagnosisInput) -> str:
        if inputs.diagnosis_name in inputs.diagnoses_list:
            return inputs.diagnosis_name
        return ""