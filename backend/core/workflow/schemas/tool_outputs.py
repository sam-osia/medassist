from pydantic import BaseModel
from typing import Optional, List, Union, Any, Dict

class SemanticKeywordCountOutput(BaseModel):
    count: int
    formatted_text: str

class ExactKeywordCountOutput(BaseModel):
    counts: Dict[str, int]


class AnalyzeNoteWithSpanAndReasonOutput(BaseModel):
    flag_state: bool
    span: str
    reasoning: str

class FilterMedicationOutput(BaseModel):
    order_ids: List[int]


class ReadPatientNoteOutput(BaseModel):
    note_id: Optional[int] = None
    pat_id: Optional[str] = None
    note_type_id: Optional[int] = None
    note_type: Optional[str] = None
    note_status: Optional[str] = None
    service: Optional[str] = None
    author: Optional[str] = None
    create_datetime: Optional[str] = None
    filing_datetime: Optional[str] = None
    note_text: Optional[str] = None
    etl_datetime: Optional[str] = None


class ReadMedicationOutput(BaseModel):
    order_id: Optional[int] = None
    admin_line_num: Optional[int] = None
    pat_id: Optional[str] = None
    medication_id: Optional[int] = None
    order_display_name: Optional[str] = None
    order_datetime: Optional[str] = None
    order_start_datetime: Optional[str] = None
    order_end_datetime: Optional[str] = None
    admin_datetime: Optional[str] = None
    admin_action: Optional[str] = None
    drug_code: Optional[str] = None
    medication_name: Optional[str] = None
    simple_generic_name: Optional[str] = None
    dosage_order_amount: Optional[float] = None
    dosage_order_unit: Optional[str] = None
    dosage_given_amount: Optional[float] = None
    dosage_given_unit: Optional[str] = None
    dosing_bsa: Optional[float] = None
    dosing_height: Optional[float] = None
    dosing_weight: Optional[float] = None
    dosing_frequency: Optional[str] = None
    medication_route: Optional[str] = None
    etl_datetime: Optional[str] = None


class ReadDiagnosisOutput(BaseModel):
    diagnosis_id: Optional[int] = None
    pat_id: Optional[str] = None
    dx_id: Optional[int] = None
    diagnosis_name: Optional[str] = None
    diagnosis_code: Optional[str] = None
    code_set: Optional[str] = None
    diagnosis_source: Optional[str] = None
    date: Optional[str] = None
    date_resolution: Optional[str] = None
    date_description: Optional[str] = None
    resolved_date: Optional[str] = None
    is_chronic: Optional[bool] = None
    etl_datetime: Optional[str] = None