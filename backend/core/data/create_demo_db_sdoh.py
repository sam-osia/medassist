import pandas as pd
import os
import json
import random
import datetime
import re

FILE_PATH = '../../dataset/sdoh_source.xlsx'
RESULTS_PATH = '../../dataset/sdoh_parsed_demo.json'
EXPERIMENT_PARENT_DIR = '../../experiments'

DEMO_MRN = [1298]

print("Loading SDOH dataset...")
xls = pd.ExcelFile(FILE_PATH)

# Get all sheet names
sheet_names = xls.sheet_names
# Sheet names: ['Language barrier', 'Financial strain', 'Social isolation', 'Housing insecurity', 'Depression', 'Addiction', 'Food insecurity', 'Transportation', 'Health literacy']

# Combine all sheets into single DataFrame
combined_dfs = []

for sheet in sheet_names:
    df = xls.parse(sheet)

    # rename columns to match existing dataset
    df = df.rename(columns={
        'Note_ID': 'note_id',
        'Raw_Clinical_Note': 'note_text',
        'Predicted_classification': 'result_classification',
        'Predicted_span': 'result_span',
        'Reasoning': 'result_reasoning',
        'MRN': 'mrn',
        'ENC_CSN_ID': 'csn',
        'NOTE_CSN_ID': 'note_csn_id',
        'NOTE_TYPE': 'note_type',
        'NOTE_CREATE_TIME': 'note_create_time',
    })

    # keep only the columns we need
    df = df[['note_id', 'note_text', 'result_classification', 'result_span', 'result_reasoning', 'mrn', 'csn',
             'note_csn_id', 'note_type', 'note_create_time']]

    combined_dfs.append(df)

# Combine all DataFrames
df_combined = pd.concat(combined_dfs, ignore_index=True)

# Drop duplicate note_ids
print(f"Total records before deduplication: {len(df_combined)}")
df_combined = df_combined.drop_duplicates(subset=['note_id'])
print(f"Total records after deduplication: {len(df_combined)}")

# Normalize note structure - add missing columns that exist in original dataset
df_combined['note_type_id'] = 'N/A'
df_combined['note_status'] = 'N/A'
df_combined['service'] = 'N/A'
df_combined['author'] = 'N/A'
df_combined['create_datetime'] = df_combined['note_create_time']  # Map existing field
df_combined['filing_datetime'] = 'N/A'
df_combined['etl_datetime'] = 'N/A'

# Ensure MRN and CSN are integers
df_combined['mrn'] = pd.to_numeric(df_combined['mrn'], errors='coerce').astype('Int64')
df_combined['csn'] = pd.to_numeric(df_combined['csn'], errors='coerce').astype('Int64')

print("Note structure normalized with missing columns set to 'N/A'")

# Set random seed for reproducible demographics based on script run
random.seed(42)

def randomize_id(original_id):
    """Randomize an ID by multiplying by a random factor between 1.05-1.20"""
    random_factor = random.uniform(1.05, 1.20)
    return int(original_id * random_factor)


def generate_random_demographics(mrn):
    """Generate random demographics for a patient using MRN as seed for consistency"""
    # Use MRN as seed so same patient gets same demographics across runs
    # Convert MRN to int for valid seed type
    mrn_seed = int(mrn) if not pd.isna(mrn) else 0
    temp_random = random.Random(mrn_seed)

    # Random sex selection
    sex = temp_random.choice(['Male', 'Female'])

    # Random date between Jan 1, 1935 and Jan 1, 2005
    start_date = datetime.date(1935, 1, 1)
    end_date = datetime.date(2005, 1, 1)

    # Calculate random date
    days_between = (end_date - start_date).days
    random_days = temp_random.randint(0, days_between)
    birth_date = start_date + datetime.timedelta(days=random_days)

    return {
        'sex': sex,
        'year_of_birth': birth_date.year,
        'month_of_birth': birth_date.month,
        'day_of_birth': birth_date.day,
        'date_of_birth': birth_date.isoformat()  # YYYY-MM-DD format for frontend
    }


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


def build_patient_blob(mrn):
    """Build patient blob matching original create_db.py structure but with only notes"""
    # Filter notes for this MRN
    patient_notes = df_combined[df_combined['mrn'] == mrn]

    if patient_notes.empty:
        return None

    # Generate random demographics for this patient
    demographics = generate_random_demographics(mrn)

    # Create patient-level data with demographics and scrambled MRN
    scrambled_mrn = mrn_mapping.get(mrn, mrn)  # Get scrambled MRN from mapping
    patient_dict = {
        'mrn': int(scrambled_mrn) if not pd.isna(scrambled_mrn) else None,
        'sex': demographics['sex'],
        'year_of_birth': demographics['year_of_birth'],
        'month_of_birth': demographics['month_of_birth'],
        'day_of_birth': demographics['day_of_birth'],
        'date_of_birth': demographics['date_of_birth']
    }

    # Get unique CSNs for this patient to create encounters
    unique_csns = patient_notes['csn'].dropna().unique()

    encounters = []
    for csn in unique_csns:
        # Get notes for this encounter
        encounter_notes = patient_notes[patient_notes['csn'] == csn]

        # Convert notes to records, dropping mrn and csn columns, and clean note text
        notes_records = []
        for _, row in encounter_notes.iterrows():
            note_record = row.drop(['mrn', 'csn']).to_dict()
            # Handle note text based on whether this is a demo patient
            if 'note_text' in note_record and note_record['note_text']:
                if mrn in DEMO_MRN:
                    # Demo patient: keep original note text and clean it
                    note_record['note_text'] = clean_text(str(note_record['note_text']))
                else:
                    # Non-demo patient: replace with retracted message
                    note_record['note_text'] = "Retracted for demo purposes"
            notes_records.append(note_record)

        encounter = {
            'csn': int(csn) if not pd.isna(csn) else None,
            # Empty structures matching original format
            'flowsheets_raw': [],
            'flowsheets_pivot': {
                "measurements": [],
                "time_points": [],
                "metadata": {
                    "admission_date": None,
                    "discharge_date": None,
                    "total_measurements": 0,
                    "total_time_points": 0,
                    "total_readings": 0
                }
            },
            'flowsheets_instances': [],
            'medications': [],
            'diagnoses': [],
            'notes': notes_records
        }

        encounters.append(encounter)

    patient_dict['encounters'] = encounters
    return patient_dict


# Create MRN mapping for consistent scrambling across patient data and results
print("Creating MRN mapping for scrambling...")
unique_mrns = df_combined['mrn'].dropna().unique()
print(f"Found {len(unique_mrns)} unique MRNs")

# Set random seed for reproducible MRN mapping
random.seed(42)
mrn_mapping = {}
for original_mrn in unique_mrns:
    scrambled_mrn = randomize_id(original_mrn)
    mrn_mapping[original_mrn] = scrambled_mrn
    print(f"  MRN mapping: {original_mrn} -> {scrambled_mrn}")

# Process all patients and create final structure
print("Building patient blobs...")

# Build patient blobs for all MRNs
patient_blobs = []
for mrn in unique_mrns:
    blob = build_patient_blob(mrn)
    if blob is not None:
        patient_blobs.append(blob)

print(f"Successfully created {len(patient_blobs)} patient blobs")

# Save to JSON file
print(f"Saving patient blobs to {RESULTS_PATH}...")
with open(RESULTS_PATH, 'w') as f:
    json.dump(patient_blobs, f, indent=2, default=str)

print(f"SDOH dataset conversion complete! Output saved to {RESULTS_PATH}")
print(f"Total patients: {len(patient_blobs)}")

# Print summary statistics
total_encounters = sum(len(patient['encounters']) for patient in patient_blobs)
total_notes = sum(len(encounter['notes']) for patient in patient_blobs for encounter in patient['encounters'])

print(f"Total encounters: {total_encounters}")
print(f"Total notes: {total_notes}")

sdoh_list = ['Language barrier', 'Financial strain', 'Social isolation', 'Housing insecurity', 'Depression',
             'Addiction', 'Food insecurity', 'Transportation', 'Health literacy']

SDOH_FLAG_CRITERIA = {
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


def initialize_patient_results(patient_blobs):
    """Initialize empty results structure for all patients"""
    patient_results = {}

    for patient_blob in patient_blobs:
        mrn = patient_blob['mrn']  # This is already scrambled from build_patient_blob

        encounters = []
        for encounter in patient_blob['encounters']:
            encounter_result = {
                'csn': encounter['csn'],
                'flags': {sdoh: {"state": False, "sources": []} for sdoh in sdoh_list}
            }
            encounters.append(encounter_result)

        patient_results[mrn] = {
            'mrn': mrn,
            'encounters': encounters
        }

    return patient_results


def process_sheet_data(sheet_name, xls_file):
    """Process individual sheet data using exact same logic as Phase 1"""
    # Parse the sheet
    df = xls_file.parse(sheet_name)

    # Apply same column renaming as Phase 1 (lines 26-37)
    df = df.rename(columns={
        'Note_ID': 'note_id',
        'Raw_Clinical_Note': 'note_text',
        'Predicted_classification': 'result_classification',
        'Predicted_span': 'result_span',
        'Reasoning': 'result_reasoning',
        'MRN': 'mrn',
        'ENC_CSN_ID': 'csn',
        'NOTE_CSN_ID': 'note_csn_id',
        'NOTE_TYPE': 'note_type',
        'NOTE_CREATE_TIME': 'note_create_time',
    })

    # Keep only the columns we need (same as line 40)
    df = df[['note_id', 'note_text', 'result_classification', 'result_span', 'result_reasoning', 'mrn', 'csn',
             'note_csn_id', 'note_type', 'note_create_time']]

    # Normalize note structure - add missing columns (same as lines 52-59)
    df['note_type_id'] = 'N/A'
    df['note_status'] = 'N/A'
    df['service'] = 'N/A'
    df['author'] = 'N/A'
    df['create_datetime'] = df['note_create_time']  # Map existing field
    df['filing_datetime'] = 'N/A'
    df['etl_datetime'] = 'N/A'

    # Ensure MRN and CSN are integers (same as lines 61-63)
    df['mrn'] = pd.to_numeric(df['mrn'], errors='coerce').astype('Int64')
    df['csn'] = pd.to_numeric(df['csn'], errors='coerce').astype('Int64')

    # Clean note text (same as applied in build_patient_blob)
    df['note_text'] = df['note_text'].apply(lambda x: clean_text(str(x)) if pd.notna(x) else x)

    return df


def analyze_sdoh_note_for_flag(note_row, flag_key, criteria_config):
    """Analyze a single SDOH note for evidence of a specific flag"""
    criteria_name = criteria_config["name"]
    criteria_text = criteria_config["criteria"]

    # Check if evidence was found (result_classification == 'SDoH')
    flag_detected = str(note_row.get('result_classification', '')).strip() == 'SDoH'

    result = {
        "flag_detected": flag_detected,
        "source_data": None
    }

    if flag_detected:
        # Get span and reasoning from the results
        result_span = str(note_row.get('result_span', 'N/A'))
        result_reasoning = str(note_row.get('result_reasoning', 'N/A'))
        note_text = str(note_row.get('note_text', ''))

        # Use the new highlighting function that matches IdentifyFlag behavior
        highlighted_text = create_highlighted_text(note_text, result_span)

        # Check if span was found (for logging)
        start_idx, end_idx, clean_note = find_span_in_text(note_text, result_span)
        if start_idx is not None:
            print(f"✓ Span found and highlighted in note {note_row.get('note_id', 'N/A')}")
        else:
            print(f"⚠ Span not found in note {note_row.get('note_id', 'N/A')}, using fallback format")

        # Create note dictionary from the row (excluding SDOH-specific columns)
        note_dict = {
            'note_id': note_row.get('note_id'),
            'note_text': note_row.get('note_text'),
            'note_type': note_row.get('note_type'),
            'note_type_id': note_row.get('note_type_id'),
            'note_status': note_row.get('note_status'),
            'service': note_row.get('service'),
            'author': note_row.get('author'),
            'create_datetime': note_row.get('create_datetime'),
            'filing_datetime': note_row.get('filing_datetime'),
            'etl_datetime': note_row.get('etl_datetime'),
            'note_csn_id': note_row.get('note_csn_id'),
            'note_create_time': note_row.get('note_create_time')
        }

        result["source_data"] = {
            "type": "note",
            "details": {
                **note_dict,
                "criteria": criteria_text,
                "criteria_name": criteria_name,
                "highlighted_text": highlighted_text,
                "reasoning": result_reasoning
            }
        }

        print(f"✓ {criteria_name} DETECTED in note {note_row.get('note_id', 'N/A')}")

    return result


def process_sdoh_results():
    """Process SDOH evidence detection results using sheet-by-sheet approach"""
    print("\n=== Processing SDOH Results ===")

    # Initialize empty results structure for all patients
    patient_results = initialize_patient_results(patient_blobs)

    # Process each sheet individually to assign flags
    for sheet_name in sheet_names:
        print(f"\nProcessing sheet: {sheet_name}")

        # Skip if not a valid SDOH flag
        if sheet_name not in SDOH_FLAG_CRITERIA:
            print(f"  Skipping sheet {sheet_name} - not in SDOH criteria")
            continue

        # Get processed data for this sheet using exact same logic as Phase 1
        sheet_df = process_sheet_data(sheet_name, xls)
        print(f"  Found {len(sheet_df)} notes in {sheet_name} sheet")

        # Process each note in this sheet
        for _, note_row in sheet_df.iterrows():
            original_mrn = note_row['mrn']  # This is the original MRN from sheet data
            csn = note_row['csn']
            note_id = note_row['note_id']

            # Skip if missing critical data
            if pd.isna(original_mrn) or pd.isna(csn):
                continue

            # Skip SDOH processing for non-demo patients
            if original_mrn not in DEMO_MRN:
                continue

            # Map original MRN to scrambled MRN used in patient_results
            scrambled_mrn = mrn_mapping.get(original_mrn, original_mrn)

            # Find patient results using scrambled MRN
            if scrambled_mrn in patient_results:
                # Find the encounter
                encounter_found = False
                for encounter in patient_results[scrambled_mrn]['encounters']:
                    if encounter['csn'] == csn:
                        encounter_found = True

                        # Analyze note for this flag
                        criteria_config = SDOH_FLAG_CRITERIA[sheet_name]
                        result = analyze_sdoh_note_for_flag(note_row, sheet_name, criteria_config)

                        # If evidence found, update the flag
                        if result["flag_detected"]:
                            encounter['flags'][sheet_name]["state"] = True
                            encounter['flags'][sheet_name]["sources"].append(result["source_data"])
                            print(f"    ✓ Flag {sheet_name} detected for original MRN {original_mrn} (scrambled: {scrambled_mrn}), CSN {csn}, Note {note_id}")
                        break

                if not encounter_found:
                    print(f"    ⚠ Encounter CSN {csn} not found for scrambled MRN {scrambled_mrn}")
            else:
                print(f"    ⚠ Patient scrambled MRN {scrambled_mrn} not found in results")

    # Convert results dictionary back to list format
    all_patient_results = []
    for mrn, patient_data in patient_results.items():
        all_patient_results.append(patient_data)

    return {"patients": all_patient_results}


def create_experiment_folder(experiment_name):
    """Create experiment directory structure"""
    experiment_dir = os.path.join(EXPERIMENT_PARENT_DIR, experiment_name)
    os.makedirs(experiment_dir, exist_ok=True)
    return experiment_dir


def save_experiment_metadata(experiment_name):
    """Save experiment metadata.json"""
    experiment_dir = os.path.join(EXPERIMENT_PARENT_DIR, experiment_name)
    os.makedirs(experiment_dir, exist_ok=True)  # Ensure directory exists
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
    experiment_dir = os.path.join(EXPERIMENT_PARENT_DIR, experiment_name)
    os.makedirs(experiment_dir, exist_ok=True)  # Ensure directory exists
    results_path = os.path.join(experiment_dir, "results.json")

    with open(results_path, 'w') as f:
        json.dump(results_data, f, indent=2, default=str)

    print(f"Saved experiment results to {results_path}")


# Process SDOH results and save experiment
experiment_name = "results_sdoh_demo"
print(f"\n=== Running SDOH Results Experiment: {experiment_name} ===")

# Create experiment folder and save metadata
create_experiment_folder(experiment_name)
save_experiment_metadata(experiment_name)

# Process SDOH evidence detection results
sdoh_results = process_sdoh_results()

# Save experiment results
save_experiment_results(experiment_name, sdoh_results)

# Print summary
total_patients_with_flags = 0
total_evidence_found = 0

for patient in sdoh_results["patients"]:
    for encounter in patient["encounters"]:
        patient_has_flags = False
        for flag_name, flag_data in encounter["flags"].items():
            if flag_data["state"]:
                if not patient_has_flags:
                    total_patients_with_flags += 1
                    patient_has_flags = True
                total_evidence_found += len(flag_data["sources"])

print(f"\n=== SDOH Results Summary ===")
print(f"Experiment: {experiment_name}")
print(f"Total patients processed: {len(sdoh_results['patients'])}")
print(f"Patients with SDOH evidence: {total_patients_with_flags}")
print(f"Total evidence instances found: {total_evidence_found}")
print(f"Experiment saved successfully!")



