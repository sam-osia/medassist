import json
from pathlib import Path
from pprint import pprint


def summarise_patient(blob: dict) -> None:
    """Pretty-print summary information for a single patient blob."""
    mrn = blob.get("mrn")
    encounters = blob.get("encounters", [])
    print(f"\nMRN {mrn} → {len(encounters)} encounters")
    
    for enc in encounters:
        csn = enc.get("csn")
        flowsheets = enc.get("flowsheets", [])
        n_meds = len(enc.get("medications", []))
        n_dx = len(enc.get("diagnoses", []))
        n_notes = len(enc.get("notes", []))
        
        print(f"\n  CSN {csn}:")
        print(f"    Medications: {n_meds}")
        print(f"    Diagnoses: {n_dx}")
        print(f"    Notes: {n_notes}")
        print(f"    Flowsheet measurements: {len(flowsheets)} unique measurement types")
        
        # Print each flowsheet group (by FLO_MEAS_ID) and how many readings
        for flowsheet_group in flowsheets:
            flo_meas_id = flowsheet_group.get("flo_meas_id")
            records = flowsheet_group.get("records", [])
            
            # Try to get the measurement name from the first record if available
            meas_name = "Unknown"
            if records and len(records) > 0:
                meas_name = records[0].get("FLO_MEAS_NAME", "Unknown")
            
            print(f"      • FLO_MEAS_ID {flo_meas_id} - ({meas_name}): {len(records)} readings")
    
    print("-" * 80)


def main():
    patients_blob_path = "/hpf/projects/ccmuhn/peds-delirium/llama/data-parsed/sample_patient_blobs.json"

    with open(patients_blob_path, 'r') as fp:
        blobs = json.load(fp)

    for blob in blobs:
        summarise_patient(blob)


if __name__ == "__main__":
    main()