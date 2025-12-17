import os
import json
from random_names import generate_random_name

# Load anonymized dataset
data_parsed_path = "../../dataset/patient_mock_anonymized.json"
with open(data_parsed_path, "r") as f:
    data = json.load(f)

print(f"Loaded {len(data)} patients from {data_parsed_path}")

print("Starting author name replacement...")

# Loop through patients and fix author names
for patient_idx, patient in enumerate(data):
    print(f"\nProcessing Patient {patient_idx + 1}/{len(data)}")
    
    # Process encounters
    encounters = patient.get('encounters', [])
    for encounter_idx, encounter in enumerate(encounters):
        notes = encounter.get('notes', [])
        
        # Process each note
        for note_idx, note in enumerate(notes):
            # Replace author names with random names
            if 'author' in note and note['author']:
                first_name, last_name = generate_random_name()
                note['author'] = f"{last_name}, {first_name}"
                print(f"    Encounter {encounter_idx + 1}, Note {note_idx + 1}: Updated author")

# Save updated dataset
output_path = "../../dataset/patient_mock_anonymized_2.json"
with open(output_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"\nAuthor name replacement complete! Dataset saved to {output_path}")
print(f"Total patients processed: {len(data)}")

