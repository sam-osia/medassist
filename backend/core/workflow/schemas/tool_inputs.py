from pydantic import BaseModel
from typing import Any, Optional, Literal, Union, List


# Prompt Input
class ExamplePair(BaseModel):
    user_input: str
    assistant_response: str

class PromptInput(BaseModel):
    system_prompt: str
    user_prompt: str
    examples: Optional[List[ExamplePair]] = None

# Notes Tool Models
class GetPatientNotesIdsInput(BaseModel):
    mrn: int
    csn: int
    
class ReadPatientNoteInput(BaseModel):
    mrn: int
    csn: int
    note_id: Union[int, str]

class SummarizePatientNoteInput(BaseModel):
    note: str
    criteria: Optional[str] = None


class AnalyzeNoteWithSpanAndReasonInput(BaseModel):
    note: str
    prompt: Optional[PromptInput] = None

# Keyword Count Tool Models
class KeywordCountInput(BaseModel):
    text: str
    keywords: List[str]


# Flowsheets Tool Models
class ReadFlowsheetsTableInput(BaseModel):
    mrn: int
    csn: int

class SummarizeFlowsheetsTableInput(BaseModel):
    flowsheets_table: str

class AnalyzeFlowsheetInstanceInput(BaseModel):
    flowsheet_instance: str
    sensory_deficit: bool = False
    motor_deficit: bool = False
    developmental_delay: bool = False

# Medications Tool Models
class GetMedicationsIdsInput(BaseModel):
    mrn: int
    csn: int

class ReadMedicationInput(BaseModel):
    mrn: int
    csn: int
    order_id: int

class HighlightMedicationInput(BaseModel):
    medication_name: str
    medications_list: List[str]

class FilterMedicationInput(BaseModel):
    mrn: int
    csn: int
    prompt: str

# Diagnosis Tool Models
class GetDiagnosisIdsInput(BaseModel):
    mrn: int
    csn: int

class ReadDiagnosisInput(BaseModel):
    mrn: int
    csn: int
    diagnosis_id: Union[int, str]

class HighlightDiagnosisInput(BaseModel):
    diagnosis_name: str
    diagnoses_list: List[str]


# Variable Management Tool Models
class InitStoreInput(BaseModel):
    """Input for init_store tool - creates an empty store."""
    name: str  # Store identifier
    type: Literal["list", "text", "dict"]


class StoreAppendInput(BaseModel):
    """Input for store_append tool - adds value to a store."""
    store: str  # Store name
    value: Any  # Value to add
    key: Optional[str] = None  # Required for dict type
    separator: str = "\n"  # For text type only


class StoreReadInput(BaseModel):
    """Input for store_read tool - retrieves store contents."""
    store: str  # Store name
    key: Optional[str] = None  # For dict: get specific key


class BuildTextInput(BaseModel):
    """Input for build_text tool - formats data into text."""
    source: Any  # Store name or direct list/dict value
    mode: Literal["join"] = "join"  # Simple formatting mode
    template: Optional[str] = None  # Jinja2 template (overrides mode)
    separator: str = "\n"  # For join mode