import json
import logging
import re

from core.llm_lib.supervisor_worker_network.tools.notes import (
    GetPatientNotesIds, ReadPatientNote, AnalyzeNoteWithSpanAndReason
)
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, AnalyzeNoteWithSpanAndReasonInput, PromptInput
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


def analyze_single_note_for_flag(note_text, note_dict, criteria_config):
    """Analyze a single note for a specific SDOH flag criteria"""
    criteria_name = criteria_config['name']
    criteria_text = criteria_config['criteria']

    flag_result = AnalyzeNoteWithSpanAndReason(dataset=DATASET)(
        inputs=AnalyzeNoteWithSpanAndReasonInput(
            note=note_text,
            prompt=criteria_config['prompt'],
        ))

    result = {
        "flag_detected": flag_result.flag_state,
        'source_data': None
    }

    highlighted_text = create_highlighted_text(note_text, flag_result.span)

    if flag_result.flag_state:
        result["source_data"] = {
            "type": "note",
            "details": {
                **note_dict,
                "criteria": criteria_text,
                "criteria_name": criteria_name,
                "highlighted_text": highlighted_text,
                "reasoning": flag_result.reasoning
            }
        }

    return result


def analyze_notes(flags, mrn, csn):
    """Analyze patient notes for SDOH flags"""
    try:
        note_ids = GetPatientNotesIds(dataset=DATASET)(inputs=GetPatientNotesIdsInput(mrn=mrn, csn=csn))

        if not note_ids:
            print("No notes found for this patient encounter.")
            return

        # Initialize tracking for each flag
        flag_results = {flag_key: [] for flag_key in NOTE_FLAG_CRITERIA.keys()}

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
                    if flag_key in flags:
                        result = analyze_single_note_for_flag(note_text, note_dict, criteria_config)
                        if result["flag_detected"]:
                            flags[flag_key]["state"] = True
                            flags[flag_key]["sources"].append(result["source_data"])
                            flag_results[flag_key].append(result["source_data"])

            except Exception as e:
                logger.error(f"Error processing note {note_id}: {e}")

    except Exception as e:
        logger.error(f"Error getting notes for MRN {mrn}, CSN {csn}: {e}")


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


def run_workflow(mrn, csn, prompts):
    """
    Run SDOH screening workflow on a patient encounter.
    Returns flags dict with all screening results.

    Args:
        mrn: Patient MRN
        csn: Patient CSN
        prompts: List of 9 PromptInput objects for each SDOH flag

    Returns:
        dict: {
            "mrn": mrn,
            "csn": csn,
            "flags": flags_dict
        }
    """
    # Initialize flags with default structure
    flags = {
        'Language barrier': {"state": False, "sources": []},
        'Financial strain': {"state": False, "sources": []},
        'Social isolation': {"state": False, "sources": []},
        'Housing insecurity': {"state": False, "sources": []},
        'Depression': {"state": False, "sources": []},
        'Addiction': {"state": False, "sources": []},
        'Food insecurity': {"state": False, "sources": []},
        'Transportation': {"state": False, "sources": []},
        'Health literacy': {"state": False, "sources": []}
    }

    # Populate prompts from the workflow plan
    for i, flag_key in enumerate(NOTE_FLAG_CRITERIA.keys()):
        NOTE_FLAG_CRITERIA[flag_key]['prompt'] = prompts[i]

    logger.info(f"Starting SDOH screening workflow for MRN {mrn}, CSN {csn}")

    # Analyze notes for SDOH flags
    try:
        print('Analyzing notes for SDOH indicators...')
        analyze_notes(flags, mrn, csn)
    except Exception as e:
        logger.error(f"Error in SDOH note analysis for MRN {mrn}, CSN {csn}: {e}")

    logger.info(f"Completed SDOH screening workflow for MRN {mrn}, CSN {csn}")

    return {
        "mrn": mrn,
        "csn": csn,
        "flags": flags
    }
