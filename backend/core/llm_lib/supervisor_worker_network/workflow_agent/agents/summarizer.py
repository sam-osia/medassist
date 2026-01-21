"""Summarizer agent - generates human-readable workflow summaries."""

from pathlib import Path

from pydantic import BaseModel

from core.llm_provider import call

from .base import BaseAgent
from ..schemas.agent_schemas import SummarizerInput, SummarizerOutput


class SummaryResponse(BaseModel):
    """LLM output for workflow summary."""
    summary: str


class SummarizerAgent(BaseAgent):
    """Generates plain English summaries of workflows."""

    def __init__(self, dataset: str = None):
        self.dataset = dataset
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
        try:
            workflow_str = inputs.workflow.model_dump_json(indent=2)

            system_prompt = f"""{self._prompt}

Generate a clear, concise summary of this workflow."""

            messages = [
                {"role": "user", "content": f"Summarize this workflow:\n\n{workflow_str}"}
            ]

            result = call(
                model="gpt-4o",
                messages=messages,
                system=system_prompt,
                schema=SummaryResponse,
                temperature=0.7,
            )

            if result.parsed:
                return SummarizerOutput(summary=result.parsed.summary)
            else:
                # Fallback: use raw content
                return SummarizerOutput(summary=result.content or "Workflow summary unavailable.")

        except Exception as e:
            return SummarizerOutput(summary=f"Could not generate summary: {str(e)}")
