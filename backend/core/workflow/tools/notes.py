import sys

from core.dataloders.datasets_loader import get_dataset_patients
from core.llm_provider import call
from core.workflow.tools.base import Tool
from core.workflow.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput,
    HighlightPatientNoteInput, KeywordCountInput, IdentifyFlagInput, AnalyzeNoteWithSpanAndReasonInput
)
from core.workflow.schemas.tool_outputs import (
    KeywordCountOutput, IdentifyFlagOutput, AnalyzeNoteWithSpanAndReasonOutput)
import json
from typing import List, Dict, Any
from jinja2 import Template


class GetPatientNotesIds(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "get_patient_notes_ids"
    
    @property
    def description(self) -> str:
        return "Return a list of note IDs for a given patient MRN and CSN encounter."

    @property
    def category(self) -> str:
        return "notes"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "list",
            "items": {
                "type": "int"
            }
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "mrn": {
                    "type": "integer",
                    "description": "Medical Record Number"
                },
                "csn": {
                    "type": "integer",
                    "description": "CSN encounter ID"
                }
            },
            "required": ["mrn", "csn"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: GetPatientNotesIdsInput) -> List[int]:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return [note['note_id'] for note in encounter['notes']]
        return []

class ReadPatientNote(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "read_patient_note"
    
    @property
    def description(self) -> str:
        return "Return details about a specific patient note as a JSON string."
    
    @property
    def category(self) -> str:
        return "notes"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "JSON string containing the full patient note record."
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "mrn": {
                    "type": "integer",
                    "description": "Medical Record Number"
                },
                "csn": {
                    "type": "integer",
                    "description": "CSN encounter ID"
                },
                "note_id": {
                    "type": "integer",
                    "description": "The specific note ID to retrieve"
                }
            },
            "required": ["mrn", "csn", "note_id"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: ReadPatientNoteInput) -> str:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        # Find the specific note
                        for note in encounter['notes']:
                            if int(note['note_id']) == int(inputs.note_id):
                                return json.dumps(note)
        return "{}"

class SummarizePatientNote(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "summarize_patient_note"
    
    @property
    def description(self) -> str:
        return "Analyze and summarize a patient note based on a given criteria"
    
    @property
    def category(self) -> str:
        return "notes"

    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "A concise summary of the patient note based on the given criteria"
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "note": {
                    "type": "string",
                    "description": "The full patient note text to analyze"
                },
                "criteria": {
                    "type": "string",
                    "description": "The specific criteria or aspects to focus on in the summary"
                }
            },
            "required": ["note", "criteria"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: SummarizePatientNoteInput) -> str:
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
        result = call(messages=messages, system=system_prompt)
        return result.content

class HighlightPatientNote(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "highlight_patient_note"
    
    @property
    def description(self) -> str:
        return "Analyze a patient note and highlight portions relevant to specific criteria using <highlight></highlight> tags."
    
    @property
    def category(self) -> str:
        return "notes"

    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "The full patient note text with <highlight> tags around sections relevant to the criteria."
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "note": {
                    "type": "string",
                    "description": "The full patient note text to analyze"
                },
                "criteria": {
                    "type": "string",
                    "description": "The specific criteria for highlighting relevant portions of the text"
                },
                "prompt": {
                    "type": "object",
                    "description": "Custom prompt configuration for the LLM call",
                    "properties": {
                        "system_prompt": {
                            "type": "string",
                            "description": "System prompt for the LLM"
                        },
                        "user_prompt": {
                            "type": "string",
                            "description": "User prompt template for the LLM"
                        },
                        "examples": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "user_input": {"type": "string"},
                                    "assistant_response": {"type": "string"}
                                },
                                "required": ["user_input", "assistant_response"]
                            },
                            "description": "Optional few-shot examples"
                        }
                    },
                    "required": ["system_prompt", "user_prompt"]
                }
            },
            "required": ["note", "criteria", "prompt"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: HighlightPatientNoteInput) -> str:
        # Build template context from inputs
        context = {
            'note': inputs.note,
            'criteria': inputs.criteria
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

        result = call(messages=messages, system=system_prompt)
        return result.content


class AnalyzeNoteWithSpanAndReason:
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "analyze_note_with_span_and_reason"

    @property
    def description(self) -> str:
        return "Analyze a patient note and highlight portions relevant to specific criteria using <highlight></highlight> tags."

    @property
    def category(self) -> str:
        return "notes"

    @property
    def returns(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "flag_state": {
                    "type": "boolean",
                    "description": "True if the flag criteria are met, False otherwise"
                },
                "span": {
                    "type": "string",
                    "description": "The portion of the text that caused the model to set the flag_state to True. Empty if flag_state is false."
                },
                "reasoning": {
                    "type": "string",
                    "description": "The reasoning that caused the model to set the flag_state to True. Empty if flag_state is false."
                }
            },
            "required": ["flag_state", "formatted_text"]
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "note": {
                    "type": "string",
                    "description": "The full patient note text to analyze"
                },
                "prompt": {
                    "type": "object",
                    "description": "Custom prompt configuration for the LLM call",
                    "properties": {
                        "system_prompt": {
                            "type": "string",
                            "description": "System prompt for the LLM"
                        },
                        "user_prompt": {
                            "type": "string",
                            "description": "User prompt template for the LLM"
                        },
                        "examples": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "user_input": {"type": "string"},
                                    "assistant_response": {"type": "string"}
                                },
                                "required": ["user_input", "assistant_response"]
                            },
                            "description": "Optional few-shot examples"
                        }
                    },
                    "required": ["system_prompt", "user_prompt"]
                }
            },
            "required": ["note", "prompt"],
            "additionalProperties": False
        }

    def __call__(self, inputs: AnalyzeNoteWithSpanAndReasonInput) -> AnalyzeNoteWithSpanAndReasonOutput:
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
                messages=messages,
                system=system_prompt,
                schema=AnalyzeNoteWithSpanAndReasonOutput
            )
            return result.parsed
        except Exception as e:
            # Fallback if structured output fails
            print(f"Structured output failed: {e}")
            return AnalyzeNoteWithSpanAndReasonOutput(
                flag_state=False,
                span='',
                reasoning=f"Structured output failed: {e}",
            )


class KeywordCount(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "keyword_count"
    
    @property
    def description(self) -> str:
        return "Use LLM to analyze text and count keywords, returning structured output with counts and formatted text."
    
    @property
    def category(self) -> str:
        return "notes"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "count": {
                    "type": "integer",
                    "description": "Total count of all keywords found in the text"
                },
                "formatted_text": {
                    "type": "string",
                    "description": "Text with keywords highlighted or formatted"
                }
            },
            "required": ["count", "formatted_text"]
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The text to count the keywords in"
                },
                "keywords": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of keywords to search for in the text"
                }
            },
            "required": ["text", "keywords"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: KeywordCountInput) -> KeywordCountOutput:
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
                system=system_prompt,
                schema=KeywordCountOutput
            )
            return result.parsed
        except Exception as e:
            # Fallback if structured output fails
            print(f"Structured output failed: {e}")
            return KeywordCountOutput(
                count=0,
                formatted_text=inputs.text
            )

class IdentifyFlag(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "identify_flag"
    
    @property
    def description(self) -> str:
        return "Analyze text to identify if specific flag criteria are met, returning boolean result and highlighted text if flag is raised."
    
    @property
    def category(self) -> str:
        return "notes"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "flag_state": {
                    "type": "boolean",
                    "description": "True if the flag criteria are met, False otherwise"
                },
                "formatted_text": {
                    "type": "string",
                    "description": "Empty string if flag not raised, or text with <highlight> tags around relevant portions if flag is raised"
                }
            },
            "required": ["flag_state", "formatted_text"]
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The text to analyze for flag criteria"
                },
                "criteria": {
                    "type": "string",
                    "description": "The specific criteria that would raise the flag"
                }
            },
            "required": ["text", "criteria"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: IdentifyFlagInput) -> IdentifyFlagOutput:
        system_prompt = """
You are a medical text analysis assistant. Your task is to determine if specific flag criteria are met in the given text.

Your responsibilities:
1. Analyze the text to determine if the flag criteria are present
2. Consider semantic equivalents, synonyms, and contextually relevant information
3. Exclude negated mentions - if the text explicitly negates the criteria, do not raise the flag
4. Return structured output:
   - "flag_state": boolean indicating whether the criteria are met
   - "formatted_text": 
     * Empty string ("") if flag_state is False
     * Full text with <highlight></highlight> tags around relevant portions if flag_state is True

Important rules:
- Be precise and conservative - only raise flags when criteria are clearly met
- Highlight only the specific text portions that caused the flag to be raised
- Preserve all original formatting, spacing, and line breaks in highlighted text
- Negated mentions override positive detection
- The output must strictly be JSON and conform to the provided schema
"""

        user_prompt = f"""
Analyze the following text to determine if the specified flag criteria are met.

<text>
{inputs.text}
</text>

<criteria>
{inputs.criteria}
</criteria>

Requirements:
1. Determine if the criteria are present in the text (consider semantic equivalents)
2. Ignore negated mentions of the criteria
3. If criteria are met:
   - Set flag_state to true
   - Return formatted_text with the full text and <highlight></highlight> tags around portions that caused the flag to be raised
4. If criteria are not met:
   - Set flag_state to false  
   - Return empty string for formatted_text

Output strictly as JSON:
{{
"flag_state": (boolean indicating if criteria are met),
"formatted_text": (empty string if false, or full text with highlights if true)
}}
"""

        try:
            result = call(
                messages=[{"role": "user", "content": user_prompt}],
                system=system_prompt,
                schema=IdentifyFlagOutput
            )
            return result.parsed
        except Exception as e:
            # Fallback if structured output fails
            print(f"Structured output failed: {e}")
            return IdentifyFlagOutput(
                flag_state=False,
                formatted_text=""
            )
