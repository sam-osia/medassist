import json
import logging
import re
from typing import List, Dict

from core.workflow.tools.notes import (
    GetPatientNotesIds, ReadPatientNote, AnalyzeNoteWithSpanAndReason
)
from core.workflow.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, AnalyzeNoteWithSpanAndReasonInput, PromptInput
)
from core.workflow_service.utils import (
    create_output_definition, create_output_value,
    RESOURCE_TYPE_NOTE,
    FIELD_TYPE_BOOLEAN, FIELD_TYPE_TEXT
)

logger = logging.getLogger(__name__)
DATASET = 'sdoh_parsed'


def clean_text(text: str) -> str:
    """
    Normalize whitespace in a text string:
    - Collapse multiple spaces/tabs/newlines into one space
    - Strip leading/trailing spaces
    """
    return re.sub(r'\s+', ' ', text).strip()


def find_span_in_text(note_text, span_text):
    """Find span in note text case-insensitively, return original case indices"""
    if not note_text or not span_text:
        return None, None, note_text or ""

    clean_note = clean_text(str(note_text))
    clean_span = clean_text(str(span_text))

    # Case-insensitive search
    lower_note = clean_note.lower()
    lower_span = clean_span.lower()

    start_idx = lower_note.find(lower_span)
    if start_idx != -1:
        end_idx = start_idx + len(clean_span)
        return start_idx, end_idx, clean_note
    return None, None, clean_note


def create_highlighted_text(note_text, span_text):
    """Create highlighted text matching IdentifyFlag tool behavior"""
    start_idx, end_idx, clean_note = find_span_in_text(note_text, span_text)

    if start_idx is not None:
        # Span found - highlight it in the full note
        highlighted_note = (
                clean_note[:start_idx] +
                f"<highlight>{clean_note[start_idx:end_idx]}</highlight>" +
                clean_note[end_idx:]
        )
        return highlighted_note
    else:
        # Span not found - include original note + span
        return f"{clean_note}\n\nSpan:\n{span_text}"


# Configuration for flag detection criteria that are based on notes
NOTE_FLAG_CRITERIA = {
    'Language barrier': {
        'name': 'Language Barrier',
        'criteria': 'Limited ability to communicate in the dominant language, hindering access to healthcare and services.'
    },
    'Financial strain': {
        'name': 'Financial Strain',
        'criteria': 'Economic hardship or financial difficulties affecting access to healthcare, housing, food, or other basic needs.'
    },
    'Social isolation': {
        'name': 'Social Isolation',
        'criteria': 'Lack of social connections, support networks, or meaningful relationships that impact health and wellbeing.'
    },
    'Housing insecurity': {
        'name': 'Housing Insecurity',
        'criteria': 'Unstable, unsafe, or inadequate housing conditions including homelessness, overcrowding, or frequent moves.'
    },
    'Depression': {
        'name': 'Depression',
        'criteria': 'Mental health condition characterized by persistent sadness, loss of interest, and impaired daily functioning.'
    },
    'Addiction': {
        'name': 'Addiction',
        'criteria': 'Substance use disorder or behavioral addiction that interferes with health, relationships, or daily functioning.'
    },
    'Food insecurity': {
        'name': 'Food Insecurity',
        'criteria': 'Limited or uncertain access to adequate, safe, and nutritious food due to lack of resources.'
    },
    'Transportation': {
        'name': 'Transportation Barriers',
        'criteria': 'Lack of reliable transportation affecting access to healthcare, employment, or essential services.'
    },
    'Health literacy': {
        'name': 'Health Literacy',
        'criteria': 'Limited ability to understand and use health information to make informed healthcare decisions.'
    }
}


def _build_output_definitions() -> Dict[str, dict]:
    """Build all output definitions for the SDOH workflow."""
    definitions = {}

    # Note flag definitions for each SDOH indicator
    for flag_key, criteria_config in NOTE_FLAG_CRITERIA.items():
        definitions[flag_key] = create_output_definition(
            name=flag_key,
            label=criteria_config["name"],
            resource_type=RESOURCE_TYPE_NOTE,
            fields=[
                {"name": "detected", "type": FIELD_TYPE_BOOLEAN},
                {"name": "span", "type": FIELD_TYPE_TEXT},
                {"name": "reasoning", "type": FIELD_TYPE_TEXT},
                {"name": "highlighted_text", "type": FIELD_TYPE_TEXT}
            ],
            metadata={"criteria": criteria_config["criteria"]}
        )

    return definitions


def analyze_single_note_for_flag(note_text, note_dict, criteria_config, mrn, csn, flag_key, definitions: Dict[str, dict]):
    """
    Analyze a single note for a specific SDOH flag criteria.

    Returns an output value entry if detected, None otherwise.
    """
    criteria_name = criteria_config['name']
    criteria_text = criteria_config['criteria']
    definition = definitions[flag_key]

    flag_result = AnalyzeNoteWithSpanAndReason(dataset=DATASET)(
        inputs=AnalyzeNoteWithSpanAndReasonInput(
            note=note_text,
            prompt=criteria_config['prompt'],
        ))

    if not flag_result.flag_state:
        return None

    highlighted_text = create_highlighted_text(note_text, flag_result.span)

    # Create output value entry
    return create_output_value(
        output_definition_id=definition["id"],
        resource_id=note_dict.get('note_id', ''),
        values={
            "detected": True,
            "span": flag_result.span,
            "reasoning": flag_result.reasoning,
            "highlighted_text": highlighted_text
        },
        metadata={
            "patient_id": str(mrn),
            "encounter_id": str(csn),
            "resource_details": note_dict,
            "criteria": criteria_text,
            "criteria_name": criteria_name
        }
    )


def analyze_notes(mrn, csn, definitions: Dict[str, dict]) -> List[dict]:
    """
    Analyze patient notes for SDOH flags.

    Returns a list of output value entries for all detected flags.
    """
    output_values = []

    try:
        note_ids = GetPatientNotesIds(dataset=DATASET)(inputs=GetPatientNotesIdsInput(mrn=mrn, csn=csn))

        if not note_ids:
            print("No notes found for this patient encounter.")
            return output_values

        for i, note_id in enumerate(note_ids):
            try:
                note_json_string = ReadPatientNote(dataset=DATASET)(
                    inputs=ReadPatientNoteInput(mrn=mrn, csn=csn, note_id=note_id))
                note_dict = json.loads(note_json_string)
                note_text = note_dict.get('note_text', '')

                note_text = clean_text(note_text)

                if not note_text or note_text.strip() == '':
                    continue

                for flag_key, criteria_config in NOTE_FLAG_CRITERIA.items():
                    result = analyze_single_note_for_flag(
                        note_text, note_dict, criteria_config, mrn, csn, flag_key, definitions
                    )
                    if result:
                        output_values.append(result)

            except Exception as e:
                logger.error(f"Error processing note {note_id}: {e}")

    except Exception as e:
        logger.error(f"Error getting notes for MRN {mrn}, CSN {csn}: {e}")

    return output_values


def run_workflow(mrn, csn, prompts):
    """
    Run SDOH screening workflow on a patient encounter.

    Returns output definitions and values.

    Args:
        mrn: Patient MRN
        csn: Patient CSN
        prompts: List of 9 PromptInput objects for each SDOH flag

    Returns:
        dict: {
            "mrn": mrn,
            "csn": csn,
            "output_definitions": [definition dicts],
            "output_values": [value dicts]
        }
    """
    output_values = []

    # Use fresh definitions for each run (to get unique IDs)
    definitions = _build_output_definitions()

    # Populate prompts from the workflow plan
    for i, flag_key in enumerate(NOTE_FLAG_CRITERIA.keys()):
        NOTE_FLAG_CRITERIA[flag_key]['prompt'] = prompts[i]

    logger.info(f"Starting SDOH screening workflow for MRN {mrn}, CSN {csn}")

    # Analyze notes for SDOH flags
    try:
        print('Analyzing notes for SDOH indicators...')
        note_values = analyze_notes(mrn, csn, definitions)
        output_values.extend(note_values)
    except Exception as e:
        logger.error(f"Error in SDOH note analysis for MRN {mrn}, CSN {csn}: {e}")

    logger.info(f"Completed SDOH screening workflow for MRN {mrn}, CSN {csn}")

    return {
        "mrn": mrn,
        "csn": csn,
        "output_definitions": list(definitions.values()),
        "output_values": output_values
    }
