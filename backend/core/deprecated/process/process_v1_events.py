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
from core.data.dataloader import get_patient_details
from core.workflow.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput,
    SemanticKeywordCountInput,
    GetMedicationsIdsInput, ReadMedicationInput, GetDiagnosisIdsInput, ReadDiagnosisInput,
    ReadFlowsheetsTableInput, AnalyzeFlowsheetInstanceInput)
from core.workflow.utils.event_handler import (
    publish_tool_call_with_data_item, publish_tool_result_with_data_item,
    publish_llm_thinking, publish_progress_update, publish_final_result, publish_error,
    publish_workflow_complete
)


DATASET = 'SickKids Demo'

def check_medications_stream(flags, mrn, csn):
    """Check patient medications against a list of target medications with streaming events"""
    medications_to_check = flags["treatment_medications"]["medications"]
    
    try:
        # Get all medication IDs
        yield from publish_tool_call_with_data_item(
            "get_medications_ids", 
            {"mrn": mrn, "csn": csn},
            data_item_type="medications",
            data_item_id="all",
            status="loading"
        )
        
        medications_ids = GetMedicationsIds(dataset=DATASET)(inputs=GetMedicationsIdsInput(mrn=mrn, csn=csn))
        
        yield from publish_tool_result_with_data_item(
            "get_medications_ids",
            {"count": len(medications_ids)},
            data_item_type="medications", 
            data_item_id="all",
            status="loaded"
        )
        
        # Process each medication
        for medication_id in medications_ids:
            try:
                # Read medication
                yield from publish_tool_call_with_data_item(
                    "read_medication",
                    {"mrn": mrn, "csn": csn, "order_id": medication_id},
                    data_item_type="medications",
                    data_item_id=medication_id,
                    status="reading"
                )
                
                medication_json_string = ReadMedication(dataset=DATASET)(inputs=ReadMedicationInput(mrn=mrn, csn=csn, order_id=medication_id))
                medication_dict = json.loads(medication_json_string)
                
                yield from publish_tool_result_with_data_item(
                    "read_medication",
                    {"medication_name": medication_dict.get('medication_name', 'N/A')},
                    data_item_type="medications",
                    data_item_id=medication_id, 
                    status="checking"
                )
                
                # Check medication against target list
                yield from publish_tool_call_with_data_item(
                    "check_medication_match",
                    {"medication_id": medication_id, "targets": medications_to_check},
                    data_item_type="medications",
                    data_item_id=medication_id,
                    status="checking"
                )
                
                # Check if medication name or simple generic name matches any in medications_to_check
                medication_name = str(medication_dict.get('medication_name', '')).lower()
                simple_generic_name = str(medication_dict.get('simple_generic_name', '')).lower()
                
                # Skip if both names are nan
                if medication_name == 'nan' and simple_generic_name == 'nan':
                    yield from publish_tool_result_with_data_item(
                        "check_medication_match",
                        {"match_found": False, "reason": "No valid medication name"},
                        data_item_type="medications",
                        data_item_id=medication_id,
                        status="completed"
                    )
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
                
                yield from publish_tool_result_with_data_item(
                    "check_medication_match",
                    {"match_found": match_found, "medication_name": medication_dict.get('medication_name', 'N/A')},
                    data_item_type="medications",
                    data_item_id=medication_id,
                    status="completed"
                )
                
            except Exception as e:
                yield from publish_error(
                    "medication_processing", 
                    str(e), 
                    tool_name="read_medication",
                    args={"medication_id": medication_id}
                )
                
    except Exception as e:
        yield from publish_error(
            "medications_check",
            str(e),
            tool_name="get_medications_ids"
        )

def check_flowsheets_stream(flags, mrn, csn):
    """Check patient flowsheets for CAPD analysis with streaming events"""
    try:
        # Get flowsheet instances directly from dataloader
        yield from publish_tool_call_with_data_item(
            "get_flowsheet_instances",
            {"mrn": mrn, "csn": csn},
            data_item_type="flowsheets",
            data_item_id="all",
            status="loading"
        )

        # Get patient details and extract flowsheet instances for matching CSN
        patient_details = get_patient_details(str(mrn))
        flowsheet_instances = []

        if patient_details and patient_details.get("encounters"):
            for encounter in patient_details["encounters"]:
                if int(encounter.get("csn")) == csn:
                    print('Found matching encounter for flowsheets')
                    print(f"Encounter CSN: {encounter.get('csn', 'N/A')}")
                    # print the headings of the encounter
                    print(encounter.keys())
                    flowsheet_instances = encounter.get("flowsheets_instances", [])
                    break

        yield from publish_tool_result_with_data_item(
            "get_flowsheet_instances",
            {"instances_count": len(flowsheet_instances)},
            data_item_type="flowsheets",
            data_item_id="all",
            status="loaded"
        )
        
        if not flowsheet_instances:
            yield from publish_progress_update(
                "No flowsheet instances found for analysis",
                data_item_type="flowsheets",
                data_item_id="all",
                status="completed"
            )
            return

        print('3')

        # Process each flowsheet instance
        for i, instance in enumerate(flowsheet_instances):
            instance_id = f"instance_{i}"
            timestamp = instance.get('timestamp', 'N/A')
            
            try:
                print('n--- Analyzing Flowsheet Instance ---')
                yield from publish_tool_call_with_data_item(
                    "analyze_flowsheet_instance",
                    {
                        "instance_id": instance_id,
                        "timestamp": timestamp,
                        "measurements_count": len(instance.get('measurements', {}))
                    },
                    data_item_type="flowsheets",
                    data_item_id=instance_id,
                    status="analyzing"
                )
                
                # Get current flag states for analysis
                # Check if these flags exist in the flags dict
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
                
                yield from publish_tool_result_with_data_item(
                    "analyze_flowsheet_instance",
                    {
                        "capd_detected": analysis_result,
                        "timestamp": timestamp,
                        "analysis_inputs": {
                            "sensory_deficit": sensory_deficit,
                            "motor_deficit": motor_deficit,
                            "developmental_delay": developmental_delay
                        }
                    },
                    data_item_type="flowsheets",
                    data_item_id=instance_id,
                    status="completed" if not analysis_result else "flagged"
                )
                
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
                yield from publish_error(
                    "flowsheet_instance_processing",
                    str(e),
                    tool_name="analyze_flowsheet_instance",
                    args={"instance_id": instance_id, "timestamp": timestamp}
                )
                
    except Exception as e:
        yield from publish_error(
            "flowsheets_checheck_nock",
            str(e),
            tool_name="read_flowsheets_table"
        )


def check_diagnoses_stream(flags, mrn, csn):
    """Check patient diagnoses against positive correlation diagnoses with streaming events"""
    positive_diagnoses_to_check = flags["positive_correlation_diagnosis"]["diagnoses"]
    
    try:
        # Get all diagnosis IDs
        yield from publish_tool_call_with_data_item(
            "get_diagnosis_ids",
            {"mrn": mrn, "csn": csn},
            data_item_type="diagnoses",
            data_item_id="all",
            status="loading"
        )
        
        diagnosis_ids = GetDiagnosisIds(dataset=DATASET)(inputs=GetDiagnosisIdsInput(mrn=mrn, csn=csn))
        print(f"\n=== Diagnosis Information for Patient MRN: {mrn}, CSN: {csn} ===")
        print(f"Total diagnosis IDs found: {len(diagnosis_ids)}")
        
        yield from publish_tool_result_with_data_item(
            "get_diagnosis_ids",
            {"count": len(diagnosis_ids)},
            data_item_type="diagnoses",
            data_item_id="all", 
            status="loaded"
        )
        
        # Process each diagnosis
        for diagnosis_id in diagnosis_ids:
            try:
                # Read diagnosis
                yield from publish_tool_call_with_data_item(
                    "read_diagnosis",
                    {"mrn": mrn, "csn": csn, "diagnosis_id": diagnosis_id},
                    data_item_type="diagnoses",
                    data_item_id=diagnosis_id,
                    status="reading"
                )
                
                diagnosis_json_string = ReadDiagnosis(dataset=DATASET)(inputs=ReadDiagnosisInput(mrn=mrn, csn=csn, diagnosis_id=diagnosis_id))
                diagnosis_dict = json.loads(diagnosis_json_string)
                
                yield from publish_tool_result_with_data_item(
                    "read_diagnosis",
                    {"diagnosis_name": diagnosis_dict.get('diagnosis_name', 'N/A')},
                    data_item_type="diagnoses",
                    data_item_id=diagnosis_id,
                    status="processing"
                )
                
                # Check diagnosis against positive correlation list
                yield from publish_tool_call_with_data_item(
                    "check_diagnosis_correlation",
                    {"diagnosis_id": diagnosis_id, "targets": positive_diagnoses_to_check},
                    data_item_type="diagnoses",
                    data_item_id=diagnosis_id,
                    status="processing"
                )
                
                # Get diagnosis name and convert to lowercase for comparison
                diagnosis_name = str(diagnosis_dict.get('diagnosis_name', '')).lower()
                
                # Skip if diagnosis name is nan or empty
                if diagnosis_name == 'nan' or not diagnosis_name:
                    yield from publish_tool_result_with_data_item(
                        "check_diagnosis_correlation",
                        {"match_found": False, "reason": "No valid diagnosis name"},
                        data_item_type="diagnoses",
                        data_item_id=diagnosis_id,
                        status="completed"
                    )
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
                
                yield from publish_tool_result_with_data_item(
                    "check_diagnosis_correlation",
                    {"match_found": match_found, "diagnosis_name": diagnosis_dict.get('diagnosis_name', 'N/A')},
                    data_item_type="diagnoses",
                    data_item_id=diagnosis_id,
                    status="completed"
                )
                
            except Exception as e:
                yield from publish_error(
                    "diagnosis_processing",
                    str(e),
                    tool_name="read_diagnosis",
                    args={"diagnosis_id": diagnosis_id}
                )
        
        # Print first diagnosis for display purposes
        if diagnosis_ids:
            first_diagnosis_id = diagnosis_ids[0]
            diagnosis_json_string = ReadDiagnosis(dataset=DATASET)(inputs=ReadDiagnosisInput(mrn=mrn, csn=csn, diagnosis_id=first_diagnosis_id))
            diagnosis_dict = json.loads(diagnosis_json_string)
            
            print(f"\nFirst Diagnosis (ID: {first_diagnosis_id}):")
            print(f"  Diagnosis Name: {diagnosis_dict.get('diagnosis_name', 'N/A')}")
            print(f"  Diagnosis Code: {diagnosis_dict.get('diagnosis_code', 'N/A')}")
            print(f"  Code Set: {diagnosis_dict.get('code_set', 'N/A')}")
            print(f"  Is Chronic: {diagnosis_dict.get('is_chronic', 'N/A')}")
            print(f"  Date: {diagnosis_dict.get('date', 'N/A')}")
        else:
            print("No diagnoses found for this patient encounter.")
            
    except Exception as e:
        yield from publish_error(
            "diagnoses_check",
            str(e),
            tool_name="get_diagnosis_ids"
        )


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
    flag_result = IdentifyFlag(dataset=DATASET)(inputs=IdentifyFlagInput(text=note_text, criteria=criteria_text))
    
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
                **note_dict,  # Include all note metadata
                "criteria": criteria_text,
                "criteria_name": criteria_name,
                "highlighted_text": flag_result.formatted_text
            }
        }
    else:
        print(f"✗ {criteria_name} NOT detected in this note")
    
    return result


def check_notes_stream(flags, mrn, csn):
    """Check patient notes using IdentifyFlag tool for multiple criteria with streaming events"""
    try:
        # Get all note IDs
        yield from publish_tool_call_with_data_item(
            "get_patient_notes_ids",
            {"mrn": mrn, "csn": csn},
            data_item_type="notes",
            data_item_id="all",
            status="loading"
        )
        
        note_ids = GetPatientNotesIds(dataset=DATASET)(inputs=GetPatientNotesIdsInput(mrn=mrn, csn=csn))
        print(f"\n=== Note Information for Patient MRN: {mrn}, CSN: {csn} ===")
        print(f"Total note IDs found: {len(note_ids)}")
        
        yield from publish_tool_result_with_data_item(
            "get_patient_notes_ids",
            {"count": len(note_ids)},
            data_item_type="notes",
            data_item_id="all",
            status="loaded"
        )
        
        if not note_ids:
            print("No notes found for this patient encounter.")
            return
        
        # Initialize tracking for each flag
        flag_results = {flag_key: [] for flag_key in NOTE_FLAG_CRITERIA.keys()}
        
        # Process each note (limit to first 10)
        for i, note_id in enumerate(note_ids):
            try:
                print(f"\n--- Analyzing Note {i+1}/{len(note_ids)} (ID: {note_id}) ---")

                # Read the note
                yield from publish_tool_call_with_data_item(
                    "read_patient_note",
                    {"mrn": mrn, "csn": csn, "note_id": note_id},
                data_item_type="notes",
                    data_item_id=note_id,
                    status="reading"
                )
                
                note_json_string = ReadPatientNote(dataset=DATASET)(inputs=ReadPatientNoteInput(mrn=mrn, csn=csn, note_id=note_id))
                note_dict = json.loads(note_json_string)
                
                note_type = note_dict.get('note_type', 'N/A')
                print(f"Note Type: {note_type}")
                
                yield from publish_tool_result_with_data_item(
                    "read_patient_note",
                    {"note_type": note_type, "note_length": len(note_dict.get('note_text', ''))},
                    data_item_type="notes",
                    data_item_id=note_id,
                    status="analyzing"
                )

                # Check if note type should be analyzed
                if NOTE_TYPES_TO_ANALYZE:
                    should_analyze = any(analyze_type.lower() in note_type.lower() for analyze_type in NOTE_TYPES_TO_ANALYZE)
                
                # Get the note text
                note_text = note_dict.get('note_text', '')
                if not note_text or note_text.strip() == '':
                    print("No note text available for analysis.")
                    yield from publish_tool_result_with_data_item(
                        "analyze_note_criteria",
                        {"status": "skipped", "reason": "No note text"},
                        data_item_type="notes",
                        data_item_id=note_id,
                        status="completed"
                    )
                    continue
                    
                print(f"Note Text Length: {len(note_text)} characters")

                # Analyze this note for each configured flag criteria
                for flag_key, criteria_config in NOTE_FLAG_CRITERIA.items():
                    if flag_key in flags:  # Only check flags that exist in the flags dict
                        print(f"\n  --- {criteria_config['name']} ---")
                        
                        yield from publish_tool_call_with_data_item(
                            "analyze_note_criteria",
                            {"note_id": note_id, "criteria": criteria_config["name"]},
                            data_item_type="notes",
                            data_item_id=note_id,
                            status="analyzing"
                        )
                        
                        result = analyze_single_note_for_flag(note_text, note_dict, note_id, flag_key, criteria_config)
                        
                        yield from publish_tool_result_with_data_item(
                            "analyze_note_criteria",
                            {
                                "criteria": criteria_config["name"],
                                "flag_detected": result["flag_detected"],
                                "note_type": note_type
                            },
                            data_item_type="notes",
                            data_item_id=note_id,
                            status="analyzing" if result["flag_detected"] else "completed"
                        )
                        
                        if result["flag_detected"]:
                            flags[flag_key]["state"] = True
                            flags[flag_key]["sources"].append(result["source_data"])
                            flag_results[flag_key].append(result["source_data"])
                
                # Mark note processing as completed
                yield from publish_tool_result_with_data_item(
                    "process_note_complete",
                    {"note_id": note_id, "criteria_checked": len(NOTE_FLAG_CRITERIA)},
                    data_item_type="notes",
                    data_item_id=note_id,
                    status="completed"
                )
                            
            except Exception as e:
                yield from publish_error(
                    "note_processing",
                    str(e),
                    tool_name="read_patient_note",
                    args={"note_id": note_id}
                )
                
    except Exception as e:
        yield from publish_error(
            "notes_check",
            str(e),
            tool_name="get_patient_notes_ids"
        )

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


def process_workflow_stream(mrn, csn, experiment_name=None):
    """
    Main streaming workflow generator function that coordinates all data processing
    streams events for frontend visualization and returns final results
    
    Args:
        mrn: Patient MRN
        csn: Patient CSN  
        experiment_name: Optional experiment name to save results to
    """
    try:
        # Initialize flags with default structure
        flags = {
            # "sensory_deficit": {"state": False, "sources": []},
            # "motor_deficit": {"state": False, "sources": []},
            # "developmental_delay": {"state": False, "sources": []},
            
            "DSM_5_criteria_1": {"state": False, "sources": []},
            "DSM_5_criteria_2": {"state": False, "sources": []},
            "DSM_5_criteria_3": {"state": False, "sources": []},
            # "DSM_5_criteria_4": {"state": False, "sources": []},
            # "DSM_5_criteria_5": {"state": True, "sources": []},

            "mechanical_ventilation": {"state": False, "sources": []},
            "post_op_state": {"state": False, "sources": []},
            "explicit_delirium_mention": {"state": False, "sources": []},

            "treatment_medications": {"state": False, "medications": ["haloperidol", "risperidone", "quetiapine", "olanzapine", "aripiprazole", "dexmedetomidine", "clonidine"], "sources": []},

            "CAPD": {"state": False, "sources": []},

            # "length_of_stay": {"state": False, "sources": []},
            # "length_of_stay_threshold": 5,

            "diagnosis": {"state": False, "diagnoses": ["active infection", "sepsis", "delirium"], "sources": []},
            # "negative_correlation_diagnosis": {"state": False, "diagnoses": ["schizophrenia", "psychosis", "encephalopathy"], "sources": []},
        }
        
        # Emit workflow start event
        yield from publish_progress_update(
            f"Starting delirium screening workflow for MRN {mrn}, CSN {csn}",
            data_item_type="workflow",
            data_item_id=f"{mrn}-{csn}",
            status="processing"
        )

        # Process medications with streaming events
        yield from publish_progress_update(
            "Checking patient medications...",
            data_item_type="workflow",
            data_item_id=f"{mrn}-{csn}",
            status="processing"
        )

        try:
            print('checking medications...')
            yield from check_medications_stream(flags, mrn, csn)
        except Exception as e:
            yield from publish_error("medication_check", str(e))


        # Process diagnoses with streaming events
        yield from publish_progress_update(
            "Checking patient diagnoses...",
            data_item_type="workflow",
            data_item_id=f"{mrn}-{csn}",
            status="processing"
        )

        try:
            print('checking diagnoses...')
            yield from check_diagnoses_stream(flags, mrn, csn)
        except Exception as e:
            yield from publish_error("diagnosis_check", str(e))


        # Process flowsheets with streaming events
        yield from publish_progress_update(
            "Checking patient flowsheets...",
            data_item_type="workflow",
            data_item_id=f"{mrn}-{csn}",
            status="processing"
        )

        try:
            print('checking flowsheets...')
            yield from check_flowsheets_stream(flags, mrn, csn)
        except Exception as e:
            yield from publish_error("flowsheet_check", str(e))


        # Process notes with streaming events
        yield from publish_progress_update(
            "Analyzing patient notes...",
            data_item_type="workflow",
            data_item_id=f"{mrn}-{csn}",
            status="processing"
        )

        try:
            print('checking notes...')
            yield from check_notes_stream(flags, mrn, csn)
        except Exception as e:
            yield from publish_error("notes_check", str(e))

        # Emit workflow completion event
        yield from publish_workflow_complete("delirium_screening", mrn, csn)

        # Prepare final results
        results = {
            "mrn": mrn,
            "csn": csn,
            "flags": flags,
            "status": "completed",
            "workflow_type": "delirium_screening"
        }
        
        # Save to experiment if name provided
        if experiment_name:
            try:
                # Create experiment folder and save metadata
                create_experiment_folder(experiment_name)
                save_experiment_metadata(experiment_name)
                
                # Collect and save results
                patient_results = collect_patient_results(mrn, csn, flags)
                all_results = {"patients": [patient_results]}
                save_experiment_results(experiment_name, all_results)
                
                # Add experiment info to results
                results["experiment_name"] = experiment_name
                results["experiment_saved"] = True
                
            except Exception as e:
                yield from publish_error("experiment_save", f"Failed to save experiment: {str(e)}")
                results["experiment_saved"] = False
        
        # Emit final result
        yield from publish_final_result(results)
        
    except Exception as e:
        # Handle any top-level errors
        yield from publish_error("workflow", f"Fatal error in workflow: {str(e)}")
        
        # Still return partial results if possible
        results = {
            "mrn": mrn,
            "csn": csn, 
            "flags": flags if 'flags' in locals() else {},
            "status": "error",
            "error": str(e),
            "workflow_type": "delirium_screening"
        }
        yield from publish_final_result(results)


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

        print_flags(flags, mrn, csn)
        
        # Collect results for this patient
        patient_results = collect_patient_results(mrn, csn, flags)
        all_results["patients"].append(patient_results)
    
    # Save experiment results
    save_experiment_results(experiment_name, all_results)
    print(f"Experiment {experiment_name} completed successfully!")

if __name__ == "__main__":
    main()