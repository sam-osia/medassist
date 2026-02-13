"""Summarizer agent - generates human-readable workflow summaries."""

import logging
from pathlib import Path

logger = logging.getLogger("workflow.agents")

from pydantic import BaseModel

from core.llm_provider import call

from .base import BaseAgent
from ..schemas.agent_schemas import SummarizerInput, SummarizerOutput


class SummaryResponse(BaseModel):
    """LLM output for workflow summary."""
    summary: str


class SummarizerAgent(BaseAgent):
    """Generates plain English summaries of workflows."""

    def __init__(self, dataset: str = None, key_name: str = None):
        self.dataset = dataset
        self.key_name = key_name
        self._prompt = self._load_prompt()

    @property
    def name(self) -> str:
        return "summarizer"

    def _load_prompt(self) -> str:
        prompt_path = Path(__file__).parent.parent / "prompts" / "summarizer_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text()
        return self._default_prompt()

    def _default_prompt(self) -> str:
        return """You are a workflow summarizer. Your job is to create clear, concise
summaries of workflows in plain English.

Guidelines:
1. Describe what the workflow does in 2-3 sentences
2. Highlight the main steps and their purpose
3. Mention any loops or conditions
4. Use non-technical language where possible
5. Keep it brief but informative"""

    def run(self, inputs: SummarizerInput) -> SummarizerOutput:
        """Generate a summary of the workflow."""
        logger.info(f"[{self.name}] called")
        try:
            workflow_str = inputs.workflow.model_dump_json(indent=2, by_alias=True)

            system_prompt = f"""{self._prompt}

Generate a clear, concise summary of this workflow."""

            messages = [
                {"role": "user", "content": f"Summarize this workflow:\n\n{workflow_str}"}
            ]

            result = call(
                messages=messages,
                key_name=self.key_name,
                system=system_prompt,
                schema=SummaryResponse,
                temperature=0.7,
            )

            if result.parsed:
                logger.info(f"[{self.name}] success - summary length: {len(result.parsed.summary)}")
                return SummarizerOutput(
                    summary=result.parsed.summary,
                    cost=result.cost,
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens
                )
            else:
                # Fallback: use raw content
                logger.warning(f"[{self.name}] using fallback content")
                return SummarizerOutput(
                    summary=result.content or "Workflow summary unavailable.",
                    cost=result.cost,
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens
                )

        except Exception as e:
            logger.error(f"[{self.name}] error: {e}")
            return SummarizerOutput(summary=f"Could not generate summary: {str(e)}")
