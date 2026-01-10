"""
Table Schemas Registry
---------------------
Centralized definitions of all database/table schemas used by the supervisor-worker network.
These are used by non-deterministic tools to provide context to the LLM during translation.
"""

MEDICATION_TABLE_SCHEMA = [
    'order_id', 
    'admin_line_num', 
    'mrn', 
    'pat_id', 
    'pat_enc_csn_id', 
    'medication_id', 
    'order_display_name', 
    'order_datetime',
    'order_start_datetime', 
    'order_end_datetime', 
    'admin_datetime',
    'admin_action', 
    'drug_code', 
    'medication_name', 
    'simple_generic_name',
    'dosage_order_amount', 
    'dosage_order_unit', 
    'dosage_given_amount',
    'dosage_given_unit', 
    'dosing_bsa', 
    'dosing_height', 
    'dosing_weight',
    'dosing_frequency', 
    'medication_route', 
    'etl_datetime'
]

# Add other schemas as needed (e.g., FLOWSHEET_SCHEMA, DIAGNOSIS_SCHEMA)
