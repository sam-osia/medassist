import os
import pandas as pd
import numpy as np
import json
from pprint import pprint
from typing import List, Dict

data_parent_dir = "/hpf/projects/ccmuhn/peds-delirium"
data_parsed_dir = "/hpf/projects/ccmuhn/peds-delirium/llama/data-parsed"


print("loading patient data")
df_patient = pd.read_excel(os.path.join(data_parent_dir, "patient 2024-05-30.xlsx"))
# columns: 
# ['mrn', 'sex', 'year_of_birth', 'month_of_birth', 
# 'day_of_birth', 'date_of_birth']

df_flowsheets = pd.read_excel(os.path.join(data_parent_dir, "flowsheets 2024-05-30.xlsx"))
# columns: 
# ['mrn', 'REDIR_PAT_ENC_CSN_ID', 'AdmissionDate', 'DischargeDate', 
# 'RECORDED_TIME', 'FLO_MEAS_ID', 'FLO_MEAS_NAME', 'DISP_NAME', 
# 'MEAS_VALUE', 'MEAS_COMMENT']

df_medications = pd.read_excel(os.path.join(data_parent_dir, "medication administration 2024-05-30.xlsx"))
# columns: 
# ['order_id', 'admin_line_num', 'mrn', 'pat_id', 'pat_enc_csn_id', 
# 'medication_id', 'order_display_name', 'order_datetime',
# 'order_start_datetime', 'order_end_datetime', 'admin_datetime',
# 'admin_action', 'drug_code', 'medication_name', 'simple_generic_name',
# 'dosage_order_amount', 'dosage_order_unit', 'dosage_given_amount',
# 'dosage_given_unit', 'dosing_bsa', 'dosing_height', 'dosing_weight',
# 'dosing_frequency', 'medication_route', 'etl_datetime']

df_diagnosis = pd.read_excel(os.path.join(data_parent_dir, "diagnosis 2024-05-30.xlsx"))
# columns: 
# ['diagnosis_id', 'mrn', 'pat_id', 'pat_enc_csn_id', 'dx_id',
# 'diagnosis_name', 'diagnosis_code', 'code_set', 'diagnosis_source',
# 'date', 'date_resolution', 'date_description', 'resolved_date',
# 'is_chronic', 'etl_datetime']

df_notes = pd.read_parquet(os.path.join(data_parent_dir, "note 2024-05-31.parquet"), engine="pyarrow")
# columns: 
# ['note_id', 'mrn', 'pat_id', 'pat_enc_csn_id', 'note_type_id',
# 'note_type', 'note_status', 'service', 'author', 'create_datetime',
# 'filing_datetime', 'note_text', 'etl_datetime']

print("patient data loaded")

# -----------------------------------------------------------------------------
# Build nested JSON blobs per patient
# -----------------------------------------------------------------------------

# Harmonise CSN column name across all tables for easier joins

# NOTE: pandas will silently ignore missing columns if the rename target doesn't
# exist, so we guard by only renaming when the column is present.
if 'REDIR_PAT_ENC_CSN_ID' in df_flowsheets.columns:
    df_flowsheets = df_flowsheets.rename(columns={'REDIR_PAT_ENC_CSN_ID': 'csn'})
if 'pat_enc_csn_id' in df_medications.columns:
    df_medications = df_medications.rename(columns={'pat_enc_csn_id': 'csn'})
if 'pat_enc_csn_id' in df_diagnosis.columns:
    df_diagnosis = df_diagnosis.rename(columns={'pat_enc_csn_id': 'csn'})
if 'pat_enc_csn_id' in df_notes.columns:
    df_notes = df_notes.rename(columns={'pat_enc_csn_id': 'csn'})

# Ensure MRN and CSN columns are 64-bit integers across all DataFrames
for _df in [df_patient, df_flowsheets, df_medications, df_diagnosis, df_notes]:
    if 'mrn' in _df.columns:
        _df['mrn'] = pd.to_numeric(_df['mrn'], errors='coerce').astype('Int64')
    if 'csn' in _df.columns:
        _df['csn'] = pd.to_numeric(_df['csn'], errors='coerce').astype('Int64')

# -----------------------------------------------------------------------------
# Helper to split/group flowsheets by FLO_MEAS_ID for a single encounter (CSN)
# -----------------------------------------------------------------------------

def group_flowsheets_by_meas_id(df: pd.DataFrame) -> List[Dict]:
    """Return a list of flowsheet groups keyed by *FLO_MEAS_ID*.

    Each element in the returned list has the structure::

        {
            "flo_meas_id": 123,
            "records": [ {..row..}, ... ]  # sorted by RECORDED_TIME
        }

    Parameters
    ----------
    df : pd.DataFrame
        Flowsheet rows for a single (MRN, CSN) pair.
    """
    if df.empty:
        return []

    # Ensure proper sorting before grouping so that each group's order
    # respects RECORDED_TIME ascending.
    df_sorted = df.sort_values("RECORDED_TIME")

    groups: List[Dict] = []
    for flo_meas_id, grp in df_sorted.groupby("FLO_MEAS_ID"):
        records = (
            grp
            .drop(columns=[col for col in ["mrn", "csn", "FLO_MEAS_ID"] if col in grp.columns])
            .to_dict(orient="records")
        )

        groups.append(
            {
                "flo_meas_id": int(flo_meas_id) if not pd.isna(flo_meas_id) else None,
                "records": records,
            }
        )

    return groups

# -----------------------------------------------------------------------------
# Helper to build the nested record for a single patient (by MRN)
# -----------------------------------------------------------------------------

def create_flowsheet_pivot_table(df: pd.DataFrame) -> Dict:
    """Create a pivot table from flowsheet data with measurements as rows and time as columns.
    
    Parameters
    ----------
    df : pd.DataFrame
        Flowsheet rows for a single (MRN, CSN) pair.
        
    Returns
    -------
    Dict
        Pivot table structure with measurements info and time-series data
    """
    if df.empty:
        return {
            "measurements": [],
            "time_points": [],
            "pivot_data": [],
            "metadata": {
                "admission_date": None,
                "discharge_date": None
            }
        }

    # Sort by time for consistent column ordering
    df_sorted = df.sort_values("RECORDED_TIME")
    
    # Get unique time points and measurements
    unique_times = df_sorted['RECORDED_TIME'].drop_duplicates().sort_values()
    
    # Create measurement info (rows)
    measurements = []
    measurement_groups = df_sorted.groupby(['FLO_MEAS_ID', 'FLO_MEAS_NAME', 'DISP_NAME'])
    
    for (flo_meas_id, flo_meas_name, disp_name), group in measurement_groups:
        # Create time-value mapping for this measurement
        time_values = {}
        for _, row in group.iterrows():
            time_key = row['RECORDED_TIME'].isoformat() if pd.notna(row['RECORDED_TIME']) else None
            if time_key:
                time_values[time_key] = {
                    "value": row['MEAS_VALUE'],
                    "comment": row['MEAS_COMMENT']
                }
        
        measurements.append({
            "flo_meas_id": int(flo_meas_id) if not pd.isna(flo_meas_id) else None,
            "flo_meas_name": flo_meas_name,
            "disp_name": disp_name,
            "time_values": time_values,
            "total_readings": len(group)
        })
    
    # Format time points for frontend
    time_points = [
        {
            "timestamp": time.isoformat() if pd.notna(time) else None,
            "formatted": time.strftime("%Y-%m-%d %H:%M") if pd.notna(time) else "N/A"
        }
        for time in unique_times
    ]
    
    # Get admission/discharge dates (should be same for all records in this CSN)
    admission_date = df_sorted['AdmissionDate'].iloc[0] if not df_sorted.empty else None
    discharge_date = df_sorted['DischargeDate'].iloc[0] if not df_sorted.empty else None
    
    return {
        "measurements": measurements,
        "time_points": time_points,
        "metadata": {
            "admission_date": admission_date.isoformat() if pd.notna(admission_date) else None,
            "discharge_date": discharge_date.isoformat() if pd.notna(discharge_date) else None,
            "total_measurements": len(measurements),
            "total_time_points": len(time_points),
            "total_readings": len(df_sorted)
        }
    }

def create_flowsheet_instances(df: pd.DataFrame) -> List[Dict]:
    """Create flowsheet instances directly from raw flowsheet data.
    
    Each instance represents all measurements taken at a specific timestamp.
    
    Parameters
    ----------
    df : pd.DataFrame
        Flowsheet rows for a single (MRN, CSN) pair.
        
    Returns
    -------
    List[Dict]
        List of flowsheet instances, each with timestamp and measurements
    """
    if df.empty:
        return []
    
    # Sort by time for consistent ordering
    df_sorted = df.sort_values("RECORDED_TIME")
    
    # Group by timestamp to create instances
    flowsheet_instances = []
    
    for timestamp, group in df_sorted.groupby("RECORDED_TIME"):
        instance = {
            "timestamp": timestamp.isoformat() if pd.notna(timestamp) else None,
            "measurements": {}
        }
        
        # Process each measurement at this timestamp
        for _, row in group.iterrows():
            flo_meas_name = row['FLO_MEAS_NAME']
            if pd.isna(flo_meas_name):
                continue
                
            # Create normalized measurement key
            measurement_key = str(flo_meas_name).lower().replace(' ', '_')
            
            instance["measurements"][measurement_key] = {
                "flo_meas_id": int(row['FLO_MEAS_ID']) if not pd.isna(row['FLO_MEAS_ID']) else None,
                "flo_meas_name": flo_meas_name,
                "disp_name": row['DISP_NAME'],
                "value": row['MEAS_VALUE'],
                "comment": row['MEAS_COMMENT']
            }
        
        flowsheet_instances.append(instance)

    print('length of flowsheet instances:', len(flowsheet_instances))
    return flowsheet_instances


def build_patient_blob(mrn: int) -> dict:
    # ---------------- Patient-level data ----------------
    patient_rows = df_patient[df_patient['mrn'] == mrn]
    if patient_rows.empty:
        # MRN absent from patient table → skip
        return None

    # Take the first row (MRN is unique so there should be exactly one)
    patient_dict = patient_rows.iloc[0].drop(labels=['mrn']).to_dict()
    patient_dict['mrn'] = int(mrn) if not pd.isna(mrn) else None

    # ---------------- Encounter list (unique CSNs) ----------------
    csn_series_list = [
        df_flowsheets.loc[df_flowsheets['mrn'] == mrn, 'csn'],
        df_medications.loc[df_medications['mrn'] == mrn, 'csn'],
        df_diagnosis.loc[df_diagnosis['mrn'] == mrn, 'csn'],
        df_notes.loc[df_notes['mrn'] == mrn, 'csn'],
    ]
    unique_csns = pd.unique(pd.concat(csn_series_list).dropna())

    encounters = []
    for csn in unique_csns:
        flowsheet_data = df_flowsheets.query('mrn == @mrn and csn == @csn')
        
        encounters.append({
            'csn': csn,
            'flowsheets_raw': group_flowsheets_by_meas_id(flowsheet_data),
            'flowsheets_pivot': create_flowsheet_pivot_table(flowsheet_data),
            'flowsheets_instances': create_flowsheet_instances(flowsheet_data),
            'medications': df_medications.query('mrn == @mrn and csn == @csn')
                                         .drop(columns=['mrn', 'csn'])
                                         .to_dict(orient='records'),
            'diagnoses':   df_diagnosis.query('mrn == @mrn and csn == @csn')
                                         .drop(columns=['mrn', 'csn'])
                                         .to_dict(orient='records'),
            'notes':       df_notes.query('mrn == @mrn and csn == @csn')
                                         .drop(columns=['mrn', 'csn'])
                                         .to_dict(orient='records'),
        })

    patient_dict['encounters'] = encounters
    return patient_dict

# -----------------------------------------------------------------------------
# Build the blobs for all patients and save to disk
# -----------------------------------------------------------------------------
print("building patient blobs …")
unique_mrns = df_patient['mrn'].unique()

# Save patient blobs in batches of 1,000 to keep individual files a manageable size
chunk_size = 1000
os.makedirs(data_parsed_dir, exist_ok=True)

for start_idx in range(0, len(unique_mrns), chunk_size):
    mrn_chunk = unique_mrns[start_idx:start_idx + chunk_size]
    blobs_chunk = [build_patient_blob(mrn) for mrn in mrn_chunk if mrn is not None]

    chunk_id = start_idx // chunk_size + 1  # 1-based chunk counter
    output_path = os.path.join(data_parsed_dir, f"patient_blobs_{chunk_id:04d}.json")
    with open(output_path, "w") as fp:
        json.dump(blobs_chunk, fp, default=str)

    print(f"{len(blobs_chunk)} patient blobs written to {output_path}")


# create a sample dataset with 10 patients for quick testing
sample_chunk_size = 10
sample_blobs = [build_patient_blob(mrn) for mrn in unique_mrns[:sample_chunk_size]]
with open(os.path.join(data_parsed_dir, "sample_patient_blobs.json"), "w") as fp:
    json.dump(sample_blobs, fp, default=str)

print(f"sample dataset with {len(sample_blobs)} patient blobs written to {os.path.join(data_parsed_dir, 'sample_patient_blobs.json')}")

# create a specific sample with MRNs from the analysis scripts
combined_mrns_file = "/hpf/projects/ccmuhn/sam/delirium/data/combined_mrns.txt"
test_patient_mrns = []

try:
    with open(combined_mrns_file, 'r') as f:
        for line in f:
            mrn_str = line.strip()
            if mrn_str:  # Skip empty lines
                try:
                    mrn = int(mrn_str)
                    test_patient_mrns.append(mrn)
                except ValueError:
                    continue
    
    print(f"Loaded {len(test_patient_mrns)} MRNs from {combined_mrns_file}")
    
    # Build patient blobs for test patients
    test_patient_blobs = []
    for mrn in test_patient_mrns:
        blob = build_patient_blob(mrn)
        if blob is not None:
            test_patient_blobs.append(blob)
    
    # Save test patients dataset
    test_patients_path = os.path.join(data_parsed_dir, "test_patients.json")
    with open(test_patients_path, "w") as fp:
        json.dump(test_patient_blobs, fp, default=str)
    
    print(f"test patients dataset with {len(test_patient_blobs)} patient blobs written to {test_patients_path}")
    
except FileNotFoundError:
    print(f"Warning: Could not find {combined_mrns_file}, skipping test patients dataset creation")
except Exception as e:
    print(f"Error creating test patients dataset: {e}")
