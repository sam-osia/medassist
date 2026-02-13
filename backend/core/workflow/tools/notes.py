import sys

from pydantic import BaseModel, Field

from core.dataloaders.datasets_loader import get_dataset_patients
from core.llm_provider import call
from core.workflow.tools.base import Tool, ToolCallMeta, meta_from_llm_result
from core.workflow.schemas.tool_inputs import PromptInput, ExamplePair, ModelInput
import json
from typing import List, Dict, Any, Optional, Union
from jinja2 import Template


# ── Input Models ──────────────────────────────────────────────

class GetPatientNotesIdsInput(BaseModel):
    mrn: int = Field(description="Medical Record Number")
    csn: int = Field(description="CSN encounter ID")


class ReadPatientNoteInput(BaseModel):
    mrn: int = Field(description="Medical Record Number")
    csn: int = Field(description="CSN encounter ID")
    note_id: Union[int, str] = Field(description="The specific note ID to retrieve")


class SummarizePatientNoteInput(BaseModel):
    note: str = Field(description="The full patient note text to analyze")
    criteria: Optional[str] = Field(default=None, description="The specific criteria or aspects to focus on in the summary")
    model: Optional[ModelInput] = Field(default=None, description="LLM model selection")


class AnalyzeNoteWithSpanAndReasonInput(BaseModel):
    note: str = Field(description="The full patient note text to analyze")
    prompt: Optional[PromptInput] = Field(default=None, description="Custom prompt configuration for the LLM call")
    model: Optional[ModelInput] = Field(default=None, description="LLM model selection")


class SemanticKeywordCountInput(BaseModel):
    text: str = Field(description="The text to count the keywords in")
    keywords: List[str] = Field(description="List of keywords to search for in the text")
    model: Optional[ModelInput] = Field(default=None, description="LLM model selection")


class ExactKeywordCountInput(BaseModel):
    text: str = Field(description="The text to search for keywords")
    keywords: List[str] = Field(description="List of keywords to count")


# ── Output Models ─────────────────────────────────────────────

class ReadPatientNoteOutput(BaseModel):
    note_id: Optional[int] = None
    pat_id: Optional[str] = None
    note_type_id: Optional[int] = None
    note_type: Optional[str] = None
    note_status: Optional[str] = None
    service: Optional[str] = None
    author: Optional[str] = None
    create_datetime: Optional[str] = None
    filing_datetime: Optional[str] = None
    note_text: Optional[str] = None
    etl_datetime: Optional[str] = None


class AnalyzeNoteWithSpanAndReasonOutput(BaseModel):
    flag_state: bool
    span: str
    reasoning: str


class SemanticKeywordCountOutput(BaseModel):
    count: int
    formatted_text: str


class ExactKeywordCountOutput(BaseModel):
    counts: Dict[str, int]


# ── Tool Classes ──────────────────────────────────────────────

class GetPatientNotesIds(Tool):
    Input = GetPatientNotesIdsInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "get_patient_notes_ids"

    @property
    def role(self) -> str:
        return "reader"

    @property
    def description(self) -> str:
        return "Return a list of note IDs for a given patient MRN and CSN encounter."

    @property
    def display_name(self) -> str:
        return "Get Patient Notes IDs"

    @property
    def user_description(self) -> str:
        return "Return a list of note IDs for a given patient MRN and CSN encounter."

    @property
    def category(self) -> str:
        return "notes"

    def _returns_schema(self) -> dict:
        return {
            "type": "array",
            "items": {"type": "integer"}
        }

    def __call__(self, inputs: GetPatientNotesIdsInput):
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return [note['note_id'] for note in encounter['notes']], ToolCallMeta()
        return [], ToolCallMeta()

class ReadPatientNote(Tool):
    Input = ReadPatientNoteInput
    Output = ReadPatientNoteOutput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "read_patient_note"

    @property
    def role(self) -> str:
        return "reader"

    @property
    def description(self) -> str:
        return "Return details about a specific patient note as a JSON string."

    @property
    def display_name(self) -> str:
        return "Read Patient Note"

    @property
    def user_description(self) -> str:
        return "Return details about a specific patient note as a JSON string."

    @property
    def category(self) -> str:
        return "notes"

    def __call__(self, inputs: ReadPatientNoteInput):
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        for note in encounter['notes']:
                            if int(note['note_id']) == int(inputs.note_id):
                                return ReadPatientNoteOutput(**note), ToolCallMeta()
        return ReadPatientNoteOutput(), ToolCallMeta()

class SummarizePatientNote(Tool):
    Input = SummarizePatientNoteInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "summarize_patient_note"

    @property
    def uses_llm(self) -> bool:
        return True

    @property
    def description(self) -> str:
        return "Analyze and summarize a patient note based on a given criteria"

    @property
    def display_name(self) -> str:
        return "Summarize Patient Note"

    @property
    def user_description(self) -> str:
        return "Analyze and summarize a patient note based on a given criteria"

    @property
    def category(self) -> str:
        return "notes"

    def _returns_schema(self) -> dict:
        return {
            "type": "string",
            "description": "A concise summary of the patient note based on the given criteria"
        }

    def __call__(self, inputs: SummarizePatientNoteInput):
        system_prompt = """
        You are a helpful medical assistant that analyzes patient notes.
        You are given the patient note and its metadata from the database.
        Your task is to summarize the note given a criteria.
        The criteria defines the information you need to extract from the note.
        For example, if the criteria is "mental health", you need to summarize the
        note in a way that emphasizes the mental health aspects of the note.
        Although we are looking for a specific criteria, you should not limit your
        analysis to the criteria. You should analyze the note in a way that is
        consistent with the note's content and metadata.
        You should return the summary in a clear and concise manner.
        The output should contain only the summary, no other text.

        You are not forced to use the criteria. You should analyze the note in a way that is
        consistent with the note's content and metadata. You should not limit your analysis to the criteria,
        but text that is relevant to the criteria should be emphasized.
        """

        user_prompt = f"""
        <text>
        {inputs.note}
        </text>
        <criteria>
        {inputs.criteria or 'general'}
        </criteria>
        """

        messages = [{"role": "user", "content": user_prompt}]
        result = call(messages=messages, key_name=inputs.model.key_name,
                      system=system_prompt)
        return result.content, meta_from_llm_result(result)



class AnalyzeNoteWithSpanAndReason(Tool):
    Input = AnalyzeNoteWithSpanAndReasonInput
    Output = AnalyzeNoteWithSpanAndReasonOutput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "analyze_note_with_span_and_reason"

    @property
    def description(self) -> str:
        return "Analyze a patient note, detect a criteria and extract portions of the text relevant to the criteria, with additional reasoning"

    @property
    def display_name(self) -> str:
        return "Analyze Note With Span And Reason"

    @property
    def user_description(self) -> str:
        return "Analyze a patient note, detect a criteria and extract portions of the text relevant to the criteria, with additional reasoning"

    @property
    def uses_llm(self) -> bool:
        return True

    @property
    def input_help(self) -> Dict[str, str]:
        return {
            "prompt": "Configure the system and user prompts. Use Jinja2 template variables like {{note}} to reference input fields."
        }

    @property
    def category(self) -> str:
        return "notes"

    def __call__(self, inputs: AnalyzeNoteWithSpanAndReasonInput):
        # Build template context from inputs
        context = {
            'note': inputs.note,
        }

        # Render system and user prompts with Jinja2
        system_prompt = Template(inputs.prompt.system_prompt).render(context)
        user_prompt = Template(inputs.prompt.user_prompt).render(context)

        # Build messages list
        messages = []

        # Add few-shot examples if provided (also render templates)
        if inputs.prompt.examples:
            for example in inputs.prompt.examples:
                rendered_user = Template(example.user_input).render(context)
                rendered_assistant = Template(example.assistant_response).render(context)
                messages.append({"role": "user", "content": rendered_user})
                messages.append({"role": "assistant", "content": rendered_assistant})

        # Add the main user prompt
        messages.append({"role": "user", "content": user_prompt})

        try:
            result = call(
                messages=messages, key_name=inputs.model.key_name,
                system=system_prompt, schema=self.Output,
            )
            return result.parsed, meta_from_llm_result(result)
        except Exception as e:
            # Fallback if structured output fails
            print(f"Structured output failed: {e}")
            return AnalyzeNoteWithSpanAndReasonOutput(
                flag_state=False,
                span='',
                reasoning=f"Structured output failed: {e}",
            ), ToolCallMeta()


class SemanticKeywordCount(Tool):
    Input = SemanticKeywordCountInput
    Output = SemanticKeywordCountOutput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "semantic_keyword_count"

    @property
    def description(self) -> str:
        return "Use LLM to analyze text and count keywords semantically, returning structured output with counts and formatted text."

    @property
    def display_name(self) -> str:
        return "Semantic Keyword Count"

    @property
    def uses_llm(self) -> bool:
        return True

    @property
    def user_description(self) -> str:
        return "Use LLM to analyze text and count keywords semantically (synonyms, negation handling), returning structured output with counts and formatted text."

    @property
    def category(self) -> str:
        return "notes"

    def __call__(self, inputs: SemanticKeywordCountInput):
        system_prompt = """
    You are a text analysis assistant. Your task is to detect semantic occurrences of specified keywords in a text.

    Your responsibilities:
    1. Identify semantic matches of the given keywords:
    - Include synonyms, variations, or contextually equivalent terms.
    - Match the concept, not just the exact keyword.
    2. Exclude negated occurrences:
    - If the text negates the keyword meaning (e.g., "not fast" for "fast"), do not count it.
    - Negation overrides keyword detection.
    3. Count each semantic occurrence **once**, even if multiple forms or repeated words express the same keyword within the same phrase.
    4. Highlight matches in the original text:
    - Wrap each semantic occurrence with <highlight></highlight> tags.
    - Ensure no nested or repeated highlighting for the same semantic occurrence.
    5. Produce only a JSON object:
    - "count": integer, the total number of unique semantic keyword matches.
    - "formatted_text": string, the input text with keywords highlighted using <highlight></highlight> tags.

    Important rules:
    - Do NOT double count multiple synonyms in the same occurrence.
    - Count = number of unique semantic matches, not number of words highlighted.
    - Negated mentions are ignored entirely.
    - The output must strictly be JSON and conform to the provided schema.
    """

        user_prompt = f"""
    Analyze the following text and count occurrences of the specified keywords based on their semantic meaning.

    <text>
    {inputs.text}
    </text>

    <keywords>
    {inputs.keywords}
    </keywords>

    Requirements:
    1. Match semantic equivalents of the keywords (synonyms, variations, related phrases).
    2. Ignore negated mentions of keywords.
    3. Count each unique semantic occurrence only once, even if multiple words or synonyms are used in the same phrase.
    4. Highlight each occurrence in the original text by wrapping the matched phrase in <highlight></highlight> tags.
    5. Do not highlight or count partial matches that change meaning.

    Output strictly as JSON:
    {{
    "count": (integer total number of unique semantic keyword matches),
    "formatted_text": (original text with matches wrapped in <highlight></highlight> tags)
    }}
    """

        try:
            result = call(
                messages=[{"role": "user", "content": user_prompt}],
                key_name=inputs.model.key_name,
                system=system_prompt, schema=self.Output,
            )
            return result.parsed, meta_from_llm_result(result)
        except Exception as e:
            # Fallback if structured output fails
            print(f"Structured output failed: {e}")
            return SemanticKeywordCountOutput(
                count=0,
                formatted_text=inputs.text
            ), ToolCallMeta()


class ExactKeywordCount(Tool):
    Input = ExactKeywordCountInput
    Output = ExactKeywordCountOutput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "exact_keyword_count"

    @property
    def description(self) -> str:
        return "Count exact keyword matches in text (case-insensitive, deterministic)."

    @property
    def display_name(self) -> str:
        return "Exact Keyword Count"

    @property
    def user_description(self) -> str:
        return "Count exact keyword matches in text. Case-insensitive, no LLM involved."

    @property
    def category(self) -> str:
        return "notes"

    def __call__(self, inputs: ExactKeywordCountInput):
        counts = {}
        text_lower = inputs.text.lower()
        for keyword in inputs.keywords:
            counts[keyword] = text_lower.count(keyword.lower())
        return ExactKeywordCountOutput(counts=counts), ToolCallMeta()
