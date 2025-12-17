import os
import pandas as pd
import numpy as np
data_parent_dir = "/hpf/projects/ccmuhn/peds-delirium"

df_patient = pd.read_excel(os.path.join(data_parent_dir, "patient 2024-05-30.xlsx"))
print("patient")
print(df_patient.head())
print(df_patient.columns)
print(df_patient.shape)
print()

print(len(np.unique(df_patient['mrn'])))

print()
print('-'*100)
print()

df_flowsheets = pd.read_excel(os.path.join(data_parent_dir, "flowsheets 2024-05-30.xlsx"))
print("flowsheets")
print(df_flowsheets.head())
print(df_flowsheets.columns)
print(df_flowsheets.shape)
print()
print(len(np.unique(df_flowsheets['mrn'])))
print(len(np.unique(df_flowsheets['REDIR_PAT_ENC_CSN_ID'])))

print()
print('-'*100)
print()

df_medications = pd.read_excel(os.path.join(data_parent_dir, "medication administration 2024-05-30.xlsx"))
print("medications")
print(df_medications.head())
print(df_medications.columns)
print(df_medications.shape)
print()
print(len(np.unique(df_medications['mrn'])))
print(len(np.unique(df_medications['pat_enc_csn_id'])))

print()
print('-'*100)
print()

df_diagnosis = pd.read_excel(os.path.join(data_parent_dir, "diagnosis 2024-05-30.xlsx"))

print("diagnosis")
print(df_diagnosis.head())
print(df_diagnosis.columns)
print(df_diagnosis.shape)
print()
print(len(np.unique(df_diagnosis['mrn'])))
print(len(np.unique(df_diagnosis['pat_enc_csn_id'])))

print()
print('-'*100)
print()

df_notes = pd.read_parquet(os.path.join(data_parent_dir, "note 2024-05-31.parquet"), engine="pyarrow")
print("notes")
print(df_notes.head())
print(df_notes.columns)
print(df_notes.shape)
print()
print(len(np.unique(df_notes['mrn'])))
print(len(np.unique(df_notes['pat_enc_csn_id'])))

print()
print('-'*100)
print()


