from __future__ import annotations
from typing import Any, Dict, List, Optional, Literal, Union, Annotated
from pydantic import BaseModel, Field, ConfigDict
from core.workflow.schemas.output_schemas import OutputDefinition

# Input models are now colocated in tool files
from core.workflow.tools.notes import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput,
    AnalyzeNoteWithSpanAndReasonInput, SemanticKeywordCountInput, ExactKeywordCountInput
)
from core.workflow.tools.flowsheets import (
    ReadFlowsheetsTableInput, SummarizeFlowsheetsTableInput, AnalyzeFlowsheetInstanceInput
)
from core.workflow.tools.medications import (
    GetMedicationsIdsInput, ReadMedicationInput, FilterMedicationInput, HighlightMedicationInput
)
from core.workflow.tools.diagnosis import (
    GetDiagnosisIdsInput, ReadDiagnosisInput, HighlightDiagnosisInput
)
from core.workflow.tools.variable_management import (
    InitStoreInput, StoreAppendInput, StoreReadInput, BuildTextInput
)

ToolInput = Union[
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput,
    AnalyzeNoteWithSpanAndReasonInput, ReadFlowsheetsTableInput,
    SummarizeFlowsheetsTableInput, GetMedicationsIdsInput, ReadMedicationInput,
    FilterMedicationInput, HighlightMedicationInput,
    GetDiagnosisIdsInput, ReadDiagnosisInput, HighlightDiagnosisInput,
    SemanticKeywordCountInput, ExactKeywordCountInput, AnalyzeFlowsheetInstanceInput,
    # Variable Management
    InitStoreInput, StoreAppendInput, StoreReadInput, BuildTextInput
]

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
    model_config = ConfigDict(extra="forbid")  # <- blocks unknown keys
    id: str
    step_summary: str

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
    # otherwise: List["Step"] = Field(default_factory=list)

AdvancedSteps = Union[ToolStep, IfStep]

class LoopStep(BaseStep):
    type: Literal["loop"] = "loop"
    for_var: str = Field(alias="for")
    in_expr: str = Field(alias="in")
    body: List[AdvancedSteps]
    output_dict: Optional[str] = None

# Discriminated-union with the "type" field
AllSteps = Union[ToolStep, IfStep, LoopStep]

# ---------- The Workflow ----------
class Workflow(BaseModel):
    steps: List[AllSteps]
    output_definitions: List[OutputDefinition] = []
