from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

from core.llm_lib.supervisor_worker_network.tools.base import Tool
from core.llm_lib.supervisor_worker_network.schemas.plan_schema import Plan
from core.llm_lib.supervisor_worker_network.tools.notes import (
    GetPatientNotesIds, ReadPatientNote, 
    SummarizePatientNote, HighlightPatientNote, AnalyzeNoteWithSpanAndReason
)
from core.llm_lib.supervisor_worker_network.tools.flowsheets import (
    ReadFlowsheetsTable, SummarizeFlowsheetsTable
)
from core.llm_lib.supervisor_worker_network.tools.medications import (
    GetMedicationsIds, ReadMedication, HighlightMedication
)
from core.llm_lib.supervisor_worker_network.tools.diagnosis import (
    GetDiagnosisIds, ReadDiagnosis, HighlightDiagnosis
)
from core.llm_lib.supervisor_worker_network.examples.planning_examples import combined_example_1

load_dotenv()

class GeneratePlanInput(BaseModel):
    prompt: str
    mrn: Optional[int] = 0
    csn: Optional[int] = 0

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

def build_agent_prompt(tools_specifications: dict,
                       user_prompt: str,
                       task_inputs: dict):
    system = f"""
    You are a planning agent that emits JSON execution plans.
    Use only the tools provided.
    Bind tool results to variables via 'output'.
    Use {{var}} to reference variables.
    For each step, write a small natural language description of what the step does to allow a user to understand the plan.
    You output results using Python and Jinja2 for resolving variables. Stick to the Python language for expressions.
    For example, if you are trying to read the first note, use {{note_ids[0]}} as the input variable to the read_patient_note function.
    During execution, the content in {{}} will be executed as Python code using the eval() function.
    Return *VALID JSON ONLY*; no prose.

    TOOLS:
    {json.dumps(tools_specifications, indent=2)}
    """
    
    user = json.dumps({
        "task": user_prompt,
        "inputs": task_inputs,
        "examples": combined_example_1
    }, indent=2)
    
    return system, user


class GeneratePlan(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"
        self.api_key = os.getenv("OPENAI_API_KEY")
    
    @property
    def name(self) -> str:
        return "generate_plan"
    
    @property
    def description(self) -> str:
        return "Generate a structured execution plan with steps for a given objective or task using available medical data tools."
    
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
                    "description": "The structured plan object with steps and metadata"
                }
            },
            "required": ["raw_plan"]
        }
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "The user's request or objective to create a plan for"
                },
                "mrn": {
                    "type": "integer",
                    "description": "Medical Record Number (optional, defaults to 0)",
                    "default": 0
                },
                "csn": {
                    "type": "integer", 
                    "description": "CSN encounter ID (optional, defaults to 0)",
                    "default": 0
                }
            },
            "required": ["prompt"],
            "additionalProperties": False
        }
    
    def __call__(self, inputs: GeneratePlanInput) -> Dict[str, Any]:
        # Initialize all tools
        tools_list = [
            GetPatientNotesIds(),
            ReadPatientNote(),
            SummarizePatientNote(),
            HighlightPatientNote(),
            AnalyzeNoteWithSpanAndReason(),
            ReadFlowsheetsTable(),
            SummarizeFlowsheetsTable(),
            GetMedicationsIds(),
            ReadMedication(),
            HighlightMedication(),
            GetDiagnosisIds(),
            ReadDiagnosis(),
            HighlightDiagnosis()
        ]

        patient_information = f"Patient Information: MRN: {inputs.mrn}, CSN: {inputs.csn}."
        newline = "\n"
        full_prompt = f"{inputs.prompt}{newline}{patient_information}"

        system_prompt, user_prompt_formatted = build_agent_prompt(
            get_tools_specifications(tools_list),
            full_prompt,
            {"mrn": inputs.mrn, "csn": inputs.csn}
        )
        
        client = OpenAI(api_key=self.api_key)

        response = client.responses.parse(
            model="gpt-4o-2024-08-06",
            instructions=system_prompt,
            input=user_prompt_formatted,
            text_format=Plan,
        )

        plan = response.output_parsed
        print(plan)

        return {
            "raw_plan": plan.dict()
        }