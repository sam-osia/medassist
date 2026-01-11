from core.dataloders.datasets_loader import get_dataset_patients
from core.llm_lib.models.gpt import call_gpt, call_gpt_parsed
from core.llm_lib.supervisor_worker_network.tools.base import Tool
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import (
    GetMedicationsIdsInput, ReadMedicationInput, HighlightMedicationInput, FilterMedicationInput
)
from core.llm_lib.supervisor_worker_network.schemas.table_schemas import MEDICATION_TABLE_SCHEMA
import json
import pandas as pd
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel

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

class FilterCondition(BaseModel):
    column: str
    operator: str  # '==', '!=', '>', '<', '>=', '<=', 'contains', 'isin', 'between', 'isna', 'notna', 'regex', 'starts_with'
    value: Optional[Union[str, int, float, List[str], List[int], List[float]]] = None
    value_type: str = "literal"  # 'literal' (compare against value) or 'column' (compare against another column)

class FilterMedicationLLMOutput(BaseModel):
    logic_operator: str = "AND"  # "AND" or "OR"
    filters: List[FilterCondition]
    explanation: Optional[str] = None

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
        # 1. Fetch Medications for the specific Patient/Encounter
        medications_list = []
        for patient in self.dataset:
            if patient.get('mrn') == inputs.mrn:
                for encounter in patient.get('encounters', []):
                    if int(encounter.get('csn')) == int(inputs.csn):
                        # Extract medications and re-attach context IDs to match Golden Schema
                        for med in encounter.get('medications', []):
                            row = med.copy()
                            row['mrn'] = inputs.mrn
                            row['pat_enc_csn_id'] = inputs.csn
                            medications_list.append(row)
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
        Your task is to translate a user's natural language request into a list of structured filter conditions.

        ### DataFrame Context:
        The medication table contains the following columns:
        {metadata_str}

        ### Operator Guidelines:
        1. **'==' / '!='**: For exact matches (e.g., status, route).
        2. **'>' / '<' / '>=' / '<='**: For numerical values (e.g., dose amount).
        3. **'contains'**: For partial string matches (e.g., medication names).
        4. **'isin'**: For matching against a list of values.
        5. **'between'**: For numeric or date ranges. Give a list [start, end].
        6. **'isna' / 'notna'**: To check for missing or present values.
        7. **'regex'**: For regular expression matching.
        8. **'starts_with'**: For prefix matching.

        ### Column-to-Column Comparison:
        - If the user asks to compare two columns (e.g., "given amount less than ordered amount"), set `value_type` to "column" and `value` to the name of the second column.

        ### Logical Rules:
        - If the user specifies multiple required conditions, use `logic_operator: "AND"`.
        - If they say "either/or" or "any of", use `logic_operator: "OR"`.
        - Map clinical terms: "dosage/dose" -> 'dosage_order_amount', "route" -> 'medication_route', "status" -> 'admin_action'.

        ### Date Handling:
        - Dates are already pre-converted. Use standard comparison operators (>, <, ==) for date columns.
        - Current system date: 2026-01-10. Use this for relative queries like "ordered today".

        ### Examples:
        - "Medications given today": [[{{"column": "order_datetime", "operator": ">=", "value": "2026-01-10T00:00:00"}}, {{"column": "admin_action", "operator": "==", "value": "Given"}}]]
        - "Dose less than ordered": [[{{"column": "dosage_given_amount", "operator": "<", "value": "dosage_order_amount", "value_type": "column"}}]]
        - "Sodium Chloride 0.9%": [[{{"column": "medication_name", "operator": "regex", "value": "Sodium Chloride.*0\\.9%"}}]]
        - "Pain meds (Ibuprofen/Acetaminophen)": [[{{"column": "medication_name", "operator": "isin", "value": ["Ibuprofen", "Acetaminophen"]}}]]
        - "Oral meds starting with 'A'": [[{{"column": "medication_route", "operator": "==", "value": "Oral"}}, {{"column": "medication_name", "operator": "starts_with", "value": "A"}}]]
        """

        try:
            response = call_gpt_parsed(
                input_text=inputs.prompt,
                json_schema=FilterMedicationLLMOutput,
                model_name="GPT 4o",
                system_message=system_prompt
            )
            
            if not response.filters:
                return []

            # 5. Execution (Structured & Safe)
            # Instead of eval(), we build the mask manually
            final_mask = None
            
            for f in response.filters:
                col = f.column
                op = f.operator
                val = f.value
                
                if col not in df.columns:
                    continue
                    
                # Determine comparison value (literal or column)
                if f.value_type == "column" and isinstance(val, str) and val in df.columns:
                    cmp_val = df[val]
                else:
                    cmp_val = val

                mask = None
                if op == '==':
                    mask = df[col] == cmp_val
                elif op == '!=':
                    mask = df[col] != cmp_val
                elif op == '>':
                    mask = df[col] > cmp_val
                elif op == '<':
                    mask = df[col] < cmp_val
                elif op == '>=':
                    mask = df[col] >= cmp_val
                elif op == '<=':
                    mask = df[col] <= cmp_val
                elif op == 'contains':
                    mask = df[col].astype(str).str.contains(str(val), case=False, na=False)
                elif op == 'regex':
                    mask = df[col].astype(str).str.contains(str(val), case=False, na=False, regex=True)
                elif op == 'starts_with':
                    mask = df[col].astype(str).str.startswith(str(val), na=False)
                elif op == 'isin':
                    mask = df[col].isin(val if isinstance(val, list) else [val])
                elif op == 'between':
                    if isinstance(val, list) and len(val) == 2:
                        mask = df[col].between(val[0], val[1])
                elif op == 'isna':
                    mask = df[col].isna()
                elif op == 'notna':
                    mask = df[col].notna()

                if mask is not None:
                    if final_mask is None:
                        final_mask = mask
                    else:
                        if response.logic_operator == "OR":
                            final_mask |= mask
                        else:
                            final_mask &= mask

            if final_mask is None:
                return [int(oid) for oid in df['order_id'].unique().tolist() if oid is not None]

            result_df = df[final_mask]
            
            # Return final list of order_ids
            return [int(oid) for oid in result_df['order_id'].unique().tolist() if oid is not None]

        except Exception as e:
            print(f"FilterMedication failed: {e}")
            return []
