"""Prompt filler agent - fills in prompt fields for tools that need them."""

import logging
from pathlib import Path
from typing import List, Tuple

logger = logging.getLogger("workflow.agents")

from pydantic import BaseModel

from core.llm_provider import call
from core.workflow.schemas.workflow_schema import (
    Workflow,
    ToolStep,
    LoopStep,
    IfStep,
    AllSteps,
)
from core.workflow.schemas.tool_inputs import PromptInput

from .base import BaseAgent
from ..schemas.agent_schemas import PromptFillerInput, PromptFillerOutput


class FilledPrompt(BaseModel):
    """LLM output for a filled prompt."""
    system_prompt: str
    user_prompt: str


class PromptFillerAgent(BaseAgent):
    """Fills in null prompt fields based on user intent and tool context."""

    def __init__(self, dataset: str = None, key_name: str = None):
        self.dataset = dataset
        self.key_name = key_name
        self._prompt = self._load_prompt()

    @property
    def name(self) -> str:
        return "prompt_filler"

    def _load_prompt(self) -> str:
        prompt_path = Path(__file__).parent.parent / "prompts" / "prompt_filler_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_prompt()

    def _default_prompt(self) -> str:
        return """You are a prompt filler agent. Your job is to generate appropriate prompts
for workflow steps that require them.

For each step that needs a prompt, create:
1. system_prompt: Instructions for the LLM about its role and how to respond
2. user_prompt: The template for user input (can include {{ variable }} placeholders)

The prompts should align with:
- The user's overall intent
- The specific tool's purpose
- The step's position in the workflow

Be specific and actionable in your prompts."""

    def run(self, inputs: PromptFillerInput) -> PromptFillerOutput:
        """Fill in null prompts in the workflow."""
        logger.info(f"[{self.name}] called")
        logger.debug(f"[{self.name}] user_intent: {inputs.user_intent}")
        try:
            # Deep copy Pydantic objects directly (no dict conversion)
            workflow = inputs.workflow.model_copy(deep=True)

            # Process steps as Pydantic objects (in-place modification)
            # Returns accumulated cost/tokens from all LLM calls
            total_cost, total_input_tokens, total_output_tokens = self._process_steps(
                workflow.steps, inputs.user_intent, inputs.prompt_guides
            )

            logger.info(f"[{self.name}] success")
            return PromptFillerOutput(
                workflow=workflow,
                success=True,
                cost=total_cost,
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens
            )

        except Exception as e:
            logger.error(f"[{self.name}] error: {e}")
            return PromptFillerOutput(
                workflow=inputs.workflow,
                success=False,
                error_message=str(e)
            )

    def _process_steps(
        self,
        steps: List[AllSteps],
        user_intent: str,
        prompt_guides: dict
    ) -> Tuple[float, int, int]:
        """Process steps in-place and fill null prompts. Returns (cost, input_tokens, output_tokens)."""
        total_cost = 0.0
        total_input_tokens = 0
        total_output_tokens = 0

        for step in steps:
            if isinstance(step, ToolStep):
                # Check if inputs has a prompt field that is None
                if hasattr(step.inputs, 'prompt') and step.inputs.prompt is None:
                    tool_name = step.tool
                    guide = prompt_guides.get(tool_name, '')
                    filled_prompt, cost, input_tokens, output_tokens = self._generate_prompt(
                        tool_name=tool_name,
                        step=step,
                        user_intent=user_intent,
                        guide=guide
                    )
                    total_cost += cost
                    total_input_tokens += input_tokens
                    total_output_tokens += output_tokens
                    if filled_prompt:
                        step.inputs.prompt = PromptInput(**filled_prompt)

            elif isinstance(step, LoopStep):
                cost, input_tokens, output_tokens = self._process_steps(step.body, user_intent, prompt_guides)
                total_cost += cost
                total_input_tokens += input_tokens
                total_output_tokens += output_tokens

            elif isinstance(step, IfStep):
                # Process the 'then' branch (which is a single step)
                cost, input_tokens, output_tokens = self._process_steps([step.then], user_intent, prompt_guides)
                total_cost += cost
                total_input_tokens += input_tokens
                total_output_tokens += output_tokens

        return total_cost, total_input_tokens, total_output_tokens

    def _generate_prompt(
        self,
        tool_name: str,
        step: ToolStep,
        user_intent: str,
        guide: str
    ) -> Tuple[dict, float, int, int]:
        """Generate a prompt for a specific tool step. Returns (prompt_dict, cost, input_tokens, output_tokens)."""
        try:
            step_str = step.model_dump_json(indent=2, by_alias=True)

            system_prompt = f"""{self._prompt}

TOOL: {tool_name}
TOOL GUIDE: {guide if guide else 'No specific guide available.'}

STEP CONTEXT:
{step_str}

USER'S OVERALL INTENT:
{user_intent}

Generate a prompt that aligns with the user's intent and the tool's purpose."""

            messages = [
                {"role": "user", "content": f"Generate a prompt for the '{tool_name}' tool step."}
            ]

            result = call(
                messages=messages,
                key_name=self.key_name,
                system=system_prompt,
                schema=FilledPrompt,
                temperature=0.7,
            )

            if result.parsed:
                return (
                    {
                        "system_prompt": result.parsed.system_prompt,
                        "user_prompt": result.parsed.user_prompt,
                        "examples": None
                    },
                    result.cost,
                    result.input_tokens,
                    result.output_tokens
                )
            else:
                return (
                    None,
                    result.cost,
                    result.input_tokens,
                    result.output_tokens
                )

        except Exception as e:
            logger.warning(f"[{self.name}] prompt generation failed for {tool_name}: {e}")

        # Fallback: generate a basic prompt (no LLM call, so zero cost)
        return (
            {
                "system_prompt": f"You are an assistant helping with {tool_name}.",
                "user_prompt": "Please process the input.",
                "examples": None
            },
            0.0,
            0,
            0
        )
