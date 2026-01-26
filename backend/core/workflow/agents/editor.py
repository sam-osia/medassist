"""Editor agent - modifies existing workflows."""

import json
import logging
from pathlib import Path

from core.llm_provider import call

logger = logging.getLogger("workflow.agents")
from core.workflow.schemas.plan_schema import Plan as Workflow

from .base import BaseAgent
from ..schemas.agent_schemas import EditorInput, EditorOutput


class EditorAgent(BaseAgent):
    """Edits existing workflows based on modification requests."""

    def __init__(self, dataset: str = None):
        self.dataset = dataset
        self._prompt = self._load_prompt()

    @property
    def name(self) -> str:
        return "editor"

    def _load_prompt(self) -> str:
        prompt_path = Path(__file__).parent.parent / "prompts" / "editor_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_prompt()

    def _default_prompt(self) -> str:
        return """You are a workflow editor agent. Your job is to modify an existing workflow
based on the user's edit request.

IMPORTANT RULES:
1. PRESERVE existing prompt values for steps that are NOT being changed.
2. For NEW steps that require a "prompt" field, set it to null.
3. Maintain existing variable references and step IDs where possible.
4. Only modify what's necessary to fulfill the edit request.
5. Keep the workflow structure consistent.

Output the modified workflow as valid JSON."""

    def run(self, inputs: EditorInput) -> EditorOutput:
        """Edit an existing workflow based on the edit request."""
        logger.info(f"[{self.name}] called")
        logger.debug(f"[{self.name}] edit_request: {inputs.edit_request}")
        try:
            # Serialize current workflow
            current_workflow_str = inputs.current_workflow.model_dump_json(indent=2)
            tool_specs_str = json.dumps(inputs.tool_specs, indent=2)

            system_prompt = f"""{self._prompt}

AVAILABLE TOOLS:
{tool_specs_str}

CURRENT WORKFLOW:
{current_workflow_str}

Modify this workflow according to the edit request.
IMPORTANT: Preserve prompt values for unchanged steps!"""

            messages = [
                {"role": "user", "content": f"Edit request: {inputs.edit_request}"}
            ]

            result = call(
                model="gpt-4o",
                messages=messages,
                system=system_prompt,
                schema=Workflow,
                temperature=0.7,
            )

            if result.parsed:
                logger.info(f"[{self.name}] success - edited workflow has {len(result.parsed.steps)} steps")
                return EditorOutput(
                    workflow=result.parsed,
                    success=True
                )
            else:
                logger.warning(f"[{self.name}] failed to parse edited workflow from LLM response")
                return EditorOutput(
                    success=False,
                    error_message="Failed to parse edited workflow from LLM response"
                )

        except Exception as e:
            logger.error(f"[{self.name}] error: {e}")
            return EditorOutput(
                success=False,
                error_message=str(e)
            )
