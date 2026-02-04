from pydantic import BaseModel
from typing import Optional, List, Union, Any

class KeywordCountOutput(BaseModel):
    count: int
    formatted_text: str


class AnalyzeNoteWithSpanAndReasonOutput(BaseModel):
    flag_state: bool
    span: str
    reasoning: str

class FilterMedicationOutput(BaseModel):
    order_ids: List[int]