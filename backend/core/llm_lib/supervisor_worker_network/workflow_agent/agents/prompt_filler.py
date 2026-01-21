"""Prompt filler agent - fills in prompt fields for tools that need them."""

import json
from pathlib import Path
from copy import deepcopy

from pydantic import BaseModel

from core.llm_provider import call
from core.llm_lib.supervisor_worker_network.schemas.plan_schema import (
    Plan as Workflow,
    ToolStep,
    LoopStep,
    IfStep,
)
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import PromptInput

from .base import BaseAgent
from ..schemas.agent_schemas import PromptFillerInput, PromptFillerOutput


class FilledPrompt(BaseModel):
    """LLM output for a filled prompt."""
    system_prompt: str
    user_prompt: str


class PromptFillerAgent(BaseAgent):
    """Fills in null prompt fields based on user intent and tool context."""

    def __init__(self, dataset: str = None):
        self.dataset = dataset
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
        try:
            # Deep copy to avoid mutating original
            workflow_dict = inputs.workflow.model_dump()

            # Process steps and fill prompts
            filled_steps = self._process_steps(
                workflow_dict.get('steps', []),
                inputs.user_intent,
                inputs.prompt_guides
            )
            workflow_dict['steps'] = filled_steps

            # Parse back to Workflow
            filled_workflow = Workflow.model_validate(workflow_dict)

            return PromptFillerOutput(
                workflow=filled_workflow,
                success=True
            )

        except Exception as e:
            return PromptFillerOutput(
                workflow=inputs.workflow,
                success=False,
                error_message=str(e)
            )

    def _process_steps(
        self,
        steps: list,
        user_intent: str,
        prompt_guides: dict
    ) -> list:
        """Process steps and fill null prompts."""
        result = []

        for step in steps:
            step = deepcopy(step)

            if step.get('type') == 'tool':
                # Check if this step has inputs with a null prompt
                inputs = step.get('inputs', {})
                if 'prompt' in inputs and inputs['prompt'] is None:
                    # Fill the prompt
                    tool_name = step.get('tool', '')
                    guide = prompt_guides.get(tool_name, '')
                    filled_prompt = self._generate_prompt(
                        tool_name=tool_name,
                        step=step,
                        user_intent=user_intent,
                        guide=guide
                    )
                    if filled_prompt:
                        inputs['prompt'] = filled_prompt
                        step['inputs'] = inputs

            elif step.get('type') == 'loop':
                # Process loop body
                body = step.get('body', [])
                step['body'] = self._process_steps(body, user_intent, prompt_guides)

            elif step.get('type') == 'if':
                # Process then branch
                then_step = step.get('then')
                if then_step:
                    processed = self._process_steps([then_step], user_intent, prompt_guides)
                    step['then'] = processed[0] if processed else then_step

            result.append(step)

        return result

    def _generate_prompt(
        self,
        tool_name: str,
        step: dict,
        user_intent: str,
        guide: str
    ) -> dict:
        """Generate a prompt for a specific tool step."""
        try:
            step_str = json.dumps(step, indent=2)

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
                model="gpt-4o",
                messages=messages,
                system=system_prompt,
                schema=FilledPrompt,
                temperature=0.7,
            )

            if result.parsed:
                return {
                    "system_prompt": result.parsed.system_prompt,
                    "user_prompt": result.parsed.user_prompt,
                    "examples": None
                }

        except Exception:
            pass

        # Fallback: generate a basic prompt
        return {
            "system_prompt": f"You are an assistant helping with {tool_name}.",
            "user_prompt": "Please process the input.",
            "examples": None
        }
