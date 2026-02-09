"""Auto-derive output definitions from workflow compute steps."""

from typing import Dict, Any, List

from core.workflow.schemas.workflow_schema import Workflow, ToolStep, IfStep, LoopStep
from core.workflow.schemas.output_schemas import OutputDefinition


def _collect_tool_steps(steps: list) -> List[ToolStep]:
    """Recursively walk all steps and collect ToolSteps."""
    result = []
    for step in steps:
        if isinstance(step, ToolStep):
            result.append(step)
        elif isinstance(step, LoopStep):
            result.extend(_collect_tool_steps(step.body))
        elif isinstance(step, IfStep):
            if isinstance(step.then, ToolStep):
                result.append(step.then)
    return result


def derive_output_definitions(workflow: Workflow, tool_specs: Dict[str, Any]) -> Workflow:
    """
    Auto-derive output_definitions from compute tool steps.

    Walks all steps (including nested loop/if bodies), finds ToolSteps
    whose tool role is 'compute', and creates an OutputDefinition for each.
    """
    tool_steps = _collect_tool_steps(workflow.steps)

    defs = []
    for step in tool_steps:
        spec = tool_specs.get(step.tool, {})
        if spec.get("role", "compute") != "compute":
            continue

        defs.append(OutputDefinition(
            id=f"out_{step.id}",
            name=step.id,
            label=step.step_summary,
            tool_name=step.tool,
            step_id=step.id,
        ))

    workflow.output_definitions = defs
    return workflow
