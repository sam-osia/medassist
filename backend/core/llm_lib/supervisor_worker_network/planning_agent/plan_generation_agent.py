from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

from core.llm_lib.supervisor_worker_network.tools.base import Tool
from core.llm_lib.supervisor_worker_network.schemas.plan_schema import Plan
from core.llm_lib.supervisor_worker_network.schemas.plan_step_schema import (
    IntermediatePlan, IntermediateToolStep, IntermediateLoopStep,
    IntermediateIfStep, IntermediateStep
)
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

load_dotenv()

class GeneratePlanInput(BaseModel):
    prompt: str
    mrn: Optional[int] = 0
    csn: Optional[int] = 0

def load_agent_config() -> str:
    """Load planning agent configuration from markdown file."""
    config_path = Path(__file__).parent / "planning_agent.md"
    with open(config_path, 'r', encoding='utf-8') as f:
        return f.read()

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


class GeneratePlan(Tool):
    def __init__(self, dataset: str = None):
        self.dataset_name = dataset or "SickKids ICU"
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.agent_config = load_agent_config()
    
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
        """Generate a plan using multi-stage incremental planning."""
        client = OpenAI(api_key=self.api_key)
        
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
        
        tools_specs = get_tools_specifications(tools_list)
        
        print("\n" + "="*80)
        print("🤔 PLANNING MODE: Breaking down your request...")
        print("="*80)
        
        print("\n📋 STAGE 1: Understanding the Task")
        print("-" * 80)
        plan = self._stage1_high_level_planning(client, inputs, tools_specs)
        
        print("\n🔧 STAGE 2: Structuring the Workflow")
        print("-" * 80)
        plan = self._stage2_refine_steps(client, inputs, plan, tools_specs)
        
        print("\n⚙️  STAGE 3: Finalizing Parameters")
        print("-" * 80)
        plan = self._stage3_determine_inputs(client, inputs, plan, tools_specs)
        
        # Convert to final plan
        final_plan = plan.to_final_plan()
        
        print("\n" + "="*80)
        print(f"✅ PLANNING COMPLETE: {len(final_plan.steps)} steps generated")
        print("="*80)
        
        # Display human-readable plan summary
        self._display_plan_summary(final_plan)
        
        return {
            "raw_plan": final_plan.dict()
        }
    
    def _stage1_high_level_planning(self, client: OpenAI, inputs: GeneratePlanInput, 
                                     tools_specs: Dict) -> IntermediatePlan:
        """Stage 1: Identify high-level steps and tools needed."""
        # Build system prompt from markdown config
        system_prompt = f"{self.agent_config}\n\n## Current Task: Stage 1\n\nAvailable tools:\n{json.dumps(tools_specs, indent=2)}\n\nFollow the Stage 1 instructions from above to create a high-level plan."

        user_prompt = f"Create a high-level plan for: {inputs.prompt}\nContext: MRN={inputs.mrn}, CSN={inputs.csn}"
        
        print(f"💭 Analyzing request: \"{inputs.prompt}\"")
        print(f"   Identifying required tools and workflow structure...\n")
        
        response = client.chat.completions.create(
            model="gpt-4o-2024-11-20",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        plan_data = json.loads(response.choices[0].message.content)
        
        # Display thinking
        steps_data = plan_data.get("steps", plan_data.get("plan", []))
        print(f"   ✓ Identified {len(steps_data)} high-level steps:")
        for i, step in enumerate(steps_data, 1):
            tool = step.get("tool", "N/A")
            summary = step.get("step_summary", "")
            print(f"     {i}. {summary}")
            print(f"        → Using tool: {tool}")
        
        # Parse into IntermediatePlan - handle both "steps" and "plan" keys
        steps = []
        for step_data in steps_data:
            if step_data.get("type") == "tool":
                steps.append(IntermediateToolStep(
                    id=step_data["id"],
                    step_summary=step_data["step_summary"],
                    reasoning=step_data.get("reasoning"),
                    tool=step_data["tool"],
                    inputs=None,  # Will be filled in stage 3
                    output=None  # Will be filled in stage 2
                ))
            elif step_data.get("type") == "loop":
                steps.append(IntermediateLoopStep(
                    id=step_data["id"],
                    step_summary=step_data.get("step_summary", "Loop step"),
                    reasoning=step_data.get("reasoning"),
                    for_var=None,  # Will be filled in stage 2
                    in_expr=None,  # Will be filled in stage 2
                    body=None  # Will be filled in stage 2
                ))
        
        return IntermediatePlan(
            steps=steps,
            planning_stage="generation"
        )
    
    def _stage2_refine_steps(self, client: OpenAI, inputs: GeneratePlanInput,
                             plan: IntermediatePlan, tools_specs: Dict) -> IntermediatePlan:
        """Stage 2: Add loop details, output variables, and nested steps."""
        # Build system prompt from markdown config
        system_prompt = f"{self.agent_config}\n\n## Current Task: Stage 2\n\nCurrent high-level steps:\n{json.dumps([{'id': s.id, 'summary': s.step_summary, 'type': s.type, 'tool': getattr(s, 'tool', None)} for s in plan.steps], indent=2)}\n\nAvailable tools:\n{json.dumps(tools_specs, indent=2)}\n\nFollow the Stage 2 instructions from above to refine the plan structure."

        user_prompt = f"Refine plan for: {inputs.prompt}\nContext: MRN={inputs.mrn}, CSN={inputs.csn}"
        
        print(f"💭 Refining workflow structure...")
        print(f"   Adding output variables, loop details, and data flow...\n")
        
        response = client.chat.completions.create(
            model="gpt-4o-2024-11-20",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        refined_data = json.loads(response.choices[0].message.content)
        
        # Display refinement thinking
        steps_data = refined_data.get("steps", refined_data.get("refined_plan", []))
        loop_count = sum(1 for s in steps_data if s.get("type") == "loop")
        tool_count = sum(1 for s in steps_data if s.get("type") == "tool")
        print(f"   ✓ Refined structure:")
        print(f"     • {tool_count} tool operations")
        print(f"     • {loop_count} iteration loops")
        for step in steps_data:
            if step.get("type") == "loop":
                body_size = len(step.get("body", []))
                print(f"     • Loop '{step.get('id')}' contains {body_size} nested steps")
        
        # Update plan with refined steps
        refined_steps = []
        
        for step_data in steps_data:
            step_type = step_data.get("type")
            
            if step_type == "tool":
                refined_steps.append(IntermediateToolStep(
                    id=step_data.get("id", f"step_{len(refined_steps)}"),
                    step_summary=step_data.get("step_summary", step_data.get("step", "Tool step")),
                    reasoning=step_data.get("reasoning"),
                    tool=step_data["tool"],
                    inputs=None,  # Still to be determined in stage 3
                    output=step_data.get("output")
                ))
            elif step_type == "loop":
                # Parse loop body
                body_steps = []
                for body_step_data in step_data.get("body", []):
                    if body_step_data.get("type") == "tool":
                        body_steps.append(IntermediateToolStep(
                            id=body_step_data.get("id", f"body_step_{len(body_steps)}"),
                            step_summary=body_step_data.get("step_summary", body_step_data.get("step", "Body step")),
                            reasoning=body_step_data.get("reasoning"),
                            tool=body_step_data["tool"],
                            inputs=None,
                            output=body_step_data.get("output")
                        ))
                
                refined_steps.append(IntermediateLoopStep(
                    id=step_data.get("id", f"loop_{len(refined_steps)}"),
                    step_summary=step_data.get("step_summary", step_data.get("step", "Loop step")),
                    reasoning=step_data.get("reasoning"),
                    for_var=step_data.get("for_var"),
                    in_expr=step_data.get("in_expr"),
                    body=body_steps if body_steps else None
                ))
        
        plan.steps = refined_steps
        plan.planning_stage = "summarization"
        return plan
    
    def _stage3_determine_inputs(self, client: OpenAI, inputs: GeneratePlanInput,
                                  plan: IntermediatePlan, tools_specs: Dict) -> IntermediatePlan:
        """Stage 3: Determine specific inputs for each tool call."""
        # Build system prompt from markdown config
        system_prompt = f"{self.agent_config}\n\n## Current Task: Stage 3\n\nAvailable tools with parameters:\n{json.dumps(tools_specs, indent=2)}\n\nCurrent plan structure:\n{json.dumps([self._serialize_step_for_display(s) for s in plan.steps], indent=2)}\n\nContext: MRN={inputs.mrn}, CSN={inputs.csn}\n\nFollow the Stage 3 instructions from above to determine all input parameters."

        user_prompt = f"Determine inputs for: {inputs.prompt}\nContext: MRN={inputs.mrn}, CSN={inputs.csn}"
        
        print(f"💭 Determining input parameters for each step...")
        print(f"   Mapping variables and dependencies...\n")
        
        response = client.chat.completions.create(
            model="gpt-4o-2024-11-20",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.2
        )
        
        final_data = json.loads(response.choices[0].message.content)
        
        # Display input determination thinking
        steps_data = final_data.get("steps", final_data.get("plan", []))
        print(f"   ✓ All parameters determined")
        print(f"     • Patient context: MRN={inputs.mrn}, CSN={inputs.csn}")
        
        # Count variables
        all_outputs = set()
        def collect_outputs(steps):
            for s in steps:
                if s.get("output"):
                    all_outputs.add(s["output"])
                if s.get("type") == "loop" and s.get("body"):
                    collect_outputs(s["body"])
        collect_outputs(steps_data)
        if all_outputs:
            print(f"     • {len(all_outputs)} variables created: {', '.join(sorted(all_outputs))}")
        
        # Update plan with inputs - handle various response formats
        final_steps = []
        
        for step_data in steps_data:
            step_type = step_data.get("type")
            
            if step_type == "tool":
                final_steps.append(IntermediateToolStep(
                    id=step_data.get("id", f"step_{len(final_steps)}"),
                    step_summary=step_data.get("step_summary", step_data.get("step", "Tool step")),
                    reasoning=step_data.get("reasoning"),
                    tool=step_data["tool"],
                    inputs=step_data.get("inputs", step_data.get("input", {})),
                    output=step_data.get("output")
                ))
            elif step_type == "loop":
                body_steps = []
                for body_step_data in step_data.get("body", []):
                    if body_step_data.get("type") == "tool":
                        body_steps.append(IntermediateToolStep(
                            id=body_step_data.get("id", f"body_step_{len(body_steps)}"),
                            step_summary=body_step_data.get("step_summary", body_step_data.get("step", "Body step")),
                            reasoning=body_step_data.get("reasoning"),
                            tool=body_step_data["tool"],
                            inputs=body_step_data.get("inputs", body_step_data.get("input", {})),
                            output=body_step_data.get("output")
                        ))
                
                final_steps.append(IntermediateLoopStep(
                    id=step_data.get("id", f"loop_{len(final_steps)}"),
                    step_summary=step_data.get("step_summary", step_data.get("step", "Loop step")),
                    reasoning=step_data.get("reasoning"),
                    for_var=step_data.get("for_var"),
                    in_expr=step_data.get("in_expr"),
                    body=body_steps if body_steps else None
                ))
        
        plan.steps = final_steps
        plan.planning_stage = "complete"
        return plan
    
    def _serialize_step_for_display(self, step: IntermediateStep) -> Dict:
        """Convert intermediate step to dict for display."""
        base = {
            "id": step.id,
            "summary": step.step_summary,
            "type": step.type
        }
        
        if isinstance(step, IntermediateToolStep):
            base.update({
                "tool": step.tool,
                "output": step.output,
                "inputs": step.inputs
            })
        elif isinstance(step, IntermediateLoopStep):
            base.update({
                "for_var": step.for_var,
                "in_expr": step.in_expr,
                "body": [self._serialize_step_for_display(s) for s in step.body] if step.body else []
            })
        
        return base
    
    def _display_plan_summary(self, plan) -> None:
        """Display a human-readable summary of the final plan."""
        print("\n" + "="*80)
        print("📝 PLAN SUMMARY")
        print("="*80)
        
        for i, step in enumerate(plan.steps, 1):
            self._print_step(step, i, indent=0)
        
        print("\n" + "="*80)
    
    def _print_step(self, step, number, indent=0):
        """Recursively print step details in a readable format."""
        prefix = "  " * indent
        
        if step.type == "tool":
            print(f"\n{prefix}Step {number}: {step.step_summary}")
            print(f"{prefix}  Tool: {step.tool}")
            if step.output:
                print(f"{prefix}  Output → {step.output}")
            if step.reasoning:
                print(f"{prefix}  Why: {step.reasoning}")
        
        elif step.type == "loop":
            print(f"\n{prefix}Step {number}: {step.step_summary}")
            print(f"{prefix}  Loop: for {step.for_var} in {step.in_expr}")
            if step.reasoning:
                print(f"{prefix}  Why: {step.reasoning}")
            
            if step.body:
                print(f"{prefix}  Loop body:")
                for j, body_step in enumerate(step.body, 1):
                    self._print_step(body_step, f"{number}.{j}", indent + 1)
