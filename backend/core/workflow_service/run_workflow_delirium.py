import json
import logging

from core.workflow.tools.notes import (
    GetPatientNotesIds, ReadPatientNote, IdentifyFlag
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
from core.workflow.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, IdentifyFlagInput,
    GetMedicationsIdsInput, ReadMedicationInput, GetDiagnosisIdsInput, ReadDiagnosisInput,
    AnalyzeFlowsheetInstanceInput
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


def check_medications(flags, mrn, csn):
    """Check patient medications against a list of target medications"""
    medications_to_check = flags["treatment_medications"]["medications"]

    try:
        # Get all medication IDs
        medications_ids = GetMedicationsIds(dataset=DATASET)(inputs=GetMedicationsIdsInput(mrn=mrn, csn=csn))

        # Process each medication
        for medication_id in medications_ids:
            try:
                # Read medication
                medication_json_string = ReadMedication(dataset=DATASET)(inputs=ReadMedicationInput(mrn=mrn, csn=csn, order_id=medication_id))
                medication_dict = json.loads(medication_json_string)

                # Check if medication name or simple generic name matches any in medications_to_check
                medication_name = str(medication_dict.get('medication_name', '')).lower()
                simple_generic_name = str(medication_dict.get('simple_generic_name', '')).lower()

                # Skip if both names are nan
                if medication_name == 'nan' and simple_generic_name == 'nan':
                    continue

                # Convert 'nan' to empty string for comparison
                medication_name = '' if medication_name == 'nan' else medication_name
                simple_generic_name = '' if simple_generic_name == 'nan' else simple_generic_name

                match_found = False
                for med_to_check in medications_to_check:
                    if med_to_check.lower() in medication_name or med_to_check.lower() in simple_generic_name:
                        print(f"Found matching medication: {medication_dict.get('medication_name', 'N/A')}")
                        flags["treatment_medications"]["state"] = True
                        flags["treatment_medications"]["sources"].append({
                            "type": "medications",
                            "details": medication_dict
                        })
                        match_found = True
                        break

            except Exception as e:
                logger.error(f"Error processing medication {medication_id}: {e}")

    except Exception as e:
        logger.error(f"Error getting medications for MRN {mrn}, CSN {csn}: {e}")


def check_diagnoses(flags, mrn, csn):
    """Check patient diagnoses against positive correlation diagnoses"""
    positive_diagnoses_to_check = flags["positive_correlation_diagnosis"]["diagnoses"]

    try:
        # Get all diagnosis IDs
        diagnosis_ids = GetDiagnosisIds(dataset=DATASET)(inputs=GetDiagnosisIdsInput(mrn=mrn, csn=csn))
        print(f"\n=== Diagnosis Information for Patient MRN: {mrn}, CSN: {csn} ===")
        print(f"Total diagnosis IDs found: {len(diagnosis_ids)}")

        # Process each diagnosis
        for diagnosis_id in diagnosis_ids:
            try:
                # Read diagnosis
                diagnosis_json_string = ReadDiagnosis(dataset=DATASET)(inputs=ReadDiagnosisInput(mrn=mrn, csn=csn, diagnosis_id=diagnosis_id))
                diagnosis_dict = json.loads(diagnosis_json_string)

                # Get diagnosis name and convert to lowercase for comparison
                diagnosis_name = str(diagnosis_dict.get('diagnosis_name', '')).lower()

                # Skip if diagnosis name is nan or empty
                if diagnosis_name == 'nan' or not diagnosis_name:
                    continue

                match_found = False
                # Check if any positive correlation diagnosis is contained in the diagnosis name
                for positive_diagnosis in positive_diagnoses_to_check:
                    if positive_diagnosis.lower() in diagnosis_name:
                        print(f"Found matching diagnosis: {diagnosis_dict.get('diagnosis_name', 'N/A')}")
                        flags["positive_correlation_diagnosis"]["state"] = True
                        flags["positive_correlation_diagnosis"]["sources"].append({
                            "type": "diagnosis",
                            "details": diagnosis_dict
                        })
                        match_found = True
                        break

            except Exception as e:
                logger.error(f"Error processing diagnosis {diagnosis_id}: {e}")

    except Exception as e:
        logger.error(f"Error getting diagnoses for MRN {mrn}, CSN {csn}: {e}")


def check_flowsheets(flags, mrn, csn):
    """Check patient flowsheets for CAPD analysis"""
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
            return

        print('Processing flowsheet instances...')

        # Process each flowsheet instance
        for i, instance in enumerate(flowsheet_instances):
            instance_id = f"instance_{i}"
            timestamp = instance.get('timestamp', 'N/A')

            try:
                print('\n--- Analyzing Flowsheet Instance ---')

                # Get current flag states for analysis
                sensory_deficit = flags.get("sensory_deficit", {}).get("state", False)
                motor_deficit = flags.get("motor_deficit", {}).get("state", False)
                developmental_delay = flags.get("developmental_delay", {}).get("state", False)

                print(' About to run AnalyzeFlowsheetInstance with inputs:')

                # Run analysis on this instance
                analysis_result = AnalyzeFlowsheetInstance(dataset=DATASET)(inputs=AnalyzeFlowsheetInstanceInput(
                    flowsheet_instance=json.dumps(instance),
                    sensory_deficit=sensory_deficit,
                    motor_deficit=motor_deficit,
                    developmental_delay=developmental_delay
                ))

                # If analysis returns True, set CAPD flag and add source
                if analysis_result:
                    print(f"CAPD detected in flowsheet instance at {timestamp}")
                    flags["CAPD"]["state"] = True
                    flags["CAPD"]["sources"].append({
                        "type": "flowsheet",
                        "details": {
                            "flowsheet_instance": instance,
                            "analysis_inputs": {
                                "sensory_deficit": sensory_deficit,
                                "motor_deficit": motor_deficit,
                                "developmental_delay": developmental_delay
                            }
                        }
                    })

            except Exception as e:
                logger.error(f"Error processing flowsheet instance {instance_id} at {timestamp}: {e}")

    except Exception as e:
        logger.error(f"Error getting flowsheets for MRN {mrn}, CSN {csn}: {e}")


def analyze_single_note_for_flag(note_text, note_dict, note_id, flag_key, criteria_config):
    """Analyze a single note for a specific flag criteria"""
    criteria_name = criteria_config["name"]
    criteria_text = criteria_config["criteria"]

    # Use IdentifyFlag tool to check for the criteria
    flag_result = IdentifyFlag(dataset=DATASET)(inputs=IdentifyFlagInput(text=note_text, criteria=criteria_text))

    print(f"{criteria_name} Analysis: {flag_result.flag_state}")

    result = {
        "flag_detected": flag_result.flag_state,
        "source_data": None
    }

    if flag_result.flag_state:
        print(f" {criteria_name} DETECTED in this note")
        result["source_data"] = {
            "type": "note",
            "details": {
                **note_dict,  # Include all note metadata
                "criteria": criteria_text,
                "criteria_name": criteria_name,
                "highlighted_text": flag_result.formatted_text
            }
        }
    else:
        print(f" {criteria_name} NOT detected in this note")

    return result


def check_notes(flags, mrn, csn):
    """Check patient notes using IdentifyFlag tool for multiple criteria"""
    try:
        # Get all note IDs
        note_ids = GetPatientNotesIds(dataset=DATASET)(inputs=GetPatientNotesIdsInput(mrn=mrn, csn=csn))
        print(f"\n=== Note Information for Patient MRN: {mrn}, CSN: {csn} ===")
        print(f"Total note IDs found: {len(note_ids)}")

        if not note_ids:
            print("No notes found for this patient encounter.")
            return

        # Initialize tracking for each flag
        flag_results = {flag_key: [] for flag_key in NOTE_FLAG_CRITERIA.keys()}

        # Process each note
        for i, note_id in enumerate(note_ids):
            try:
                print(f"\n--- Analyzing Note {i+1}/{len(note_ids)} (ID: {note_id}) ---")

                # Read the note
                note_json_string = ReadPatientNote(dataset=DATASET)(inputs=ReadPatientNoteInput(mrn=mrn, csn=csn, note_id=note_id))
                note_dict = json.loads(note_json_string)

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
                    if flag_key in flags:  # Only check flags that exist in the flags dict
                        print(f"\n  --- {criteria_config['name']} ---")

                        result = analyze_single_note_for_flag(note_text, note_dict, note_id, flag_key, criteria_config)

                        if result["flag_detected"]:
                            flags[flag_key]["state"] = True
                            flags[flag_key]["sources"].append(result["source_data"])
                            flag_results[flag_key].append(result["source_data"])

            except Exception as e:
                logger.error(f"Error processing note {note_id}: {e}")

    except Exception as e:
        logger.error(f"Error getting notes for MRN {mrn}, CSN {csn}: {e}")


def run_workflow(mrn, csn):
    """
    Run delirium screening workflow on a patient encounter.
    Returns flags dict with all screening results.

    Args:
        mrn: Patient MRN
        csn: Patient CSN

    Returns:
        dict: {
            "mrn": mrn,
            "csn": csn,
            "flags": flags_dict
        }
    """
    # Initialize flags with default structure
    flags = {
        "DSM_5_criteria_1": {"state": False, "sources": []},
        "DSM_5_criteria_2": {"state": False, "sources": []},
        "DSM_5_criteria_3": {"state": False, "sources": []},

        "mechanical_ventilation": {"state": False, "sources": []},
        "post_op_state": {"state": False, "sources": []},
        "explicit_delirium_mention": {"state": False, "sources": []},

        "treatment_medications": {
            "state": False,
            "medications": ["haloperidol", "risperidone", "quetiapine", "olanzapine", "aripiprazole", "dexmedetomidine", "clonidine"],
            "sources": []
        },

        "CAPD": {"state": False, "sources": []},

        "positive_correlation_diagnosis": {"state": False, "diagnoses": ["active infection", "sepsis", "delirium"], "sources": []},
    }

    logger.info(f"Starting delirium screening workflow for MRN {mrn}, CSN {csn}")

    # Process medications
    try:
        print('Checking medications...')
        check_medications(flags, mrn, csn)
    except Exception as e:
        logger.error(f"Error in medication check for MRN {mrn}, CSN {csn}: {e}")

    # Process diagnoses
    try:
        print('Checking diagnoses...')
        check_diagnoses(flags, mrn, csn)
    except Exception as e:
        logger.error(f"Error in diagnosis check for MRN {mrn}, CSN {csn}: {e}")

    # Process flowsheets
    try:
        print('Checking flowsheets...')
        check_flowsheets(flags, mrn, csn)
    except Exception as e:
        logger.error(f"Error in flowsheet check for MRN {mrn}, CSN {csn}: {e}")

    # Process notes
    try:
        print('Checking notes...')
        check_notes(flags, mrn, csn)
    except Exception as e:
        logger.error(f"Error in notes check for MRN {mrn}, CSN {csn}: {e}")

    logger.info(f"Completed delirium screening workflow for MRN {mrn}, CSN {csn}")

    return {
        "mrn": mrn,
        "csn": csn,
        "flags": flags
    }
