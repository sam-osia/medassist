from core.dataloders.datasets_loader import get_dataset_patients
from core.llm_lib.models.gpt import call_gpt, call_gpt_parsed
from core.llm_lib.supervisor_worker_network.tools.base import Tool
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
    GetMedicationsIdsInput, ReadMedicationInput, HighlightMedicationInput, FilterMedicationInput
)
from core.llm_lib.supervisor_worker_network.schemas.table_schemas import MEDICATION_TABLE_SCHEMA
import json
import pandas as pd
import logging
import re
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class GetMedicationsIds(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "get_medications_ids"
    
    @property
    def description(self) -> str:
        return "Return a list of medication order IDs for a given patient MRN and CSN encounter."

    @property
    def category(self) -> str:
        return "medications"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "list",
            "items": {
                "type": "int"
            }
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "mrn": {
                    "type": "integer",
                    "description": "Medical Record Number"
                },
                "csn": {
                    "type": "integer",
                    "description": "CSN encounter ID"
                }
            },
            "required": ["mrn", "csn"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: GetMedicationsIdsInput) -> List[int]:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return [med['order_id'] for med in encounter['medications'] if med.get('order_id') is not None]
        return []

class ReadMedication(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "read_medication"
    
    @property
    def description(self) -> str:
        return "Return details about a specific medication as a JSON string."
    
    @property
    def category(self) -> str:
        return "medications"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "JSON string containing the full medication record."
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "mrn": {
                    "type": "integer",
                    "description": "Medical Record Number"
                },
                "csn": {
                    "type": "integer",
                    "description": "CSN encounter ID"
                },
                "order_id": {
                    "type": "integer",
                    "description": "The specific medication order ID to retrieve"
                }
            },
            "required": ["mrn", "csn", "order_id"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: ReadMedicationInput) -> str:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        # Find the specific medication
                        for medication in encounter['medications']:
                            if medication.get('order_id') and int(medication['order_id']) == int(inputs.order_id):
                                return json.dumps(medication)
        return "{}"


class HighlightMedication(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "highlight_medication"

    @property
    def description(self) -> str:
        return "Highlight the medication if the medication is in the list of medications you are searching for."

    @property
    def category(self) -> str:
        return "medications"

    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "The medication string if found, otherwise an empty string."
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "medication_name": {
                    "type": "string",
                    "description": "The medication to search for."
                },
                "medications_list": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of medication names to search within."
                }
            },
            "required": ["medication_name", "medications_list"],
            "additionalProperties": False
        }

    def __call__(self, inputs: HighlightMedicationInput) -> str:
        if inputs.medication_name in inputs.medications_list:
            return inputs.medication_name
        return ""

class FilterMedicationLLMOutput(BaseModel):
    pandas_expression: str  # The boolean mask expression, e.g., "(df['dosage_order_amount'] > 10) & (df['medication_route'] == 'Oral')"
    explanation: Optional[str] = None

def is_safe_eval_expression(expression: str) -> bool:
    """Check for dangerous keywords to prevent code injection."""
    forbidden = {
        'import', 'os', 'sys', 'rm', 'shutil', 'subprocess', 'open', 'write', 'read',
        '__builtins__', '__dict__', '__class__', '__base__', '__subclasses__',
        'eval', 'exec', 'getattr', 'setattr', 'delattr', 'classmethod', 'staticmethod',
        'property', 'type', 'builtins', 'drop', 'pop', 'inplace', 'clear', 'del'
    }
    # Check for any forbidden words as standalone tokens (basic guard)
    tokens = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', expression)
    for token in tokens:
        if token in forbidden:
            return False
    return True

class FilterMedication(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
        self.last_expression = None

    @property
    def name(self) -> str:
        return "filter_medication"

    @property
    def description(self) -> str:
        return "Filter the medication table based on a natural language prompt and return the order_ids of matching medications."

    @property
    def category(self) -> str:
        return "medications"

    @property
    def returns(self) -> dict:
        return {
            "type": "array",
            "items": { "type": "integer" },
            "description": "List of order_id values for medications that match the filter criteria."
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "mrn": { "type": "integer", "description": "Medical Record Number" },
                "csn": { "type": "integer", "description": "CSN encounter ID" },
                "prompt": { "type": "string", "description": "The filtering criteria in natural language (e.g., 'Given medications with dosage > 100')" },
                "table_schema": { 
                    "type": "array", 
                    "items": { "type": "string" },
                    "description": "The list of column names available in the medication table." 
                }
            },
            "required": ["mrn", "csn", "prompt"],
            "additionalProperties": False
        }

    def __call__(self, inputs: FilterMedicationInput) -> List[int]:
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
            return []

        # 2. Convert to DataFrame
        df = pd.DataFrame(medications_list)
        
        if df.empty:
            return []
        
        # 2b. Pre-process Date Columns if they exist
        date_cols = ['order_datetime', 'order_start_datetime', 'order_end_datetime', 'admin_datetime', 'etl_datetime']
        for col in date_cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        
        # 3. Static Schema for LLM Context
        # Use the "Golden Schema" from table_schemas.py to define the context for the LLM.
        # This ensures the LLM knows about all potential columns even if they aren't in this record.
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
        3. For date columns (order_datetime, admin_datetime, etc.), NEVER use `.str`. Use direct datetime comparisons like `df['order_datetime'] >= '2026-01-10'` or `df['order_datetime'].dt.date == pd.to_datetime('2026-01-10').date()`.
        4. For column-to-column comparisons, use `df['col_a'] > df['col_b']`.
        5. Current system date: 2026-01-10.

        ### Examples:
        - "Medications given today": "(df['order_datetime'] >= '2026-01-10') & (df['admin_action'] == 'Given')"
        - "Dose less than ordered": "df['dosage_given_amount'] < df['dosage_order_amount']"
        - "Pain meds (Ibuprofen or Fentanyl)": "df['medication_name'].isin(['Ibuprofen', 'Fentanyl'])"
        - "Oral meds starting with 'A'": "(df['medication_route'] == 'Oral') & (df['medication_name'].str.startswith('A', na=False))"
        - "Concentration 0.9%": "df['medication_name'].str.contains('0\\.9%', case=False, na=False, regex=True)"
        """

        try:
            response = call_gpt_parsed(
                input_text=inputs.prompt,
                json_schema=FilterMedicationLLMOutput,
                model_name="GPT 4o",
                system_message=system_prompt
            )
            
            expr = response.pandas_expression
            self.last_expression = expr
            if not expr:
                return []

            # 5. Security Guardrail
            if not is_safe_eval_expression(expr):
                error_msg = f"SECURITY ALERT: Blocked malicious expression: {expr}"
                print(error_msg)
                logger.warning(error_msg)
                return []

            # 6. Execution (Secure eval)
            try:
                # Jailed environment: no builtins, but allow pd for date conversions if needed
                # and of course the dataframe 'df'
                final_mask = eval(expr, {"__builtins__": {}, "pd": pd}, {"df": df})
                
                if final_mask is None:
                    return []

                result_df = df[final_mask]
                return [int(oid) for oid in result_df['order_id'].unique().tolist() if oid is not None]

            except Exception as e:
                # Detailed logging of execution failure
                error_msg = (
                    f"FilterMedication execution failed for prompt '{inputs.prompt}':\n"
                    f"Expression: {expr}\n"
                    f"Error: {e}"
                )
                print(error_msg)
                logger.error(error_msg)
                return []

        except Exception as e:
            # Detailed logging of translation/GPT failure
            error_msg = f"FilterMedication translation failed: {e}"
            print(error_msg)
            logger.error(error_msg)
            return []
