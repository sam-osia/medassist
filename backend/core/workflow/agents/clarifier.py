"""Clarifier agent - asks clarifying questions when request is ambiguous."""

import json
import logging
from pathlib import Path

logger = logging.getLogger("workflow.agents")

from pydantic import BaseModel
from typing import List

from core.llm_provider import call

from .base import BaseAgent
from ..schemas.agent_schemas import ClarifierInput, ClarifierOutput


class ClarifierResponse(BaseModel):
    """LLM output for clarification analysis."""
    ready: bool
    questions: List[str] = []
    out_of_scope: bool = False
    out_of_scope_reason: str = ""


class ClarifierAgent(BaseAgent):
    """Analyzes requests and asks clarifying questions if needed."""

    def __init__(self, dataset: str = None, key_name: str = None):
        self.dataset = dataset
        self.key_name = key_name
        self._prompt = self._load_prompt()

    @property
    def name(self) -> str:
        return "clarifier"

    def _load_prompt(self) -> str:
        prompt_path = Path(__file__).parent.parent / "prompts" / "clarifier_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_prompt()

    def _default_prompt(self) -> str:
        return """You are a clarifier agent. Your job is to analyze user requests and determine
if they're clear enough to proceed with workflow generation.

Analyze the request against available tools and determine:
1. ready: true if the request is clear and achievable with available tools
2. questions: list of clarifying questions if the request is ambiguous
3. out_of_scope: true if the request cannot be accomplished with available tools
4. out_of_scope_reason: explanation if out of scope

Guidelines:
- Only ask questions if truly necessary for workflow generation
- Check if required data/tools are available
- Be specific about what information is missing
- Don't ask obvious questions"""

    def run(self, inputs: ClarifierInput) -> ClarifierOutput:
        """Analyze request and determine if clarification is needed."""
        logger.info(f"[{self.name}] called")
        logger.debug(f"[{self.name}] user_request: {inputs.user_request}")
        try:
            tool_specs_str = json.dumps(inputs.tool_specs, indent=2)

            current_workflow_context = ""
            if inputs.current_workflow:
                current_workflow_context = f"""

CURRENT WORKFLOW:
{inputs.current_workflow.model_dump_json(indent=2, by_alias=True)}
"""

            system_prompt = f"""{self._prompt}

AVAILABLE TOOLS:
{tool_specs_str}
{current_workflow_context}
Analyze whether the user's request is clear and achievable."""

            messages = [
                {"role": "user", "content": f"User request: {inputs.user_request}"}
            ]

            result = call(
                messages=messages,
                key_name=self.key_name,
                system=system_prompt,
                schema=ClarifierResponse,
                temperature=0.5,
            )

            if result.parsed:
                logger.info(f"[{self.name}] ready={result.parsed.ready}, questions={len(result.parsed.questions)}, out_of_scope={result.parsed.out_of_scope}")
                return ClarifierOutput(
                    ready=result.parsed.ready,
                    questions=result.parsed.questions,
                    out_of_scope=result.parsed.out_of_scope,
                    out_of_scope_reason=result.parsed.out_of_scope_reason if result.parsed.out_of_scope else None,
                    cost=result.cost,
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens
                )
            else:
                # Assume ready if parsing fails
                logger.warning(f"[{self.name}] parsing failed, assuming ready=True")
                return ClarifierOutput(
                    ready=True,
                    cost=result.cost,
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens
                )

        except Exception as e:
            # Assume ready on error to not block
            logger.error(f"[{self.name}] error: {e}, assuming ready=True")
            return ClarifierOutput(ready=True)
