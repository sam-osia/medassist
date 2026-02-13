"""Chunk operator agent - handles insert/append/remove operations on workflows."""

import json
import logging
from pathlib import Path

from core.llm_provider import call

logger = logging.getLogger("workflow.agents")
from core.workflow.schemas.workflow_schema import Workflow

from .base import BaseAgent
from ..schemas.agent_schemas import ChunkOperatorInput, ChunkOperatorOutput


class ChunkOperatorAgent(BaseAgent):
    """Performs targeted insert/append/remove operations on workflows."""

    def __init__(self, dataset: str = None, key_name: str = None):
        self.dataset = dataset
        self.key_name = key_name
        self._prompt = self._load_prompt()

    @property
    def name(self) -> str:
        return "chunk_operator"

    def _load_prompt(self) -> str:
        prompt_path = Path(__file__).parent.parent / "prompts" / "chunk_operator_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_prompt()

    def _default_prompt(self) -> str:
        return """You are a chunk operator agent. Your job is to perform targeted operations
on an existing workflow: insert, append, or remove steps.

OPERATIONS:
- INSERT: Add step(s) at a specific position (e.g., "before step 3", "after the loop")
- APPEND: Add step(s) at the end of the workflow
- REMOVE: Remove specific step(s) from the workflow

IMPORTANT RULES:
1. For INSERT/APPEND: Set prompt fields to null for new steps that need prompts.
2. PRESERVE all unchanged steps exactly as they are.
3. Maintain variable references - update if needed when removing steps.
4. Keep step IDs unique.

Output the modified workflow as valid JSON."""

    def run(self, inputs: ChunkOperatorInput) -> ChunkOperatorOutput:
        """Perform insert/append/remove operation on workflow."""
        logger.info(f"[{self.name}] called - operation: {inputs.operation}")
        logger.debug(f"[{self.name}] description: {inputs.description}")
        try:
            current_workflow_str = inputs.current_workflow.model_dump_json(indent=2, by_alias=True)
            tool_specs_str = json.dumps(inputs.tool_specs, indent=2)

            system_prompt = f"""{self._prompt}

AVAILABLE TOOLS:
{tool_specs_str}

CURRENT WORKFLOW:
{current_workflow_str}

OPERATION: {inputs.operation.upper()}

Perform the {inputs.operation} operation as described.
IMPORTANT: Preserve all unchanged steps exactly!"""

            messages = [
                {"role": "user", "content": f"Operation description: {inputs.description}"}
            ]

            result = call(
                messages=messages,
                key_name=self.key_name,
                system=system_prompt,
                schema=Workflow,
                temperature=0.7,
            )

            if result.parsed:
                logger.info(f"[{self.name}] success - workflow now has {len(result.parsed.steps)} steps")
                return ChunkOperatorOutput(
                    workflow=result.parsed,
                    success=True,
                    cost=result.cost,
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens
                )
            else:
                logger.warning(f"[{self.name}] failed to parse modified workflow from LLM response")
                return ChunkOperatorOutput(
                    success=False,
                    error_message="Failed to parse modified workflow from LLM response",
                    cost=result.cost,
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens
                )

        except Exception as e:
            logger.error(f"[{self.name}] error: {e}")
            return ChunkOperatorOutput(
                success=False,
                error_message=str(e)
            )
