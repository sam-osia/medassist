"""Agent input/output schemas for workflow agent system."""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Literal

from core.workflow.schemas.workflow_schema import Workflow


class GeneratorInput(BaseModel):
    """Input for the generator agent."""
    task_description: str
    tool_specs: Dict[str, Any]
    patient_context: Dict[str, int]  # {mrn, csn}


class GeneratorOutput(BaseModel):
    """Output from the generator agent."""
    workflow: Optional[Workflow] = None
    success: bool
    error_message: Optional[str] = None


class EditorInput(BaseModel):
    """Input for the editor agent."""
    current_workflow: Workflow
    edit_request: str
    tool_specs: Dict[str, Any]


class EditorOutput(BaseModel):
    """Output from the editor agent."""
    workflow: Optional[Workflow] = None
    success: bool
    error_message: Optional[str] = None


class ChunkOperatorInput(BaseModel):
    """Input for the chunk operator agent."""
    current_workflow: Workflow
    operation: Literal["insert", "append", "remove"]
    description: str
    tool_specs: Dict[str, Any]


class ChunkOperatorOutput(BaseModel):
    """Output from the chunk operator agent."""
    workflow: Optional[Workflow] = None
    success: bool
    error_message: Optional[str] = None


class ValidatorInput(BaseModel):
    """Input for the validator agent."""
    workflow: Workflow


class ValidatorOutput(BaseModel):
    """Output from the validator agent."""
    valid: bool
    broken_step_id: Optional[str] = None
    broken_reason: Optional[str] = None


class PromptFillerInput(BaseModel):
    """Input for the prompt filler agent."""
    workflow: Workflow
    user_intent: str
    prompt_guides: Dict[str, str]  # tool_name -> guide text


class PromptFillerOutput(BaseModel):
    """Output from the prompt filler agent."""
    workflow: Workflow
    success: bool
    error_message: Optional[str] = None


class SummarizerInput(BaseModel):
    """Input for the summarizer agent."""
    workflow: Workflow


class SummarizerOutput(BaseModel):
    """Output from the summarizer agent."""
    summary: str


class ClarifierInput(BaseModel):
    """Input for the clarifier agent."""
    user_request: str
    tool_specs: Dict[str, Any]
    current_workflow: Optional[Workflow] = None


class ClarifierOutput(BaseModel):
    """Output from the clarifier agent."""
    ready: bool
    questions: List[str] = []
    out_of_scope: bool = False
    out_of_scope_reason: Optional[str] = None


class OutputDefinitionInput(BaseModel):
    """Input for the output definition agent."""
    workflow: Workflow  # Plan with steps (may have empty output_definitions)
    user_intent: str    # Original user request for context


class OutputDefinitionOutput(BaseModel):
    """Output from the output definition agent."""
    workflow: Optional[Workflow] = None  # Plan with output_definitions and output_mappings filled
    success: bool
    error_message: Optional[str] = None
