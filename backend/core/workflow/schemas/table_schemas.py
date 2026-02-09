"""
Table Schemas Registry
---------------------
Centralized definitions of all database/table schemas used by the supervisor-worker network.
These are used by non-deterministic tools to provide context to the LLM during translation.
"""

MEDICATION_TABLE_SCHEMA = [
    'order_id', 
    'admin_line_num', 
    'pat_id', 
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

NOTE_TABLE_SCHEMA = [
    'note_id', 'pat_id', 'note_type_id', 'note_type', 'note_status',
    'service', 'author', 'create_datetime', 'filing_datetime',
    'note_text', 'etl_datetime'
]

DIAGNOSIS_TABLE_SCHEMA = [
    'diagnosis_id', 'pat_id', 'dx_id', 'diagnosis_name', 'diagnosis_code',
    'code_set', 'diagnosis_source', 'date', 'date_resolution',
    'date_description', 'resolved_date', 'is_chronic', 'etl_datetime'
]
