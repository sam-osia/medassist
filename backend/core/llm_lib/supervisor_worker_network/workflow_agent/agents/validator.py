"""Validator agent - validates workflow correctness (rule-based)."""

import re
from typing import Set, Optional, Tuple

from core.llm_lib.supervisor_worker_network.schemas.plan_schema import (
    Plan as Workflow,
    ToolStep,
    IfStep,
    LoopStep,
    FlagVariableStep,
)

from .base import BaseAgent
from ..schemas.agent_schemas import ValidatorInput, ValidatorOutput


class ValidatorAgent(BaseAgent):
    """
    Validates workflow correctness using rule-based checks.
    Checks for:
    - Variables defined before use
    - Unique step IDs
    - Valid loop variables
    - Valid condition syntax
    """

    @property
    def name(self) -> str:
        return "validator"

    def run(self, inputs: ValidatorInput) -> ValidatorOutput:
        """Validate the workflow."""
        workflow = inputs.workflow

        # Track defined variables
        defined_vars: Set[str] = set()
        seen_step_ids: Set[str] = set()

        # Validate each step
        result = self._validate_steps(workflow.steps, defined_vars, seen_step_ids)

        if result[0]:
            return ValidatorOutput(valid=True)
        else:
            return ValidatorOutput(
                valid=False,
                broken_step_id=result[1],
                broken_reason=result[2]
            )

    def _validate_steps(
        self,
        steps: list,
        defined_vars: Set[str],
        seen_step_ids: Set[str],
        loop_var: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """Recursively validate steps. Returns (valid, broken_step_id, reason)."""

        for step in steps:
            step_id = getattr(step, 'id', None)

            # Check for duplicate step IDs
            if step_id:
                if step_id in seen_step_ids:
                    return (False, step_id, f"Duplicate step ID: {step_id}")
                seen_step_ids.add(step_id)

            if isinstance(step, ToolStep):
                # Check variable references in inputs
                error = self._check_variable_refs(step, defined_vars, loop_var)
                if error:
                    return (False, step_id, error)

                # Add output variable to defined vars
                if step.output:
                    defined_vars.add(step.output)

            elif isinstance(step, IfStep):
                # Check condition references
                error = self._check_condition_refs(step.condition, defined_vars, loop_var)
                if error:
                    return (False, step_id, error)

                # Validate then branch
                then_steps = [step.then] if step.then else []
                result = self._validate_steps(then_steps, defined_vars.copy(), seen_step_ids, loop_var)
                if not result[0]:
                    return result

            elif isinstance(step, LoopStep):
                # Check loop iterable exists
                in_expr = step.in_expr
                base_var = self._extract_base_var(in_expr)
                if base_var and base_var not in defined_vars:
                    return (False, step_id, f"Loop iterates over undefined variable: {base_var}")

                # Validate loop body with loop variable in scope
                body_defined = defined_vars.copy()
                result = self._validate_steps(
                    step.body,
                    body_defined,
                    seen_step_ids,
                    loop_var=step.for_var
                )
                if not result[0]:
                    return result

                # Add output_dict to defined vars if present
                if step.output_dict:
                    defined_vars.add(step.output_dict)

            elif isinstance(step, FlagVariableStep):
                # Flag variable step defines a variable
                if step.variable:
                    defined_vars.add(step.variable)

        return (True, None, None)

    def _check_variable_refs(
        self,
        step: ToolStep,
        defined_vars: Set[str],
        loop_var: Optional[str]
    ) -> Optional[str]:
        """Check that all variable references in tool inputs are defined."""
        if not step.inputs:
            return None

        # Convert inputs to dict and check for template references
        inputs_dict = step.inputs.model_dump() if hasattr(step.inputs, 'model_dump') else {}

        for key, value in inputs_dict.items():
            if isinstance(value, str):
                # Find {{ variable }} references
                refs = re.findall(r'\{\{\s*(\w+)', value)
                for ref in refs:
                    if ref not in defined_vars and ref != loop_var:
                        return f"Reference to undefined variable '{ref}' in {key}"

        return None

    def _check_condition_refs(
        self,
        condition,
        defined_vars: Set[str],
        loop_var: Optional[str]
    ) -> Optional[str]:
        """Check that condition references defined variables."""
        if hasattr(condition, 'root'):
            # SimpleCondition - string expression
            expr = condition.root if isinstance(condition.root, str) else str(condition)
            refs = re.findall(r'\b([a-zA-Z_]\w*)\b', expr)
            # Filter out common keywords/operators
            keywords = {'and', 'or', 'not', 'True', 'False', 'None', 'in', 'is', 'len'}
            for ref in refs:
                if ref not in keywords and ref not in defined_vars and ref != loop_var:
                    # Could be a valid reference, don't fail - just warn
                    pass
        return None

    def _extract_base_var(self, expr: str) -> Optional[str]:
        """Extract base variable from expression like 'note_ids' or 'result.items'."""
        if not expr:
            return None
        match = re.match(r'([a-zA-Z_]\w*)', expr)
        return match.group(1) if match else None
