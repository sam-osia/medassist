from pydantic import BaseModel
from typing import Optional

class KeywordCountOutput(BaseModel):
    count: int
    formatted_text: str

class IdentifyFlagOutput(BaseModel):
    flag_state: bool
    formatted_text: str

class AnalyzeNoteWithSpanAndReasonOutput(BaseModel):
    flag_state: bool
    span: str
    reasoning: str

class FilterMedicationOutput(BaseModel):
    pandas_expression: str
    explanation: Optional[str] = None