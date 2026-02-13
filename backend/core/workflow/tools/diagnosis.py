import sys

from pydantic import BaseModel, Field

from core.dataloaders.datasets_loader import get_dataset_patients
from core.workflow.tools.base import Tool, ToolCallMeta
import json
from typing import List, Dict, Any, Optional, Union


# ── Input Models ──────────────────────────────────────────────

class GetDiagnosisIdsInput(BaseModel):
    mrn: int = Field(description="Medical Record Number")
    csn: int = Field(description="CSN encounter ID")


class ReadDiagnosisInput(BaseModel):
    mrn: int = Field(description="Medical Record Number")
    csn: int = Field(description="CSN encounter ID")
    diagnosis_id: Union[int, str] = Field(description="The specific diagnosis ID to retrieve")


class HighlightDiagnosisInput(BaseModel):
    diagnosis_name: str = Field(description="The diagnosis to search for.")
    diagnoses_list: List[str] = Field(description="List of diagnosis names to search within.")


# ── Output Models ─────────────────────────────────────────────

class ReadDiagnosisOutput(BaseModel):
    diagnosis_id: Optional[int] = None
    pat_id: Optional[str] = None
    dx_id: Optional[int] = None
    diagnosis_name: Optional[str] = None
    diagnosis_code: Optional[str] = None
    code_set: Optional[str] = None
    diagnosis_source: Optional[str] = None
    date: Optional[str] = None
    date_resolution: Optional[str] = None
    date_description: Optional[str] = None
    resolved_date: Optional[str] = None
    is_chronic: Optional[bool] = None
    etl_datetime: Optional[str] = None


# ── Tool Classes ──────────────────────────────────────────────

class GetDiagnosisIds(Tool):
    Input = GetDiagnosisIdsInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "get_diagnosis_ids"

    @property
    def role(self) -> str:
        return "reader"

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

    def _returns_schema(self) -> dict:
        return {
            "type": "array",
            "items": {"type": "integer"},
            "description": "List of diagnosis IDs for the specified patient encounter"
        }

    def __call__(self, inputs: GetDiagnosisIdsInput):
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return [diagnosis['diagnosis_id'] for diagnosis in encounter.get('diagnoses', [])], ToolCallMeta()
        return [], ToolCallMeta()

class ReadDiagnosis(Tool):
    Input = ReadDiagnosisInput
    Output = ReadDiagnosisOutput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "read_diagnosis"

    @property
    def role(self) -> str:
        return "reader"

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

    def __call__(self, inputs: ReadDiagnosisInput):
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        # Find the specific diagnosis
                        for diagnosis in encounter.get('diagnoses', []):
                            if int(diagnosis['diagnosis_id']) == int(inputs.diagnosis_id):
                                return ReadDiagnosisOutput(**diagnosis), ToolCallMeta()
        return ReadDiagnosisOutput(), ToolCallMeta()


class HighlightDiagnosis(Tool):
    Input = HighlightDiagnosisInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
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

    def _returns_schema(self) -> dict:
        return {
            "type": "string",
            "description": "The diagnosis string if found, otherwise an empty string."
        }

    def __call__(self, inputs: HighlightDiagnosisInput):
        if inputs.diagnosis_name in inputs.diagnoses_list:
            return inputs.diagnosis_name, ToolCallMeta()
        return "", ToolCallMeta()
