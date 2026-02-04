from pydantic import BaseModel
from typing import Optional, Dict, Any
import json

from core.llm_provider import call
from core.workflow.tools.base import Tool
from core.workflow.schemas.workflow_schema import Workflow
from core.workflow.tools.notes import (
    GetPatientNotesIds, ReadPatientNote,
    SummarizePatientNote, AnalyzeNoteWithSpanAndReason
)
from core.workflow.tools.flowsheets import (
    ReadFlowsheetsTable, SummarizeFlowsheetsTable
)
from core.workflow.tools.medications import (
    GetMedicationsIds, ReadMedication
)
from core.workflow.tools.diagnosis import (
    GetDiagnosisIds, ReadDiagnosis
)

class EditPlanInput(BaseModel):
    existing_plan: Dict[str, Any]  # Accept any dict instead of strict Plan validation
    edit_request: str

def get_tools_specifications(tools_list):
    specifications = {}
    for tool in tools_list:
        specifications[tool.name] = {
            "category": tool.category,
            "description": tool.description,
            "parameters": tool.parameters,
            "returns": tool.returns
        }
    return specifications

def build_edit_prompt(tools_specifications: dict,
                     original_plan: dict,
                     general_edit_request: str,
                     task_inputs: dict):
    system = f"""
    You are a plan editing agent that modifies existing JSON execution plans based on user edit requests.
    Use only the tools provided.
    Bind tool results to variables via 'output'.
    Use {{var}} to reference variables.
    For each step, write a small natural language description of what the step does to allow a user to understand the plan.
    You output results using Python and Jinja2 for resolving variables. Stick to the Python language for expressions.
    For example, if you are trying to read the first note, use {{note_ids[0]}} as the input variable to the read_patient_note function.
    During execution, the content in {{}} will be executed as Python code using the eval() function.
    Return *VALID JSON ONLY*; no prose.

    Your task is to modify the existing plan to incorporate the user's general edit request.
    This could involve adding new steps, removing steps, reordering steps, or modifying the overall workflow.
    Maintain consistency in variable references and ensure all step IDs remain unique.

    TOOLS:
    {json.dumps(tools_specifications, indent=2)}
    """
    
    user = json.dumps({
        "original_plan": original_plan,
        "general_edit_request": general_edit_request,
        "inputs": task_inputs,
        "instructions": f"Modify the existing plan to incorporate this general edit request: {general_edit_request}"
    }, indent=2)
    
    return system, user

class EditPlan(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "sickkids_icu"
    
    @property
    def name(self) -> str:
        return "edit_plan"
    
    @property
    def description(self) -> str:
        return "Edit and modify an existing structured execution plan based on user feedback or change requests."
    
    @property
    def category(self) -> str:
        return "planning"
    
    @property
    def returns(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "raw_plan": {
                    "type": "object",
                    "description": "The updated structured plan object with steps and metadata"
                }
            },
            "required": ["raw_plan"]
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "existing_plan": {
                    "type": "object",
                    "description": "The current plan dict to be modified"
                },
                "edit_request": {
                    "type": "string",
                    "description": "Description of the changes to make to the plan"
                }
            },
            "required": ["existing_plan", "edit_request"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: EditPlanInput) -> Dict[str, Any]:
        # Initialize all tools
        tools_list = [
            GetPatientNotesIds(),
            ReadPatientNote(),
            SummarizePatientNote(),
            AnalyzeNoteWithSpanAndReason(),
            ReadFlowsheetsTable(),
            SummarizeFlowsheetsTable(),
            GetMedicationsIds(),
            ReadMedication(),
            GetDiagnosisIds(),
            ReadDiagnosis(),
        ]

        # Extract MRN and CSN from existing plan or use defaults
        mrn = 0
        csn = 0
        if 'metadata' in inputs.existing_plan and 'inputs' in inputs.existing_plan['metadata']:
            mrn = inputs.existing_plan['metadata']['inputs'].get('mrn', 0)
            csn = inputs.existing_plan['metadata']['inputs'].get('csn', 0)

        task_inputs = {"mrn": mrn, "csn": csn}
        
        system_prompt, user_prompt_formatted = build_edit_prompt(
            get_tools_specifications(tools_list),
            inputs.existing_plan,
            inputs.edit_request,
            task_inputs
        )

        result = call(
            messages=[{"role": "user", "content": user_prompt_formatted}],
            system=system_prompt,
            schema=Plan
        )

        plan = result.parsed

        return {
            "raw_plan": plan.dict()
        }