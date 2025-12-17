import os
import json
import random
from random_names import generate_random_name

# Configuration
DEMO_MRN = [2043981]
INPUT_PATH = "../../dataset/patient_mock.json"
OUTPUT_PATH = "../../dataset/sk_demo.json"

def randomize_id(original_id):
    """Randomize an ID by multiplying by a random factor between 1.05-1.20"""
    random_factor = random.uniform(1.05, 1.20)
    return int(original_id * random_factor)

print("Loading patient dataset...")
with open(INPUT_PATH, "r") as f:
    data = json.load(f)

print(f"Loaded {len(data)} patients from {INPUT_PATH}")

# Set random seed for reproducible results
random.seed(42)

# Create MRN scrambling mapping for all patients
print("Creating MRN scrambling mapping...")
original_mrns = [patient['mrn'] for patient in data if patient.get('mrn') is not None]
mrn_mapping = {}
for original_mrn in original_mrns:
    scrambled_mrn = randomize_id(original_mrn)
    mrn_mapping[original_mrn] = scrambled_mrn
    print(f"  MRN mapping: {original_mrn} -> {scrambled_mrn}")

print("Starting patient processing...")

# Process each patient
for patient_idx, patient in enumerate(data):
    print(f"\\nProcessing Patient {patient_idx + 1}/{len(data)}")
    
    # Get original MRN before scrambling
    original_mrn = patient.get('mrn')
    is_demo_patient = original_mrn in DEMO_MRN
    
    # Scramble MRN
    if original_mrn and original_mrn in mrn_mapping:
        patient['mrn'] = mrn_mapping[original_mrn]
        print(f"  MRN: {original_mrn} -> {patient['mrn']} {'(DEMO PATIENT)' if is_demo_patient else ''}")
    
    # Process encounters
    encounters = patient.get('encounters', [])
    for encounter_idx, encounter in enumerate(encounters):
        # Scramble CSN
        if 'csn' in encounter and encounter['csn'] is not None:
            original_csn = int(encounter['csn'])
            encounter['csn'] = randomize_id(original_csn)
        
        # Process notes
        notes = encounter.get('notes', [])
        for note_idx, note in enumerate(notes):
            # Replace author names with random names
            if 'author' in note and note['author']:
                first_name, last_name = generate_random_name()
                note['author'] = f"{last_name}, {first_name}"
            
            # Handle note text based on demo status
            if 'note_text' in note:
                if is_demo_patient:
                    # Keep original note text for demo patient
                    print(f"      Note {note_idx + 1}/{len(notes)} - keeping original text (demo patient)")
                else:
                    # Retract note text for non-demo patients
                    note['note_text'] = "Retracted for demo purposes"
                    print(f"      Note {note_idx + 1}/{len(notes)} - text retracted")

# Find demo patient and move to first position
print("\\nReordering patients - moving demo patient to first position...")
demo_patient_index = None
for idx, patient in enumerate(data):
    if patient.get('mrn') == mrn_mapping.get(DEMO_MRN[0]):
        demo_patient_index = idx
        break

if demo_patient_index is not None and demo_patient_index != 0:
    demo_patient = data.pop(demo_patient_index)
    data.insert(0, demo_patient)
    print(f"  Moved demo patient from position {demo_patient_index + 1} to position 1")
elif demo_patient_index == 0:
    print("  Demo patient already in first position")
else:
    print("  Warning: Demo patient not found!")

# Save processed dataset
print(f"\\nSaving processed dataset to {OUTPUT_PATH}...")
with open(OUTPUT_PATH, "w") as f:
    json.dump(data, f, indent=2)

print(f"\\nProcessing complete! Dataset saved to {OUTPUT_PATH}")
print(f"Total patients processed: {len(data)}")

# Print summary statistics
total_encounters = sum(len(patient.get('encounters', [])) for patient in data)
total_notes = sum(len(encounter.get('notes', [])) for patient in data for encounter in patient.get('encounters', []))

print(f"Total encounters: {total_encounters}")
print(f"Total notes: {total_notes}")
print(f"Demo patient MRN: {DEMO_MRN[0]} -> {mrn_mapping.get(DEMO_MRN[0], 'Not found')}")