import sys

from core.dataloders.datasets_loader import get_dataset_patients
from core.llm_provider import call
from core.workflow.tools.base import Tool
from core.workflow.schemas.tool_inputs import (
    ReadFlowsheetsTableInput, SummarizeFlowsheetsTableInput, AnalyzeFlowsheetInstanceInput
)
import json
from typing import Dict, Any


class ReadFlowsheetsTable(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "read_flowsheets_table"
    
    @property
    def description(self) -> str:
        return "Read the table of flowsheets for a given patient MRN and CSN encounter."
    
    @property
    def category(self) -> str:
        return "flowsheets"

    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "JSON string containing the flowsheets pivot table for the specified patient encounter."
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
    
    def __call__(self, inputs: ReadFlowsheetsTableInput) -> str:
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return json.dumps(encounter.get('flowsheets_pivot', []))
        return "[]"

class SummarizeFlowsheetsTable(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "summarize_flowsheets_table"
    
    @property
    def description(self) -> str:
        return "Summarize the table of flowsheets in a clear and concise manner."
    
    @property
    def category(self) -> str:
        return "flowsheets"

    @property
    def returns(self) -> dict:
        return {
            "type": "string",
            "description": "A concise natural-language summary of the flowsheets data provided."
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "flowsheets_table": {
                    "type": "string",
                    "description": "JSON string containing the table of flowsheets"
                }
            },
            "required": ["flowsheets_table"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: SummarizeFlowsheetsTableInput) -> str:
        system_prompt = """
        You are a helpful medical assistant that analyzes flowsheets data.
        Your task is to summarize the flowsheets table in a clear and concise manner.
        Focus on identifying trends, abnormal values, and clinically significant information.
        The output should be a concise summary that highlights the most important aspects of the data.
        """

        user_prompt = f"""
        <flowsheets_table>
        {inputs.flowsheets_table}
        </flowsheets_table>

        Please analyze this flowsheets data and provide a clear, concise summary.
        Focus on trends, abnormal values, and clinically significant information.
        """

        messages = [{"role": "user", "content": user_prompt}]
        result = call(messages=messages, system=system_prompt)
        return result.content

class AnalyzeFlowsheetInstance(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"  # Default dataset
        self.dataset = get_dataset_patients(self.dataset_name) or []
    
    @property
    def name(self) -> str:
        return "analyze_flowsheet_instance"
    
    @property
    def description(self) -> str:
        return "Analyze a single flowsheet instance for CAPD score threshold comparison based on patient conditions."
    
    @property
    def category(self) -> str:
        return "flowsheets"

    @property
    def returns(self) -> dict:
        return {
            "type": "boolean",
            "description": "True if CAPD total score meets or exceeds threshold, False otherwise."
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "flowsheet_instance": {
                    "type": "string",
                    "description": "JSON string containing a single flowsheet instance with timestamp and measurements"
                },
                "sensory_deficit": {
                    "type": "boolean",
                    "description": "Whether patient has sensory deficit (lowers threshold to 6)",
                    "default": False
                },
                "motor_deficit": {
                    "type": "boolean", 
                    "description": "Whether patient has motor deficit (lowers threshold to 6)",
                    "default": False
                },
                "developmental_delay": {
                    "type": "boolean",
                    "description": "Whether patient has developmental delay (lowers threshold to 6)", 
                    "default": False
                }
            },
            "required": ["flowsheet_instance"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: AnalyzeFlowsheetInstanceInput) -> bool:
        print('flowsheet inputs:')
        print(inputs)
        try:
            instance = json.loads(inputs.flowsheet_instance)
        except json.JSONDecodeError:
            return False
        
        # Determine threshold based on patient conditions
        threshold = 6 if (inputs.sensory_deficit or inputs.motor_deficit or inputs.developmental_delay) else 9
        
        # Look for CAPD total score in measurements
        measurements = instance.get('measurements', {})

        for measurement_key, measurement_data in measurements.items():
            flo_meas_name = measurement_data.get('flo_meas_name', '')
            if flo_meas_name == 'SK IP R CAPD TOTAL SCORE':
                try:
                    score = float(measurement_data.get('value', 0))
                    return score >= threshold
                except (ValueError, TypeError):
                    return False
        
        # If CAPD total score not found, return False
        return False