from pydantic import BaseModel
from typing import Optional, Literal, Union, List


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

class HighlightPatientNoteInput(BaseModel):
    note: str
    criteria: str
    prompt: PromptInput

class AnalyzeNoteWithSpanAndReasonInput(BaseModel):
    note:str
    prompt: PromptInput

# Keyword Count Tool Models
class KeywordCountInput(BaseModel):
    text: str
    keywords: List[str]

# Identify Flag Tool Models
class IdentifyFlagInput(BaseModel):
    text: str
    criteria: str

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