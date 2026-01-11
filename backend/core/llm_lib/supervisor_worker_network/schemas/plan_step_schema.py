"""
Plan Step Schema - Intermediate schema for planning agent workflow.

This schema is used during the planning agent's intermediate steps:
  1. orchestrator decides tools
  2. generator generates/edits plan
  3. summarizer summarizes sections
  4. inputs determines tool inputs
  
Unlike the final Plan schema, this allows for partial/incomplete steps
since they are still being refined. Compatible with final plan_schema for conversion.
"""

from __future__ import annotations
import json
from typing import Any, Dict, List, Optional, Literal, Union
from pydantic import BaseModel, Field, ConfigDict
from core.llm_lib.supervisor_worker_network.schemas.plan_schema import (
    SimpleCondition, ComparisonCondition, LogicalCondition, Condition
)


# ---------- Intermediate Step Variants ----------
# These use optional fields to allow work-in-progress steps
# Compatible with final plan_schema BaseStep structure

class IntermediateBaseStep(BaseModel):
    """Base step with optional fields for work-in-progress steps.
    
    Compatible with final schema's BaseStep - same required fields,
    plus additional optional metadata.
    """
    model_config = ConfigDict(extra="forbid", populate_by_name=True)  # Allow both alias and field name
    id: str
    step_summary: str
    notes: Optional[str] = None  # Planning notes
    reasoning: Optional[str] = None  # Agent reasoning


class IntermediateToolStep(IntermediateBaseStep):
    """Tool step that may not have full inputs yet.
    
    Compatible with final ToolStep but allows optional inputs/output.
    """
    type: Literal["tool"] = "tool"
    tool: str
    inputs: Optional[Dict[str, Any]] = None  # Will be Dict[str, Any] during planning, ToolInput in final
    output: Optional[str] = None  # Added during execution


class IntermediateIfStep(IntermediateBaseStep):
    """If statement that may be incomplete.
    
    Compatible with final IfStep but allows optional condition/then.
    """
    type: Literal["if"] = "if"
    condition: Optional[Condition] = None
    then: Optional["IntermediateStep"] = None
    otherwise: Optional[List["IntermediateStep"]] = None


class IntermediateLoopStep(IntermediateBaseStep):
    """Loop step that may be incomplete.
    
    Compatible with final LoopStep but allows optional for_var/in_expr/body.
    """
    type: Literal["loop"] = "loop"
    for_var: Optional[str] = Field(default=None, alias="for")
    in_expr: Optional[str] = Field(default=None, alias="in")
    body: Optional[List["IntermediateStep"]] = None
    output_dict: Optional[str] = None


class IntermediateFlagVariableStep(IntermediateBaseStep):
    """Flag variable step - same as final schema."""
    type: Literal["flag_variable"] = "flag_variable"
    variable: str
    value: bool


# Intermediate steps union - more flexible than final steps
IntermediateStep = Union[
    IntermediateToolStep,
    IntermediateIfStep,
    IntermediateLoopStep,
    IntermediateFlagVariableStep
]


# ---------- Intermediate Plan ----------
class IntermediatePlan(BaseModel):
    """Work-in-progress plan during agent planning workflow.
    
    This is used during intermediate steps and allows for partial/incomplete steps.
    Once planning is complete, convert to final Plan schema using to_final_plan().
    
    Attributes:
        steps: List of intermediate steps (may be incomplete)
        planning_stage: Current stage in the planning workflow
        context: Dynamic variables discovered during planning
        reasoning: Overall planning reasoning/notes
    """
    steps: List[IntermediateStep]
    
    planning_stage: Literal[
        "initial",
        "orchestration",
        "generation",
        "summarization",
        "input_determination",
        "complete"
    ] = "initial"
    
    context: Optional[Dict[str, Any]] = None
    reasoning: Optional[str] = None
    
    def is_complete(self) -> bool:
        """Check if all steps have required fields filled in.
        
        Returns True if plan can be converted to final schema, False otherwise.
        """
        for step in self.steps:
            if isinstance(step, IntermediateToolStep):
                if step.inputs is None or step.output is None:
                    return False
            elif isinstance(step, IntermediateIfStep):
                if step.condition is None or step.then is None:
                    return False
            elif isinstance(step, IntermediateLoopStep):
                if step.for_var is None or step.in_expr is None or step.body is None:
                    return False
        return True
    
    def to_final_plan(self):
        """Convert to final Plan schema.
        
        Raises:
            ValueError: If plan is not complete (missing required fields)
        
        Returns:
            Plan: Final plan schema ready for execution
        """
        from core.llm_lib.supervisor_worker_network.schemas.plan_schema import (
            Plan, ToolStep, IfStep, LoopStep, FlagVariableStep, AllSteps
        )
        
        if not self.is_complete():
            raise ValueError(
                "Cannot convert incomplete plan to final schema. "
                "All steps must have required fields populated."
            )
        
        def convert_step(step: IntermediateStep) -> AllSteps:
            """Convert intermediate step to final step."""
            if isinstance(step, IntermediateToolStep):
                # Keep inputs as dict - ToolInput is Dict[str, Any]
                return ToolStep(
                    id=step.id,
                    step_summary=step.step_summary,
                    notes=step.notes,
                    reasoning=step.reasoning,
                    type="tool",
                    tool=step.tool,
                    inputs=step.inputs if step.inputs else {},
                    output=step.output  # type: ignore
                )
            elif isinstance(step, IntermediateIfStep):
                return IfStep(
                    id=step.id,
                    step_summary=step.step_summary,
                    notes=step.notes,
                    reasoning=step.reasoning,
                    type="if",
                    condition=step.condition,
                    then=convert_step(step.then),  # type: ignore
                    otherwise=[convert_step(s) for s in step.otherwise] if step.otherwise else None
                )
            elif isinstance(step, IntermediateLoopStep):
                return LoopStep(
                    id=step.id,
                    step_summary=step.step_summary,
                    notes=step.notes,
                    reasoning=step.reasoning,
                    type="loop",
                    for_var=step.for_var,  # type: ignore
                    in_expr=step.in_expr,  # type: ignore
                    body=[convert_step(s) for s in step.body],  # type: ignore
                    output_dict=step.output_dict
                )
            elif isinstance(step, IntermediateFlagVariableStep):
                return FlagVariableStep(
                    id=step.id,
                    step_summary=step.step_summary,
                    notes=step.notes,
                    reasoning=step.reasoning,
                    type="flag_variable",
                    variable=step.variable,
                    value=step.value
                )
            else:
                raise ValueError(f"Unknown step type: {type(step)}")
        
        converted_steps = [convert_step(step) for step in self.steps]
        return Plan(steps=converted_steps)


# ---------- Planning Agent Messages/States ----------
class OrchestratorDecision(BaseModel):
    """Decision from orchestrator about which tools to use next"""
    reasoning: str
    next_tools: List[str]
    current_step_id: str


class GeneratorUpdate(BaseModel):
    """Update from generator adding/editing steps"""
    action: Literal["add", "edit", "remove", "reorder"]
    affected_step_id: Optional[str] = None
    new_steps: Optional[List[IntermediateStep]] = None
    replacement_step: Optional[IntermediateStep] = None
    updated_plan: IntermediatePlan


class SummarizerOutput(BaseModel):
    """Output from summarizer"""
    section_id: str
    summary: str
    key_points: List[str]
    updated_plan: IntermediatePlan


class InputDeterminationOutput(BaseModel):
    """Output from input determination stage"""
    step_id: str
    tool: str
    inputs: Dict[str, Any]
    confidence: float
    updated_plan: IntermediatePlan
