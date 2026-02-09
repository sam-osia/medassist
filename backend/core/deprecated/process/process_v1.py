from openai import OpenAI
from dotenv import load_dotenv
import os
import json
import datetime

from core.workflow.tools.notes import (
    GetPatientNotesIds, ReadPatientNote,
    SummarizePatientNote, SemanticKeywordCount)
from core.workflow.tools.medications import (
    GetMedicationsIds, ReadMedication)
from core.workflow.tools.flowsheets import (
    ReadFlowsheetsTable, SummarizeFlowsheetsTable, AnalyzeFlowsheetInstance)
from core.workflow.tools.diagnosis import (
    GetDiagnosisIds, ReadDiagnosis)
from core.workflow.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput,
    SemanticKeywordCountInput,
    GetMedicationsIdsInput, ReadMedicationInput, GetDiagnosisIdsInput, ReadDiagnosisInput,
    ReadFlowsheetsTableInput, AnalyzeFlowsheetInstanceInput)


def check_medications(flags, mrn, csn):
    """Check patient medications against a list of target medications and update flags"""
    medications_to_check = flags["treatment_medications"]["medications"]
    
    medications_ids = GetMedicationsIds()(inputs=GetMedicationsIdsInput(mrn=mrn, csn=csn))
    for medication_id in medications_ids:
        medication_json_string = ReadMedication()(inputs=ReadMedicationInput(mrn=mrn, csn=csn, order_id=medication_id))
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
        
        for med_to_check in medications_to_check:
            if med_to_check.lower() in medication_name or med_to_check.lower() in simple_generic_name:
                print(f"Found matching medication: {medication_dict.get('medication_name', 'N/A')}")
                flags["treatment_medications"]["state"] = True
                flags["treatment_medications"]["sources"].append({
                    "type": "medications",
                    "details": medication_dict
                })


def reformat_flowsheets_for_analysis(flowsheets_pivot_json):
    """
    Reformat flowsheets pivot data to enable individual flowsheet instance analysis.
    
    Takes the output from ReadFlowsheetsTable and reorganizes it by timestamp
    so each flowsheet test instance can be analyzed independently.
    
    Args:
        flowsheets_pivot_json (str): JSON string from ReadFlowsheetsTable
        
    Returns:
        list: List of flowsheet instances, each grouped by timestamp
    """
    try:
        flowsheets_pivot = json.loads(flowsheets_pivot_json)
    except json.JSONDecodeError:
        return []
    
    if not flowsheets_pivot or not flowsheets_pivot.get('measurements'):
        return []
    
    # Collect all unique timestamps across all measurements
    all_timestamps = set()
    for measurement in flowsheets_pivot['measurements']:
        for timestamp in measurement.get('time_values', {}):
            all_timestamps.add(timestamp)
    
    # Sort timestamps chronologically
    sorted_timestamps = sorted(all_timestamps)
    
    flowsheet_instances = []
    
    for timestamp in sorted_timestamps:
        instance = {
            "timestamp": timestamp,
            "measurements": {}
        }
        
        # Collect measurements for this timestamp
        for measurement in flowsheets_pivot['measurements']:
            time_values = measurement.get('time_values', {})
            if timestamp in time_values:
                flo_meas_name = measurement.get('flo_meas_name', '')
                measurement_key = flo_meas_name.lower().replace(' ', '_')
                
                instance["measurements"][measurement_key] = {
                    "flo_meas_id": measurement.get('flo_meas_id'),
                    "flo_meas_name": flo_meas_name,
                    "disp_name": measurement.get('disp_name'),
                    "value": time_values[timestamp].get('value'),
                    "comment": time_values[timestamp].get('comment')
                }
        
        flowsheet_instances.append(instance)
    
    return flowsheet_instances


def check_flowsheets(flags, mrn, csn):
    """Check patient flowsheets for CAPD analysis and update flags"""
    # Read and reformat flowsheets
    flowsheets_json = ReadFlowsheetsTable()(inputs=ReadFlowsheetsTableInput(mrn=mrn, csn=csn))
    flowsheet_instances = reformat_flowsheets_for_analysis(flowsheets_json)
    
    # Print all flowsheet instances
    for i, instance in enumerate(flowsheet_instances):
        # Run analysis on this instance
        sensory_deficit = flags["sensory_deficit"]["state"]
        motor_deficit = flags["motor_deficit"]["state"]
        developmental_delay = flags["developmental_delay"]["state"]
        
        analysis_result = AnalyzeFlowsheetInstance()(inputs=AnalyzeFlowsheetInstanceInput(
            flowsheet_instance=json.dumps(instance),
            sensory_deficit=sensory_deficit,
            motor_deficit=motor_deficit,
            developmental_delay=developmental_delay
        ))
        
        # If analysis returns True, set CAPD flag and add source
        if analysis_result:
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


def check_diagnoses(flags, mrn, csn):
    """Check patient diagnoses against positive correlation diagnoses and update flags"""
    # Get all diagnosis IDs for the patient
    diagnosis_ids = GetDiagnosisIds()(inputs=GetDiagnosisIdsInput(mrn=mrn, csn=csn))
    print(f"\n=== Diagnosis Information for Patient MRN: {mrn}, CSN: {csn} ===")
    print(f"Total diagnosis IDs found: {len(diagnosis_ids)}")
    
    # Loop through all diagnosis IDs and check for matches
    positive_diagnoses_to_check = flags["positive_correlation_diagnosis"]["diagnoses"]
    
    for diagnosis_id in diagnosis_ids:
        diagnosis_json_string = ReadDiagnosis()(inputs=ReadDiagnosisInput(mrn=mrn, csn=csn, diagnosis_id=diagnosis_id))
        diagnosis_dict = json.loads(diagnosis_json_string)
        
        # Get diagnosis name and convert to lowercase for comparison
        diagnosis_name = str(diagnosis_dict.get('diagnosis_name', '')).lower()
        
        # Skip if diagnosis name is nan or empty
        if diagnosis_name == 'nan' or not diagnosis_name:
            continue
        
        # Check if any positive correlation diagnosis is contained in the diagnosis name
        for positive_diagnosis in positive_diagnoses_to_check:
            if positive_diagnosis.lower() in diagnosis_name:
                print(f"Found matching diagnosis: {diagnosis_dict.get('diagnosis_name', 'N/A')}")
                flags["positive_correlation_diagnosis"]["state"] = True
                flags["positive_correlation_diagnosis"]["sources"].append({
                    "type": "diagnosis",
                    "details": diagnosis_dict
                })
    
    # Print the first diagnosis if available (for display purposes)
    if diagnosis_ids:
        first_diagnosis_id = diagnosis_ids[0]
        diagnosis_json_string = ReadDiagnosis()(inputs=ReadDiagnosisInput(mrn=mrn, csn=csn, diagnosis_id=first_diagnosis_id))
        diagnosis_dict = json.loads(diagnosis_json_string)
        
        print(f"\nFirst Diagnosis (ID: {first_diagnosis_id}):")
        print(f"  Diagnosis Name: {diagnosis_dict.get('diagnosis_name', 'N/A')}")
        print(f"  Diagnosis Code: {diagnosis_dict.get('diagnosis_code', 'N/A')}")
        print(f"  Code Set: {diagnosis_dict.get('code_set', 'N/A')}")
        print(f"  Is Chronic: {diagnosis_dict.get('is_chronic', 'N/A')}")
        print(f"  Date: {diagnosis_dict.get('date', 'N/A')}")
    else:
        print("No diagnoses found for this patient encounter.")


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
    # "DSM_5_criteria_4": {
    #     "name": "DSM-5 Criteria 4 (Not Better Explained)",
    #     "criteria": "The disturbance is not better explained by another mental disorder (e.g., schizophrenia) and is not due to a substance (e.g., intoxication, withdrawal)."
    # },
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


def analyze_single_note_for_flag(note_text, note_dict, note_id, flag_key, criteria_config):
    """Analyze a single note for a specific flag criteria"""
    criteria_name = criteria_config["name"]
    criteria_text = criteria_config["criteria"]
    
    # Use IdentifyFlag tool to check for the criteria
    flag_result = IdentifyFlag()(inputs=IdentifyFlagInput(text=note_text, criteria=criteria_text))
    
    print(f"{criteria_name} Analysis: {flag_result.flag_state}")
    
    result = {
        "flag_detected": flag_result.flag_state,
        "source_data": None
    }
    
    if flag_result.flag_state:
        print(f"✓ {criteria_name} DETECTED in this note")
        result["source_data"] = {
            "type": "note",
            "details": {
                "note_id": note_id,
                "note_type": note_dict.get('note_type', 'N/A'),
                "criteria": criteria_text,
                "criteria_name": criteria_name,
                "highlighted_text": flag_result.formatted_text
            }
        }
    else:
        print(f"✗ {criteria_name} NOT detected in this note")
    
    return result


def check_notes(flags, mrn, csn):
    """Check patient notes using IdentifyFlag tool for multiple criteria"""
    # Get all note IDs for the patient
    note_ids = GetPatientNotesIds()(inputs=GetPatientNotesIdsInput(mrn=mrn, csn=csn))
    print(f"\n=== Note Information for Patient MRN: {mrn}, CSN: {csn} ===")
    print(f"Total note IDs found: {len(note_ids)}")
    
    if not note_ids:
        print("No notes found for this patient encounter.")
        return
    
    # Initialize tracking for each flag
    flag_results = {flag_key: [] for flag_key in NOTE_FLAG_CRITERIA.keys()}
    
    # Loop through notes
    for i, note_id in enumerate(note_ids[:10]):
        print(f"\n--- Analyzing Note {i+1}/{len(note_ids)} (ID: {note_id}) ---")

        # Read the note
        note_json_string = ReadPatientNote()(inputs=ReadPatientNoteInput(mrn=mrn, csn=csn, note_id=note_id))
        note_dict = json.loads(note_json_string)
        
        note_type = note_dict.get('note_type', 'N/A')
        print(f"Note Type: {note_type}")

        # Check if note type should be analyzed (if NOTE_TYPES_TO_ANALYZE is not empty)
        # Use substring matching - note type must contain at least one of the strings in the list
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


def print_flags(flags, mrn, csn):
    """Print flags in a formatted way with red highlighting for true flags"""
    print(f"\n=== Patient MRN: {mrn}, CSN: {csn} ===")
    
    # ANSI color codes
    RED = '\033[91m'
    YELLOW_BOLD = '\033[1;33m'  # Bold yellow
    RESET = '\033[0m'
    
    def format_highlighted_text(text):
        """Convert <highlight></highlight> tags to bold yellow ANSI codes"""
        if not text:
            return text
        # Replace opening highlight tags with bold yellow
        text = text.replace('<highlight>', YELLOW_BOLD)
        # Replace closing highlight tags with reset
        text = text.replace('</highlight>', RESET)
        return text
    
    for flag_name, flag_data in flags.items():
        # Skip threshold values
        if flag_name.endswith('_threshold'):
            continue
            
        if isinstance(flag_data, dict) and 'state' in flag_data:
            if flag_data['state']:
                # Print in red for true flags with sources
                print(f"{RED}{flag_name}: {flag_data['state']}{RESET}")
                if flag_data['sources']:
                    for i, source in enumerate(flag_data['sources']):
                        print(f"  Source {i+1}: {source['type']}")
                        if 'details' in source:
                            if source['type'] == 'flowsheet':
                                # Handle flowsheet sources with cleaner formatting
                                details = source['details']
                                flowsheet_instance = details.get('flowsheet_instance', {})
                                analysis_inputs = details.get('analysis_inputs', {})
                                
                                print(f"    Timestamp: {flowsheet_instance.get('timestamp', 'N/A')}")
                                print(f"    Analysis Conditions:")
                                print(f"      Sensory Deficit: {analysis_inputs.get('sensory_deficit', False)}")
                                print(f"      Motor Deficit: {analysis_inputs.get('motor_deficit', False)}")
                                print(f"      Developmental Delay: {analysis_inputs.get('developmental_delay', False)}")
                                
                                # Find and display CAPD total score in red if available
                                measurements = flowsheet_instance.get('measurements', {})
                                for measurement_key, measurement_data in measurements.items():
                                    if measurement_data.get('flo_meas_name') == 'SK IP R CAPD TOTAL SCORE':
                                        score_value = measurement_data.get('value', 'N/A')
                                        print(f"    {RED}CAPD Total Score: {score_value}{RESET}")
                                        break
                            elif source['type'] == 'medications':
                                # Handle medication sources with medication name in red
                                details = source['details']
                                medication_name = details.get('medication_name', 'N/A')
                                print(f"    {RED}Medication: {medication_name}{RESET}")
                                print(f"    Order ID: {details.get('order_id', 'N/A')}")
                                print(f"    Dosage: {details.get('dosage_given_amount', 'N/A')} {details.get('dosage_given_unit', 'N/A')}")
                                print(f"    Frequency: {details.get('dosing_frequency', 'N/A')}")
                            elif source['type'] == 'diagnosis':
                                # Handle diagnosis sources
                                details = source['details']
                                diagnosis_name = details.get('diagnosis_name', 'N/A')
                                print(f"    Diagnosis: {diagnosis_name}")
                                print(f"    Code: {details.get('diagnosis_code', 'N/A')}")
                                print(f"    Code Set: {details.get('code_set', 'N/A')}")
                            elif source['type'] == 'note':
                                # Handle note sources
                                details = source['details']
                                note_type = details.get('note_type', 'N/A')
                                note_date = details.get('note_date', 'N/A')
                                criteria_name = details.get('criteria_name', 'N/A')
                                print(f"    {RED}Note ID: {details.get('note_id', 'N/A')}{RESET}")
                                print(f"    Note Type: {note_type}")
                                print(f"    Criteria: {criteria_name}")
                                # Display highlighted text with bold yellow formatting
                                highlighted_text = details.get('highlighted_text', '')
                                if highlighted_text:
                                    formatted_text = format_highlighted_text(highlighted_text)
                                    print(f"    Text: {formatted_text}")
                            else:
                                # Handle other source types as before
                                print(f"    Details: {source['details']}")
            else:
                # Print in normal color for false flags without sources
                print(f"{flag_name}: {flag_data['state']}")
    print("=" * 40)


def create_experiment_folder(experiment_name):
    """Create experiment directory structure"""
    experiment_dir = os.path.join("experiments", experiment_name)
    os.makedirs(experiment_dir, exist_ok=True)
    return experiment_dir


def save_experiment_metadata(experiment_name):
    """Save experiment metadata.json"""
    experiment_dir = os.path.join("experiments", experiment_name)
    current_time = datetime.datetime.now().isoformat()
    
    metadata = {
        "name": experiment_name,
        "created_date": current_time,
        "last_modified_date": current_time
    }
    
    metadata_path = os.path.join(experiment_dir, "metadata.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Saved experiment metadata to {metadata_path}")


def save_experiment_results(experiment_name, results_data):
    """Save experiment results.json"""
    experiment_dir = os.path.join("experiments", experiment_name)
    results_path = os.path.join(experiment_dir, "results.json")
    
    with open(results_path, 'w') as f:
        json.dump(results_data, f, indent=2)
    
    print(f"Saved experiment results to {results_path}")


def collect_patient_results(mrn, csn, flags):
    """Format single patient data for storage"""
    return {
        "mrn": mrn,
        "encounters": [
            {
                "csn": csn,
                "flags": flags
            }
        ]
    }


def main():
    load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY")

    client = OpenAI(api_key=api_key)
    model_name = "gpt-4o-2024-11-20"

    # Experiment setup
    experiment_name = "test_v0"
    print(f"Starting experiment: {experiment_name}")
    
    # Create experiment folder and save metadata
    create_experiment_folder(experiment_name)
    save_experiment_metadata(experiment_name)

    patients = [{"mrn": 2075253, "csn": 18303177}, ]
    all_results = {"patients": []}

    for patient in patients:
        flags = {
            "sensory_deficit": {"state": False, "sources": []},
            "motor_deficit": {"state": False, "sources": []},
            "developmental_delay": {"state": False, "sources": []},
            
            "DSM_5_criteria_1": {"state": False, "sources": []},
            "DSM_5_criteria_2": {"state": False, "sources": []},
            "DSM_5_criteria_3": {"state": False, "sources": []},
            "DSM_5_criteria_4": {"state": False, "sources": []},
            "DSM_5_criteria_5": {"state": True, "sources": []},
            
            "ICD_11_criteria_1": {"state": False, "sources": []},
            "ICD_11_criteria_2": {"state": False, "sources": []},
            "ICD_11_criteria_3": {"state": False, "sources": []},
            "ICD_11_criteria_4": {"state": False, "sources": []},
            "ICD_11_criteria_5": {"state": False, "sources": []},

            "mechanical_ventilation": {"state": False, "sources": []},
            "post_op_state": {"state": False, "sources": []},
            "explicit_delirium_mention": {"state": False, "sources": []},

            "treatment_medications": {"state": False, "medications": ["haloperidol", "risperidone", "quetiapine", "olanzapine", "aripiprazole", "dexmedetomidine", "clonidine"], "sources": []},

            "CAPD": {"state": False, "sources": []},

            "length_of_stay": {"state": False, "sources": []},
            "length_of_stay_threshold": 5,

            "positive_correlation_diagnosis": {"state": False, "diagnoses": ["active infection", "sepsis", "delirium"], "sources": []},
            "negative_correlation_diagnosis": {"state": False, "diagnoses": ["schizophrenia", "psychosis", "encephalopathy"], "sources": []},
        }

        mrn = patient["mrn"]
        csn = patient["csn"]

        check_medications(flags, mrn, csn)
        # check_flowsheets(flags, mrn, csn)
        check_diagnoses(flags, mrn, csn)
        check_notes(flags, mrn, csn)

        print_flags(flags, mrn, csn)
        
        # Collect results for this patient
        patient_results = collect_patient_results(mrn, csn, flags)
        all_results["patients"].append(patient_results)
    
    # Save experiment results
    save_experiment_results(experiment_name, all_results)
    print(f"Experiment {experiment_name} completed successfully!")

if __name__ == "__main__":
    main()