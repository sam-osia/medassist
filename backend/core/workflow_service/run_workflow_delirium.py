import json
import logging
from typing import List, Dict

from core.workflow.tools.notes import (
    GetPatientNotesIds, ReadPatientNote, AnalyzeNoteWithSpanAndReason
)
from core.workflow.tools.medications import (
    GetMedicationsIds, ReadMedication
)
from core.workflow.tools.flowsheets import (
    AnalyzeFlowsheetInstance
)
from core.workflow.tools.diagnosis import (
    GetDiagnosisIds, ReadDiagnosis
)
from core.data.dataloader import get_patient_details
from core.workflow.tools.notes import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, AnalyzeNoteWithSpanAndReasonInput
)
from core.workflow.tools.medications import GetMedicationsIdsInput, ReadMedicationInput
from core.workflow.tools.diagnosis import GetDiagnosisIdsInput, ReadDiagnosisInput
from core.workflow.tools.flowsheets import AnalyzeFlowsheetInstanceInput
from core.workflow.schemas.tool_inputs import PromptInput, ModelInput
from core.workflow_service.utils import (
    create_output_definition, create_output_value, call_tool,
    RESOURCE_TYPE_NOTE, RESOURCE_TYPE_MEDICATION, RESOURCE_TYPE_DIAGNOSIS, RESOURCE_TYPE_FLOWSHEET,
    FIELD_TYPE_BOOLEAN, FIELD_TYPE_TEXT
)

logger = logging.getLogger(__name__)
DATASET = 'SickKids Demo'

# Configuration for note types to analyze (leave empty to analyze all note types)
NOTE_TYPES_TO_ANALYZE = [
    "nursing",
    "progress"
]

# Configuration for flag detection criteria
NOTE_FLAG_CRITERIA = {
    "DSM_5_criteria_1": {
        "name": "DSM-5 Criteria 1 (Attention/Awareness)",
        "criteria": "A disturbance in attention (i.e., reduced ability to direct, focus, sustain, and shift attention) and awareness (reduced orientation to the environment)."
    },
    "DSM_5_criteria_2": {
        "name": "DSM-5 Criteria 2 (Cognitive Change)",
        "criteria": "A change in cognition (e.g., memory deficit, disorientation, language disturbance) that is not better explained by a pre-existing neurocognitive disorder."
    },
    "DSM_5_criteria_3": {
        "name": "DSM-5 Criteria 3 (Acute Onset/Fluctuation)",
        "criteria": "The disturbance develops over a short period (usually hours to days) and tends to fluctuate in severity during the course of the day."
    },
    "mechanical_ventilation": {
        "name": "Mechanical Ventilation",
        "criteria": "Patient is on mechanical ventilation, intubated, or receiving respiratory support."
    },
    "post_op_state": {
        "name": "Post-Operative State",
        "criteria": "Patient is in a post-operative state, recovering from surgery, or mentions recent surgical procedures."
    },
    "explicit_delirium_mention": {
        "name": "Explicit Delirium Mention",
        "criteria": "Explicit mention of delirium"
    }
}


# =============================================================================
# Output Definitions (created once, reused for all values)
# =============================================================================

def _build_output_definitions() -> Dict[str, dict]:
    """Build all output definitions for the delirium workflow."""
    definitions = {}

    # Treatment medications definition
    definitions["treatment_medications"] = create_output_definition(
        name="treatment_medications",
        label="Treatment Medications",
        resource_type=RESOURCE_TYPE_MEDICATION,
        fields=[
            {"name": "detected", "type": FIELD_TYPE_BOOLEAN},
            {"name": "matched_medication", "type": FIELD_TYPE_TEXT}
        ],
        metadata={"description": "Medications associated with delirium treatment"}
    )

    # Positive correlation diagnosis definition
    definitions["positive_correlation_diagnosis"] = create_output_definition(
        name="positive_correlation_diagnosis",
        label="Positive Correlation Diagnosis",
        resource_type=RESOURCE_TYPE_DIAGNOSIS,
        fields=[
            {"name": "detected", "type": FIELD_TYPE_BOOLEAN},
            {"name": "matched_diagnosis", "type": FIELD_TYPE_TEXT}
        ],
        metadata={"description": "Diagnoses positively correlated with delirium"}
    )

    # CAPD (flowsheet analysis) definition
    definitions["CAPD"] = create_output_definition(
        name="CAPD",
        label="CAPD Assessment",
        resource_type=RESOURCE_TYPE_FLOWSHEET,
        fields=[
            {"name": "detected", "type": FIELD_TYPE_BOOLEAN}
        ],
        metadata={"description": "Cornell Assessment of Pediatric Delirium"}
    )

    # Note flag definitions
    for flag_key, criteria_config in NOTE_FLAG_CRITERIA.items():
        definitions[flag_key] = create_output_definition(
            name=flag_key,
            label=criteria_config["name"],
            resource_type=RESOURCE_TYPE_NOTE,
            fields=[
                {"name": "detected", "type": FIELD_TYPE_BOOLEAN},
                {"name": "span", "type": FIELD_TYPE_TEXT},
                {"name": "reasoning", "type": FIELD_TYPE_TEXT}
            ],
            metadata={"criteria": criteria_config["criteria"]}
        )

    return definitions


# Module-level definitions (built once)
OUTPUT_DEFINITIONS = _build_output_definitions()


def check_medications(mrn, csn, medications_to_check: List[str], definitions: Dict[str, dict], tracker=None) -> List[dict]:
    """
    Check patient medications against a list of target medications.

    Returns a list of output value entries for matching medications.
    """
    output_values = []
    definition = definitions["treatment_medications"]

    try:
        # Get all medication IDs
        medications_ids = call_tool(GetMedicationsIds(dataset=DATASET), GetMedicationsIdsInput(mrn=mrn, csn=csn), tracker)

        # Process each medication
        for medication_id in medications_ids:
            try:
                # Read medication
                medication_result = call_tool(ReadMedication(dataset=DATASET), ReadMedicationInput(mrn=mrn, csn=csn, order_id=medication_id), tracker)
                medication_dict = medication_result.model_dump()

                # Check if medication name or simple generic name matches any in medications_to_check
                medication_name = str(medication_dict.get('medication_name', '')).lower()
                simple_generic_name = str(medication_dict.get('simple_generic_name', '')).lower()

                # Skip if both names are nan
                if medication_name == 'nan' and simple_generic_name == 'nan':
                    continue

                # Convert 'nan' to empty string for comparison
                medication_name = '' if medication_name == 'nan' else medication_name
                simple_generic_name = '' if simple_generic_name == 'nan' else simple_generic_name

                for med_to_check in medications_to_check:
                    if med_to_check.lower() in medication_name or med_to_check.lower() in simple_generic_name:
                        print(f"Found matching medication: {medication_dict.get('medication_name', 'N/A')}")
                        output_values.append(create_output_value(
                            output_definition_id=definition["id"],
                            resource_id=medication_dict.get('order_id', medication_id),
                            values={
                                "detected": True,
                                "matched_medication": med_to_check
                            },
                            metadata={
                                "patient_id": str(mrn),
                                "encounter_id": str(csn),
                                "resource_details": medication_dict
                            }
                        ))
                        break

            except Exception as e:
                logger.error(f"Error processing medication {medication_id}: {e}")

    except Exception as e:
        logger.error(f"Error getting medications for MRN {mrn}, CSN {csn}: {e}")

    return output_values


def check_diagnoses(mrn, csn, diagnoses_to_check: List[str], definitions: Dict[str, dict], tracker=None) -> List[dict]:
    """
    Check patient diagnoses against positive correlation diagnoses.

    Returns a list of output value entries for matching diagnoses.
    """
    output_values = []
    definition = definitions["positive_correlation_diagnosis"]

    try:
        # Get all diagnosis IDs
        diagnosis_ids = call_tool(GetDiagnosisIds(dataset=DATASET), GetDiagnosisIdsInput(mrn=mrn, csn=csn), tracker)
        print(f"\n=== Diagnosis Information for Patient MRN: {mrn}, CSN: {csn} ===")
        print(f"Total diagnosis IDs found: {len(diagnosis_ids)}")

        # Process each diagnosis
        for diagnosis_id in diagnosis_ids:
            try:
                # Read diagnosis
                diagnosis_result = call_tool(ReadDiagnosis(dataset=DATASET), ReadDiagnosisInput(mrn=mrn, csn=csn, diagnosis_id=diagnosis_id), tracker)
                diagnosis_dict = diagnosis_result.model_dump()

                # Get diagnosis name and convert to lowercase for comparison
                diagnosis_name = str(diagnosis_dict.get('diagnosis_name', '')).lower()

                # Skip if diagnosis name is nan or empty
                if diagnosis_name == 'nan' or not diagnosis_name:
                    continue

                # Check if any positive correlation diagnosis is contained in the diagnosis name
                for positive_diagnosis in diagnoses_to_check:
                    if positive_diagnosis.lower() in diagnosis_name:
                        print(f"Found matching diagnosis: {diagnosis_dict.get('diagnosis_name', 'N/A')}")
                        output_values.append(create_output_value(
                            output_definition_id=definition["id"],
                            resource_id=diagnosis_dict.get('diagnosis_id', diagnosis_id),
                            values={
                                "detected": True,
                                "matched_diagnosis": positive_diagnosis
                            },
                            metadata={
                                "patient_id": str(mrn),
                                "encounter_id": str(csn),
                                "resource_details": diagnosis_dict
                            }
                        ))
                        break

            except Exception as e:
                logger.error(f"Error processing diagnosis {diagnosis_id}: {e}")

    except Exception as e:
        logger.error(f"Error getting diagnoses for MRN {mrn}, CSN {csn}: {e}")

    return output_values


def check_flowsheets(mrn, csn, definitions: Dict[str, dict], tracker=None) -> List[dict]:
    """
    Check patient flowsheets for CAPD analysis.

    Returns a list of output value entries for CAPD detections.
    """
    output_values = []
    definition = definitions["CAPD"]

    try:
        # Get patient details and extract flowsheet instances for matching CSN
        patient_details = get_patient_details(str(mrn), DATASET)
        flowsheet_instances = []

        if patient_details and patient_details.get("encounters"):
            for encounter in patient_details["encounters"]:
                if int(encounter.get("csn")) == csn:
                    print('Found matching encounter for flowsheets')
                    print(f"Encounter CSN: {encounter.get('csn', 'N/A')}")
                    print(encounter.keys())
                    flowsheet_instances = encounter.get("flowsheets_instances", [])
                    break

        if not flowsheet_instances:
            print("No flowsheet instances found for analysis")
            return output_values

        print('Processing flowsheet instances...')

        # Process each flowsheet instance
        for i, instance in enumerate(flowsheet_instances):
            instance_id = f"instance_{i}"
            timestamp = instance.get('timestamp', 'N/A')

            try:
                print('\n--- Analyzing Flowsheet Instance ---')

                # Note: sensory_deficit, motor_deficit, developmental_delay would need
                # to be determined from other results if available
                sensory_deficit = False
                motor_deficit = False
                developmental_delay = False

                print(' About to run AnalyzeFlowsheetInstance with inputs:')

                # Run analysis on this instance
                analysis_result = call_tool(AnalyzeFlowsheetInstance(dataset=DATASET), AnalyzeFlowsheetInstanceInput(
                    flowsheet_instance=json.dumps(instance),
                    sensory_deficit=sensory_deficit,
                    motor_deficit=motor_deficit,
                    developmental_delay=developmental_delay
                ), tracker)

                # If analysis returns True, create CAPD output value
                if analysis_result:
                    print(f"CAPD detected in flowsheet instance at {timestamp}")
                    output_values.append(create_output_value(
                        output_definition_id=definition["id"],
                        resource_id=instance_id,
                        values={
                            "detected": True
                        },
                        metadata={
                            "patient_id": str(mrn),
                            "encounter_id": str(csn),
                            "resource_details": {
                                "flowsheet_instance": instance,
                                "analysis_inputs": {
                                    "sensory_deficit": sensory_deficit,
                                    "motor_deficit": motor_deficit,
                                    "developmental_delay": developmental_delay
                                }
                            }
                        }
                    ))

            except Exception as e:
                logger.error(f"Error processing flowsheet instance {instance_id} at {timestamp}: {e}")

    except Exception as e:
        logger.error(f"Error getting flowsheets for MRN {mrn}, CSN {csn}: {e}")

    return output_values


def analyze_single_note_for_flag(note_text, note_dict, note_id, flag_key, criteria_config, mrn, csn, definitions: Dict[str, dict], key_name: str, tracker=None):
    """
    Analyze a single note for a specific flag criteria using AnalyzeNoteWithSpanAndReason.

    Returns an output value entry if detected, None otherwise.
    """
    criteria_name = criteria_config["name"]
    criteria_text = criteria_config["criteria"]
    definition = definitions[flag_key]

    # Build prompt with criteria embedded
    prompt = PromptInput(
        system_prompt="""You are a medical text analysis assistant. Your task is to determine if specific criteria are met in clinical notes.

Your responsibilities:
1. Analyze the text for the specified criteria
2. Consider semantic equivalents and contextually relevant information
3. Exclude negated mentions - if the text explicitly negates the criteria, do not raise the flag
4. Return:
   - flag_state: true if criteria are clearly met, false otherwise
   - span: the exact text portion that triggered the flag (empty string if not met)
   - reasoning: brief explanation for the decision (empty string if not met)

Be precise and conservative - only raise flags when criteria are clearly met.""",
        user_prompt=f"""Analyze this clinical note for the following criteria:

Criteria: {criteria_text}

Note:
{{{{note}}}}

If the criteria are met, extract the exact span of text that supports it and explain your reasoning."""
    )

    # Use AnalyzeNoteWithSpanAndReason tool
    result = call_tool(AnalyzeNoteWithSpanAndReason(dataset=DATASET),
        AnalyzeNoteWithSpanAndReasonInput(note=note_text, prompt=prompt, model=ModelInput(key_name=key_name)), tracker)

    print(f"{criteria_name} Analysis: {result.flag_state}")

    if not result.flag_state:
        print(f"  {criteria_name} NOT detected in this note")
        return None

    print(f"  {criteria_name} DETECTED in this note")

    return create_output_value(
        output_definition_id=definition["id"],
        resource_id=note_dict.get('note_id', note_id),
        values={
            "detected": True,
            "span": result.span,
            "reasoning": result.reasoning
        },
        metadata={
            "patient_id": str(mrn),
            "encounter_id": str(csn),
            "resource_details": note_dict,
            "criteria": criteria_text,
            "criteria_name": criteria_name
        }
    )


def check_notes(mrn, csn, definitions: Dict[str, dict], key_name: str, tracker=None) -> List[dict]:
    """
    Check patient notes using AnalyzeNoteWithSpanAndReason tool for multiple criteria.

    Returns a list of output value entries for all detected flags.
    """
    output_values = []

    try:
        # Get all note IDs
        note_ids = call_tool(GetPatientNotesIds(dataset=DATASET), GetPatientNotesIdsInput(mrn=mrn, csn=csn), tracker)
        print(f"\n=== Note Information for Patient MRN: {mrn}, CSN: {csn} ===")
        print(f"Total note IDs found: {len(note_ids)}")

        if not note_ids:
            print("No notes found for this patient encounter.")
            return output_values

        # Process each note
        for i, note_id in enumerate(note_ids):
            try:
                print(f"\n--- Analyzing Note {i+1}/{len(note_ids)} (ID: {note_id}) ---")

                # Read the note
                note_result = call_tool(ReadPatientNote(dataset=DATASET), ReadPatientNoteInput(mrn=mrn, csn=csn, note_id=note_id), tracker)
                note_dict = note_result.model_dump()

                note_type = note_dict.get('note_type', 'N/A')
                print(f"Note Type: {note_type}")

                # Check if note type should be analyzed
                if NOTE_TYPES_TO_ANALYZE:
                    should_analyze = any(analyze_type.lower() in note_type.lower() for analyze_type in NOTE_TYPES_TO_ANALYZE)

                # Get the note text
                note_text = note_dict.get('note_text', '')
                if not note_text or note_text.strip() == '':
                    print("No note text available for analysis.")
                    continue

                print(f"Note Text Length: {len(note_text)} characters")

                # Analyze this note for each configured flag criteria
                for flag_key, criteria_config in NOTE_FLAG_CRITERIA.items():
                    print(f"\n  --- {criteria_config['name']} ---")

                    result = analyze_single_note_for_flag(
                        note_text, note_dict, note_id, flag_key, criteria_config, mrn, csn, definitions, key_name, tracker
                    )

                    if result:
                        output_values.append(result)

            except Exception as e:
                logger.error(f"Error processing note {note_id}: {e}")

    except Exception as e:
        logger.error(f"Error getting notes for MRN {mrn}, CSN {csn}: {e}")

    return output_values


def run_workflow(mrn, csn, key_name: str, tracker=None):
    """
    Run delirium screening workflow on a patient encounter.

    Returns output definitions and values.

    Args:
        mrn: Patient MRN
        csn: Patient CSN
        key_name: Managed API key name for LLM calls

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

    # Configuration for medications and diagnoses to check
    MEDICATIONS_TO_CHECK = [
        "haloperidol", "risperidone", "quetiapine", "olanzapine",
        "aripiprazole", "dexmedetomidine", "clonidine"
    ]
    DIAGNOSES_TO_CHECK = ["active infection", "sepsis", "delirium"]

    logger.info(f"Starting delirium screening workflow for MRN {mrn}, CSN {csn}")

    # Process medications
    try:
        print('Checking medications...')
        med_values = check_medications(mrn, csn, MEDICATIONS_TO_CHECK, definitions, tracker)
        output_values.extend(med_values)
    except Exception as e:
        logger.error(f"Error in medication check for MRN {mrn}, CSN {csn}: {e}")

    # Process diagnoses
    try:
        print('Checking diagnoses...')
        diag_values = check_diagnoses(mrn, csn, DIAGNOSES_TO_CHECK, definitions, tracker)
        output_values.extend(diag_values)
    except Exception as e:
        logger.error(f"Error in diagnosis check for MRN {mrn}, CSN {csn}: {e}")

    # Process flowsheets
    try:
        print('Checking flowsheets...')
        flowsheet_values = check_flowsheets(mrn, csn, definitions, tracker)
        output_values.extend(flowsheet_values)
    except Exception as e:
        logger.error(f"Error in flowsheet check for MRN {mrn}, CSN {csn}: {e}")

    # Process notes
    try:
        print('Checking notes...')
        note_values = check_notes(mrn, csn, definitions, key_name, tracker)
        output_values.extend(note_values)
    except Exception as e:
        logger.error(f"Error in notes check for MRN {mrn}, CSN {csn}: {e}")

    logger.info(f"Completed delirium screening workflow for MRN {mrn}, CSN {csn}")

    return {
        "mrn": mrn,
        "csn": csn,
        "output_definitions": list(definitions.values()),
        "output_values": output_values
    }
