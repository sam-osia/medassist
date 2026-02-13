from datetime import datetime

from pydantic import BaseModel, Field

from core.dataloaders.datasets_loader import get_dataset_patients
from core.llm_provider import call
from core.workflow.tools.base import Tool, ToolCallMeta, meta_from_llm_result
from core.workflow.schemas.tool_inputs import ModelInput
from core.workflow.schemas.table_schemas import MEDICATION_TABLE_SCHEMA
import json
import pandas as pd
import logging
import re
from typing import List, Dict, Any, Optional, Union


logger = logging.getLogger(__name__)


# ── Input Models ──────────────────────────────────────────────

class GetMedicationsIdsInput(BaseModel):
    mrn: int = Field(description="Medical Record Number")
    csn: int = Field(description="CSN encounter ID")


class ReadMedicationInput(BaseModel):
    mrn: int = Field(description="Medical Record Number")
    csn: int = Field(description="CSN encounter ID")
    order_id: int = Field(description="The specific medication order ID to retrieve")


class FilterMedicationInput(BaseModel):
    mrn: int = Field(description="Medical Record Number")
    csn: int = Field(description="CSN encounter ID")
    prompt: str = Field(description="The filtering criteria in natural language (e.g., 'Given medications with dosage > 100')")
    model: Optional[ModelInput] = Field(default=None, description="LLM model selection")


class HighlightMedicationInput(BaseModel):
    medication_name: str = Field(description="The medication to search for.")
    medications_list: List[str] = Field(description="List of medication names to search within.")


# ── Output Models ─────────────────────────────────────────────

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


# ── LLM Output Schema (internal) ─────────────────────────────

class FilterMedicationLLMOutput(BaseModel):
    pandas_expression: str
    explanation: Optional[str] = None


# ── Helper ────────────────────────────────────────────────────

def is_safe_eval_expression(expression: str) -> bool:
    """Check for dangerous keywords to prevent code injection."""
    forbidden = {
        'import', 'os', 'sys', 'rm', 'shutil', 'subprocess', 'open', 'write', 'read',
        '__builtins__', '__dict__', '__class__', '__base__', '__subclasses__',
        'eval', 'exec', 'getattr', 'setattr', 'delattr', 'classmethod', 'staticmethod',
        'property', 'type', 'builtins', 'drop', 'pop', 'inplace', 'clear', 'del'
    }
    tokens = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', expression)
    for token in tokens:
        if token in forbidden:
            return False
    return True


# ── Tool Classes ──────────────────────────────────────────────

class GetMedicationsIds(Tool):
    Input = GetMedicationsIdsInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "get_medications_ids"

    @property
    def role(self) -> str:
        return "reader"

    @property
    def description(self) -> str:
        return "Return a list of medication order IDs for a given patient MRN and CSN encounter."

    @property
    def display_name(self) -> str:
        return "Get Medications IDs"

    @property
    def user_description(self) -> str:
        return "Return a list of medication order IDs for a given patient MRN and CSN encounter."

    @property
    def category(self) -> str:
        return "medications"

    def _returns_schema(self) -> dict:
        return {
            "type": "array",
            "items": {"type": "integer"}
        }

    def __call__(self, inputs: GetMedicationsIdsInput):
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return [med['order_id'] for med in encounter['medications'] if med.get('order_id') is not None], ToolCallMeta()
        return [], ToolCallMeta()

class ReadMedication(Tool):
    Input = ReadMedicationInput
    Output = ReadMedicationOutput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "read_medication"

    @property
    def role(self) -> str:
        return "reader"

    @property
    def description(self) -> str:
        return "Return details about a specific medication as a JSON string."

    @property
    def display_name(self) -> str:
        return "Read Medication"

    @property
    def user_description(self) -> str:
        return "Return details about a specific medication as a JSON string."

    @property
    def category(self) -> str:
        return "medications"

    def __call__(self, inputs: ReadMedicationInput):
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        for medication in encounter['medications']:
                            if medication.get('order_id') and int(medication['order_id']) == int(inputs.order_id):
                                return ReadMedicationOutput(**medication), ToolCallMeta()
        return ReadMedicationOutput(), ToolCallMeta()


class HighlightMedication(Tool):
    Input = HighlightMedicationInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "highlight_medication"

    @property
    def description(self) -> str:
        return "Highlight the medication if the medication is in the list of medications you are searching for."

    @property
    def display_name(self) -> str:
        return "Highlight Medication"

    @property
    def user_description(self) -> str:
        return "Highlight the medication if the medication is in the list of medications you are searching for."

    @property
    def category(self) -> str:
        return "medications"

    def _returns_schema(self) -> dict:
        return {
            "type": "string",
            "description": "The medication string if found, otherwise an empty string."
        }

    def __call__(self, inputs: HighlightMedicationInput):
        if inputs.medication_name in inputs.medications_list:
            return inputs.medication_name, ToolCallMeta()
        return "", ToolCallMeta()

class FilterMedication(Tool):
    Input = FilterMedicationInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []
        self.last_expression = None

    @property
    def name(self) -> str:
        return "filter_medication"

    @property
    def description(self) -> str:
        return "Filter the medication table based on a natural language prompt and return the order_ids of matching medications."

    @property
    def display_name(self) -> str:
        return "Filter Medication"

    @property
    def user_description(self) -> str:
        return "Filter the medication table based on a natural language prompt and return the order_ids of matching medications."

    @property
    def uses_llm(self) -> bool:
        return True

    @property
    def input_help(self) -> Dict[str, str]:
        return {
            "prompt": "Enter filtering criteria in natural language (e.g., 'Medications with dosage > 100' or 'Oral medications given today')."
        }

    @property
    def category(self) -> str:
        return "medications"

    def _returns_schema(self) -> dict:
        return {
            "type": "array",
            "items": { "type": "integer" },
            "description": "List of order_id values for medications that match the filter criteria."
        }

    def __call__(self, inputs: FilterMedicationInput):
        # 1. Fetch Medications for the specific Patient/Encounter
        medications_list = []
        for patient in self.dataset:
            if patient.get('mrn') == inputs.mrn:
                for encounter in patient.get('encounters', []):
                    if int(encounter.get('csn')) == int(inputs.csn):
                        medications_list.extend(encounter.get('medications', []))
                        break
                break

        if not medications_list:
            return [], ToolCallMeta()

        # 2. Convert to DataFrame
        df = pd.DataFrame(medications_list)

        if df.empty:
            return [], ToolCallMeta()

        # 2b. Pre-process Date Columns if they exist
        date_cols = ['order_datetime', 'order_start_datetime', 'order_end_datetime', 'admin_datetime', 'etl_datetime']
        for col in date_cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')

        # 3. Static Schema for LLM Context
        metadata_str = "\n".join([f"- {col}" for col in MEDICATION_TABLE_SCHEMA])

        # 4. Optimized System Prompt (Structured Filter Model)
        system_prompt = f"""
        You are a highly capable data analyst assistant specializing in medical data filtering.
        Your task is to translate a user's natural language request into a valid Python Pandas boolean mask expression.

        ### Available Columns (Medication Table):
        {json.dumps(MEDICATION_TABLE_SCHEMA, indent=2)}

        ### Instructions:
        1. Output ONLY a boolean mask expression that can be used on a DataFrame named `df`.
        2. Use standard Pandas accessors like `.str.contains(..., case=False, na=False)`, `.isin([...])`, `.between(min, max)`, or `.isna()`.
        3. For date columns (order_datetime, admin_datetime, etc.), NEVER use `.str`. Use direct datetime comparisons like `df['order_datetime'] >= '{datetime.now().strftime('%Y-%m-%d')}'` or `df['order_datetime'].dt.date == pd.to_datetime('{datetime.now().strftime('%Y-%m-%d')}').date()`.
        4. For column-to-column comparisons, use `df['col_a'] > df['col_b']`.
        5. Current system date: {datetime.now().strftime('%Y-%m-%d')}.

        ### Examples:
        - "Medications given today": "(df['order_datetime'] >= '{datetime.now().strftime('%Y-%m-%d')}') & (df['admin_action'] == 'Given')"
        - "Dose less than ordered": "df['dosage_given_amount'] < df['dosage_order_amount']"
        - "Pain meds (Ibuprofen or Fentanyl)": "df['medication_name'].isin(['Ibuprofen', 'Fentanyl'])"
        - "Oral meds starting with 'A'": "(df['medication_route'] == 'Oral') & (df['medication_name'].str.startswith('A', na=False))"
        - "Concentration 0.9%": "df['medication_name'].str.contains('0\\.9%', case=False, na=False, regex=True)"
        """

        try:
            result = call(
                messages=[{"role": "user", "content": inputs.prompt}],
                key_name=inputs.model.key_name,
                system=system_prompt, schema=FilterMedicationLLMOutput,
            )
            call_meta = meta_from_llm_result(result)

            expr = result.parsed.pandas_expression
            self.last_expression = expr
            if not expr:
                return [], call_meta

            # 5. Security Guardrail
            if not is_safe_eval_expression(expr):
                error_msg = f"SECURITY ALERT: Blocked malicious expression: {expr}"
                print(error_msg)
                logger.warning(error_msg)
                return [], call_meta

            # 6. Execution (Secure eval)
            try:
                final_mask = eval(expr, {"__builtins__": {}, "pd": pd}, {"df": df})

                if final_mask is None:
                    return [], call_meta

                result_df = df[final_mask]
                return [int(oid) for oid in result_df['order_id'].unique().tolist() if oid is not None], call_meta

            except Exception as e:
                error_msg = (
                    f"FilterMedication execution failed for prompt '{inputs.prompt}':\n"
                    f"Expression: {expr}\n"
                    f"Error: {e}"
                )
                print(error_msg)
                logger.error(error_msg)
                return [], call_meta

        except Exception as e:
            error_msg = f"FilterMedication translation failed: {e}"
            print(error_msg)
            logger.error(error_msg)
            return [], ToolCallMeta()
