from core.dataloders.datasets_loader import get_dataset_patients
from core.llm_lib.supervisor_worker_network.tools.base import Tool
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
    GetMedicationsIdsInput, ReadMedicationInput, HighlightMedicationInput
)
import json
from typing import List, Dict, Any

class GetMedicationsIds(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "get_medications_ids"
    
    @property
    def description(self) -> str:
        return "Return a list of medication order IDs for a given patient MRN and CSN encounter."

    @property
    def category(self) -> str:
        return "medications"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "list",
            "items": {
                "type": "int"
            }
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
    
    def __call__(self, inputs: GetMedicationsIdsInput) -> List[int]:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return [med['order_id'] for med in encounter['medications'] if med.get('order_id') is not None]
        return []

class ReadMedication(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "read_medication"
    
    @property
    def description(self) -> str:
        return "Return details about a specific medication as a JSON string."
    
    @property
    def category(self) -> str:
        return "medications"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "JSON string containing the full medication record."
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
                "order_id": {
                    "type": "integer",
                    "description": "The specific medication order ID to retrieve"
                }
            },
            "required": ["mrn", "csn", "order_id"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: ReadMedicationInput) -> str:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        # Find the specific medication
                        for medication in encounter['medications']:
                            if medication.get('order_id') and int(medication['order_id']) == int(inputs.order_id):
                                return json.dumps(medication)
        return "{}"


class HighlightMedication(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "highlight_medication"

    @property
    def description(self) -> str:
        return "Highlight the medication if the medication is in the list of medications you are searching for."

    @property
    def category(self) -> str:
        return "medications"

    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "The medication string if found, otherwise an empty string."
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "medication_name": {
                    "type": "string",
                    "description": "The medication to search for."
                },
                "medications_list": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of medication names to search within."
                }
            },
            "required": ["medication_name", "medications_list"],
            "additionalProperties": False
        }

    def __call__(self, inputs: HighlightMedicationInput) -> str:
        if inputs.medication_name in inputs.medications_list:
            return inputs.medication_name
        return ""
