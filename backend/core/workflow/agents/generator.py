"""Generator agent - creates new workflows from scratch."""

import json
import logging
from pathlib import Path

from core.llm_provider import call

logger = logging.getLogger("workflow.agents")
from core.workflow.schemas.workflow_schema import Workflow

from .base import BaseAgent
from ..schemas.agent_schemas import GeneratorInput, GeneratorOutput


class GeneratorAgent(BaseAgent):
    """Creates new workflows based on task description."""

    def __init__(self, dataset: str = None):
        self.dataset = dataset
        self._prompt = self._load_prompt()

    @property
    def name(self) -> str:
        return "generator"

    def _load_prompt(self) -> str:
        prompt_path = Path(__file__).parent.parent / "prompts" / "generator_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_prompt()

    def _default_prompt(self) -> str:
        return """You are a workflow generator agent. Your job is to create a structured workflow
based on the user's task description.

IMPORTANT RULES:
1. For any tool that requires a "prompt" field, set it to null. The prompt_filler agent will fill these in later.
2. Use the available tools only - don't invent new ones.
3. Create clear variable names for outputs.
4. Use loops when processing multiple items (like notes, medications, etc.)
5. Use conditionals when logic depends on previous results.

Output a valid workflow JSON that follows the Plan schema."""

    def run(self, inputs: GeneratorInput) -> GeneratorOutput:
        """Generate a new workflow from task description."""
        logger.info(f"[{self.name}] called")
        logger.debug(f"[{self.name}] task: {inputs.task_description}")
        try:
            # Build the system prompt with tool specs
            tool_specs_str = json.dumps(inputs.tool_specs, indent=2)
            system_prompt = f"""{self._prompt}

AVAILABLE TOOLS:
{tool_specs_str}

PATIENT CONTEXT:
- MRN: {inputs.patient_context.get('mrn', 'unknown')}
- CSN: {inputs.patient_context.get('csn', 'unknown')}

Generate a workflow that accomplishes the given task using only the available tools.
Remember: Set prompt fields to null for tools that need them - they will be filled later."""

            messages = [
                {"role": "user", "content": f"Create a workflow for: {inputs.task_description}"}
            ]

            result = call(
                model="gpt-4o",
                messages=messages,
                system=system_prompt,
                schema=Workflow,
                temperature=0.7,
            )

            if result.parsed:
                logger.info(f"[{self.name}] success - generated {len(result.parsed.steps)} steps")
                return GeneratorOutput(
                    workflow=result.parsed,
                    success=True,
                    cost=result.cost,
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens
                )
            else:
                logger.warning(f"[{self.name}] failed to parse workflow from LLM response")
                return GeneratorOutput(
                    success=False,
                    error_message="Failed to parse workflow from LLM response",
                    cost=result.cost,
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens
                )

        except Exception as e:
            logger.error(f"[{self.name}] error: {e}")
            return GeneratorOutput(
                success=False,
                error_message=str(e)
            )
