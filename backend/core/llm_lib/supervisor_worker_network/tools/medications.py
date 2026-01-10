from core.dataloders.datasets_loader import get_dataset_patients
from core.llm_lib.models.gpt import call_gpt, call_gpt_parsed
from core.llm_lib.supervisor_worker_network.tools.base import Tool
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
    GetMedicationsIdsInput, ReadMedicationInput, HighlightMedicationInput, FilterMedicationInput
)
from core.llm_lib.supervisor_worker_network.schemas.tool_outputs import FilterMedicationOutput
from core.llm_lib.supervisor_worker_network.schemas.table_schemas import MEDICATION_TABLE_SCHEMA
import json
import pandas as pd
from typing import List, Dict, Any, Optional

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

class FilterMedication(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []

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
        # 1. Fetch data
        medications = []
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        medications = encounter['medications']
                        break
        
        if not medications:
            return []

        # 2. Convert to DataFrame
        df = pd.DataFrame(medications)
        
        # 2b. Pre-process Date Columns if they exist
        date_cols = ['order_datetime', 'order_start_datetime', 'order_end_datetime', 'admin_datetime', 'etl_datetime']
        for col in date_cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        
        # 3. Static Schema for LLM Context
        # Use the "Golden Schema" from table_schemas.py to define the context for the LLM.
        # This ensures the LLM knows about all potential columns even if they aren't in this record.
        metadata_str = "\n".join([f"- {col}" for col in MEDICATION_TABLE_SCHEMA])

        # 4. Optimized System Prompt (The "Super-Prompt")
        system_prompt = f"""
        You are a highly capable data analyst assistant specializing in medical data filtering.
        Your task is to translate a user's natural language request into a single Python/Pandas boolean indexing expression.

        ### DataFrame Context (df):
        The medication table contains the following columns:
        {metadata_str}

        ### Syntax Guidelines:
        1. **String Matching**: Always use `.str.contains('term', case=False, na=False)` for partial matches or `.str.lower() == 'term'` for exact matches.
        2. **Numerical Filters**: Use standard operators: `>`, `<`, `>=`, `<=`, `==`. 
        3. **Set Matching**: Use `.isin(['val1', 'val2'])` for multiple categories.
        4. **Compound Logic (CRITICAL)**: Always wrap EVERY individual condition in parentheses. Example: `(df['col'] > 5) & (df['col'] < 10)`. Failure to use parentheses will cause a syntax error.
        5. **Date Filtering**: Use `pd.to_datetime` comparisons or `.dt` accessors. Example: `(df['order_datetime'].dt.date == pd.Timestamp('2026-01-10').date())`. 
        6. **Clinical Intelligence**: 
           - Map "dosage" or "dose" to 'dosage_order_amount' unless user specifies "given" amount.
           - Map "route" to 'medication_route'.
           - Map "status" or "action" to 'admin_action'.

        ### Rules:
        - Return ONLY the string expression that would go inside `df[...]`.
        - Do NOT include 'df[' or ']' around the whole response. 
        - CRITICAL: Every comparison condition must be enclosed in parentheses when using `&` or `|`.

        ### Example:
        Prompt: "Show medications given orally with dose over 10"
        Output: "(df['medication_route'].str.lower() == 'oral') & (df['dosage_order_amount'] > 10)"
        """

        try:
            response = call_gpt_parsed(
                input_text=inputs.prompt,
                json_schema=FilterMedicationOutput,
                model_name="GPT 4o",
                system_message=system_prompt
            )
            pandas_expr = response.pandas_expression
            print(f"DEBUG: Generated expression: {pandas_expr}") 
            
            # 5. Execution
            # Using eval() on the local df variable
            result_df = df[eval(pandas_expr)]
            
            # Return final list of order_ids
            return [int(oid) for oid in result_df['order_id'].tolist() if oid is not None]

        except Exception as e:
            print(f"FilterMedication failed: {e}")
            return []
