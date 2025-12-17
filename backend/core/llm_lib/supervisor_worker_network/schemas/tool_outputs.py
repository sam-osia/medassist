from pydantic import BaseModel

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