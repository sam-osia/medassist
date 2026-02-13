import sys

from pydantic import BaseModel, Field

from core.dataloaders.datasets_loader import get_dataset_patients
from core.llm_provider import call
from core.workflow.tools.base import Tool, ToolCallMeta, meta_from_llm_result
from core.workflow.schemas.tool_inputs import ModelInput
import json
from typing import Dict, Any, Optional


# ── Input Models ──────────────────────────────────────────────

class ReadFlowsheetsTableInput(BaseModel):
    mrn: int = Field(description="Medical Record Number")
    csn: int = Field(description="CSN encounter ID")


class SummarizeFlowsheetsTableInput(BaseModel):
    flowsheets_table: str = Field(description="JSON string containing the table of flowsheets")
    model: Optional[ModelInput] = Field(default=None, description="LLM model selection")


class AnalyzeFlowsheetInstanceInput(BaseModel):
    flowsheet_instance: str = Field(description="JSON string containing a single flowsheet instance with timestamp and measurements")
    sensory_deficit: bool = Field(default=False, description="Whether patient has sensory deficit (lowers threshold to 6)")
    motor_deficit: bool = Field(default=False, description="Whether patient has motor deficit (lowers threshold to 6)")
    developmental_delay: bool = Field(default=False, description="Whether patient has developmental delay (lowers threshold to 6)")


# ── Tool Classes ──────────────────────────────────────────────

class ReadFlowsheetsTable(Tool):
    Input = ReadFlowsheetsTableInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "read_flowsheets_table"

    @property
    def role(self) -> str:
        return "reader"

    @property
    def description(self) -> str:
        return "Read the table of flowsheets for a given patient MRN and CSN encounter."

    @property
    def display_name(self) -> str:
        return "Read Flowsheets Table"

    @property
    def user_description(self) -> str:
        return "Read the table of flowsheets for a given patient MRN and CSN encounter."

    @property
    def category(self) -> str:
        return "flowsheets"

    def _returns_schema(self) -> dict:
        return {
            "type": "string",
            "description": "JSON string containing the flowsheets pivot table for the specified patient encounter."
        }

    def __call__(self, inputs: ReadFlowsheetsTableInput):
        # Find the patient in the dataset
        for patient in self.dataset:
            if patient['mrn'] == inputs.mrn:
                # Find the specific encounter
                for encounter in patient['encounters']:
                    if int(encounter['csn']) == int(inputs.csn):
                        return json.dumps(encounter.get('flowsheets_pivot', [])), ToolCallMeta()
        return "[]", ToolCallMeta()

class SummarizeFlowsheetsTable(Tool):
    Input = SummarizeFlowsheetsTableInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "summarize_flowsheets_table"

    @property
    def description(self) -> str:
        return "Summarize the table of flowsheets in a clear and concise manner."

    @property
    def display_name(self) -> str:
        return "Summarize Flowsheets Table"

    @property
    def uses_llm(self) -> bool:
        return True

    @property
    def user_description(self) -> str:
        return "Summarize the table of flowsheets in a clear and concise manner."

    @property
    def category(self) -> str:
        return "flowsheets"

    def _returns_schema(self) -> dict:
        return {
            "type": "string",
            "description": "A concise natural-language summary of the flowsheets data provided."
        }

    def __call__(self, inputs: SummarizeFlowsheetsTableInput):
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
        result = call(messages=messages, key_name=inputs.model.key_name,
                      system=system_prompt)
        return result.content, meta_from_llm_result(result)

class AnalyzeFlowsheetInstance(Tool):
    Input = AnalyzeFlowsheetInstanceInput

    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
        self.dataset = get_dataset_patients(self.dataset_name) or []

    @property
    def name(self) -> str:
        return "analyze_flowsheet_instance"

    @property
    def description(self) -> str:
        return "Analyze a single flowsheet instance for CAPD score threshold comparison based on patient conditions."

    @property
    def display_name(self) -> str:
        return "Analyze Flowsheet Instance"

    @property
    def user_description(self) -> str:
        return "Analyze a single flowsheet instance for CAPD score threshold comparison based on patient conditions."

    @property
    def category(self) -> str:
        return "flowsheets"

    def _returns_schema(self) -> dict:
        return {
            "type": "boolean",
            "description": "True if CAPD total score meets or exceeds threshold, False otherwise."
        }

    def __call__(self, inputs: AnalyzeFlowsheetInstanceInput):
        print('flowsheet inputs:')
        print(inputs)
        try:
            instance = json.loads(inputs.flowsheet_instance)
        except json.JSONDecodeError:
            return False, ToolCallMeta()

        # Determine threshold based on patient conditions
        threshold = 6 if (inputs.sensory_deficit or inputs.motor_deficit or inputs.developmental_delay) else 9

        # Look for CAPD total score in measurements
        measurements = instance.get('measurements', {})

        for measurement_key, measurement_data in measurements.items():
            flo_meas_name = measurement_data.get('flo_meas_name', '')
            if flo_meas_name == 'SK IP R CAPD TOTAL SCORE':
                try:
                    score = float(measurement_data.get('value', 0))
                    return score >= threshold, ToolCallMeta()
                except (ValueError, TypeError):
                    return False, ToolCallMeta()

        # If CAPD total score not found, return False
        return False, ToolCallMeta()
