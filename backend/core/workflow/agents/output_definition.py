"""Output definition agent - generates output definitions from workflow steps."""

import logging
from pathlib import Path

from core.llm_provider import call

logger = logging.getLogger("workflow.agents")
from core.workflow.schemas.workflow_schema import Workflow

from .base import BaseAgent
from ..schemas.agent_schemas import OutputDefinitionInput, OutputDefinitionOutput


class OutputDefinitionAgent(BaseAgent):
    """Analyzes workflow steps and generates output definitions."""

    def __init__(self, dataset: str = None):
        self.dataset = dataset
        self._prompt = self._load_prompt()

    @property
    def name(self) -> str:
        return "output_definition"

    def _load_prompt(self) -> str:
        prompt_path = Path(__file__).parent.parent / "prompts" / "output_definition_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_prompt()

    def _default_prompt(self) -> str:
        return """You are an output definition generator. Your job is to analyze a workflow's steps
and define what outputs it produces.

Given a workflow with steps, you must:
1. Identify what meaningful outputs the workflow produces
2. Create output_definitions that describe each output
3. Create output_mappings that connect step results to output definitions

Keep the original steps unchanged - only add output_definitions and output_mappings."""

    def run(self, inputs: OutputDefinitionInput) -> OutputDefinitionOutput:
        logger.info(f"[{self.name}] called")
        try:
            workflow_json = inputs.workflow.model_dump_json(indent=2)

            system_prompt = f"""{self._prompt}

CURRENT WORKFLOW:
{workflow_json}

USER INTENT:
{inputs.user_intent}

Generate output_definitions and output_mappings for this workflow.
Keep all existing steps exactly as they are."""

            messages = [{"role": "user", "content": "Generate output definitions for this workflow."}]

            result = call(
                model="gpt-4o",
                messages=messages,
                system=system_prompt,
                schema=Workflow,
                temperature=0.5,
            )

            if result.parsed:
                def_count = len(result.parsed.output_definitions) if result.parsed.output_definitions else 0
                logger.info(f"[{self.name}] success - generated {def_count} definitions")
                return OutputDefinitionOutput(workflow=result.parsed, success=True)
            else:
                logger.warning(f"[{self.name}] failed to parse response")
                return OutputDefinitionOutput(success=False, error_message="Failed to parse response")

        except Exception as e:
            logger.error(f"[{self.name}] error: {e}")
            return OutputDefinitionOutput(success=False, error_message=str(e))
