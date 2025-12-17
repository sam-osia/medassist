import os
import json
import random
from transformers import pipeline
import torch
from random_names import generate_random_name


def randomize_id(original_id):
    """Randomize an ID by multiplying by a random factor between 1.05-1.20"""
    random_factor = random.uniform(1.05, 1.20)
    return int(original_id * random_factor)


def build_prompt(note_text):
    messages = [
        {
            "role": "system",
            "content": [{"type": "text", "text": "You are an expert in patient privacy. Your role is to de-identify medical notes and replace all names with placeholders. For example, replace 'John Doe' with [PATIENT_NAME] and Dr. Jane Doe with [PHYSICIAN_NAME]. Additionally, replace all MRNs or medical reference numbers with [MRN]. Do not change any other information in the note."}]
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": f"De-identify the following medical note by replacing all names with placeholders:\n\n{note_text}"},
            ]
        }
    ]
    return messages


#TODO: get rid of date of birth
#TODO: Replace names with fake names instead of [placeholder]
#TODO: Scramble note times (keep order)
#TODO: Scramble note IDs
#TODO: Basic login

# Load original dataset
data_parsed_path = "../../dataset/patient_mock.json"
with open(data_parsed_path, "r") as f:
    data = json.load(f)

print(f"Loaded {len(data)} patients from {data_parsed_path}")

# Initialize AI pipeline
print("Loading AI pipeline...")
pipe = pipeline(
    "image-text-to-text",
    model="google/medgemma-4b-it",
    torch_dtype=torch.bfloat16,
    device="cuda",
)

print("Starting anonymization process...")

# Loop through patients and modify data directly
for patient_idx, patient in enumerate(data):
    print(f"\nProcessing Patient {patient_idx + 1}/{len(data)}")
    
    # Anonymize MRN using randomization function
    if 'mrn' in patient and patient['mrn'] is not None:
        original_mrn = patient['mrn']
        patient['mrn'] = randomize_id(original_mrn)
        print(f"  MRN: {original_mrn} -> {patient['mrn']}")
    
    # Process encounters
    encounters = patient.get('encounters', [])
    for encounter_idx, encounter in enumerate(encounters):
        # Anonymize CSN using randomization function
        if 'csn' in encounter and encounter['csn'] is not None:
            original_csn = int(encounter['csn'])
            encounter['csn'] = randomize_id(original_csn)
        
        notes = encounter.get('notes', [])
        original_note_count = len(notes)
        
        # Limit notes to random 70-90 if over 70
        if len(notes) > 10:
            max_notes = random.randint(5, 10)
            encounter['notes'] = random.sample(notes, max_notes)
            notes = encounter['notes']
            print(f"    Encounter {encounter_idx + 1}: Reduced notes from {original_note_count} to {len(notes)}")
        else:
            print(f"    Encounter {encounter_idx + 1}: {len(notes)} notes (no reduction needed)")
        
        # Process each note
        for note_idx, note in enumerate(notes):
            # Replace author names with random names
            if 'author' in note and note['author']:
                first_name, last_name = generate_random_name()
                note['author'] = f"{last_name}, {first_name}"
            
            # Run AI deidentification on note text
            note_text = note.get('note_text', '')
            print('note_text: ', note_text)
            if note_text:
                prompt = build_prompt(note_text)
                output = pipe(prompt, max_new_tokens=3000)
                deidentified_text = output[0]['generated_text'][-1]["content"]
                note['note_text'] = deidentified_text
                print(f"      Note {note_idx + 1}/{len(notes)} processed")

# Save anonymized dataset
output_path = "../../dataset/patient_mock_anonymized.json"
with open(output_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"\nAnonymization complete! Dataset saved to {output_path}")
print(f"Total patients processed: {len(data)}")
