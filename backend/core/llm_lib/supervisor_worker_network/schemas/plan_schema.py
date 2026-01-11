from __future__ import annotations
from typing import Any, Dict, List, Optional, Literal, Union, Annotated
from pydantic import BaseModel, Field, ConfigDict

# Note: ToolInput types are imported for reference but inputs accept Dict[str, Any]
# since plans contain template strings like {{mrn}} that are resolved at execution time
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput, 
    HighlightPatientNoteInput, AnalyzeNoteWithSpanAndReasonInput,
    ReadFlowsheetsTableInput, SummarizeFlowsheetsTableInput, GetMedicationsIdsInput,
    ReadMedicationInput, GetDiagnosisIdsInput, ReadDiagnosisInput,
    KeywordCountInput, IdentifyFlagInput, AnalyzeFlowsheetInstanceInput
)

# ToolInput union for strict validation at execution time (after template resolution)
ToolInputStrict = Union[
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput, 
    HighlightPatientNoteInput, AnalyzeNoteWithSpanAndReasonInput, ReadFlowsheetsTableInput,
    SummarizeFlowsheetsTableInput, GetMedicationsIdsInput, ReadMedicationInput,
    GetDiagnosisIdsInput, ReadDiagnosisInput, KeywordCountInput, IdentifyFlagInput,
    AnalyzeFlowsheetInstanceInput
]

# ToolInput for plans - accepts Dict since it may contain template strings
ToolInput = Dict[str, Any]

# ---------- Condition Types ----------
class SimpleCondition(BaseModel):
    """Simple boolean expression as string (e.g., 'note_id != 0')"""
    type: Literal["expression"] = "expression"
    expression: str

class ComparisonCondition(BaseModel):
    """Structured comparison condition"""
    type: Literal["comparison"] = "comparison"
    left: str  # Variable or expression (e.g., "note_id", "note_ids|length")
    operator: Literal["==", "!=", "<", "<=", ">", ">=", "in", "not in"]
    right: Union[str, int, float, bool]  # Value or variable reference

class LogicalCondition(BaseModel):
    """Logical combination of conditions"""
    type: Literal["logical"] = "logical"
    operator: Literal["and", "or", "not"]
    conditions: List["Condition"]

# Union type for all condition types
Condition = Union[SimpleCondition, ComparisonCondition, LogicalCondition]

# Update forward reference for LogicalCondition
LogicalCondition.model_rebuild()

# ---------- Step Variants ----------
class BaseStep(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)  # Allow both alias and field name
    id: str
    step_summary: str
    # Optional metadata fields from intermediate planning steps
    notes: Optional[str] = None
    reasoning: Optional[str] = None

class ToolStep(BaseStep):
    type: Literal["tool"] = "tool"
    tool: str
    inputs: ToolInput
    output: str

BasicStep = Union[ToolStep]

class IfStep(BaseStep):
    type: Literal["if"] = "if"
    condition: Condition
    then: BasicStep
    otherwise: Optional[List["AllSteps"]] = None

AdvancedSteps = Union[ToolStep, IfStep]

class LoopStep(BaseStep):
    type: Literal["loop"] = "loop"
    for_var: str = Field(alias="for")
    in_expr: str = Field(alias="in")
    body: List[AdvancedSteps]
    output_dict: Optional[str] = None

class FlagVariableStep(BaseStep):
    type: Literal["flag_variable"] = "flag_variable"
    variable: str
    value: bool

# Discriminated‑union with the "type" field
AllSteps = Union[ToolStep, IfStep, LoopStep, FlagVariableStep]

# ---------- The Plan ----------
class Plan(BaseModel):
    """Final plan schema with fully-formed steps.
    
    All required fields must be populated for execution.
    This is the output of the planning agent after all stages complete.
    
    Use plan_verifier.verify_plan() to validate before execution.
    """
AllSteps = Union[ToolStep, IfStep, LoopStep, FlagVariableStep]

# ---------- The Plan ----------
class Plan(BaseModel):
    """Final plan schema with fully-formed steps.
    
    All required fields must be populated for execution.
    This is the output of the planning agent after all stages complete.
    """
    steps: List[AllSteps]
