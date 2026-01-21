from core.workflow.tools.notes import (
    GetPatientNotesIds, ReadPatientNote,
    SummarizePatientNote, HighlightPatientNote, IdentifyFlag
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
from core.workflow.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput,
    HighlightPatientNoteInput, ReadFlowsheetsTableInput,
    SummarizeFlowsheetsTableInput, GetMedicationsIdsInput, ReadMedicationInput,
    GetDiagnosisIdsInput, ReadDiagnosisInput
)
from core.workflow.utils.colors import print_colored_event, Colors
from core.workflow.utils.event_handler import (
    publish_tool_call, publish_tool_result, publish_tool_call_with_data_item,
    publish_tool_result_with_data_item, publish_llm_thinking,
    publish_error, publish_final_result
)
from core.workflow.utils.tool_mapping import (
    get_data_item_from_tool, should_use_data_item_events
)

import os
from dotenv import load_dotenv
from openai import OpenAI
from tqdm import tqdm
from pprint import pprint
import json

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

def get_input_model_for_tool(tool_name: str):
    """Map tool names to their corresponding Pydantic input model classes."""
    input_model_map = {
        "get_patient_notes_ids": GetPatientNotesIdsInput,
        "read_patient_note": ReadPatientNoteInput,
        "summarize_patient_note": SummarizePatientNoteInput,
        "highlight_patient_note": HighlightPatientNoteInput,
        "read_flowsheets_table": ReadFlowsheetsTableInput,
        "summarize_flowsheets_table": SummarizeFlowsheetsTableInput,
        "get_medications_ids": GetMedicationsIdsInput,
        "read_medication": ReadMedicationInput,
        "get_diagnosis_ids": GetDiagnosisIdsInput,
        "read_diagnosis": ReadDiagnosisInput,
    }
    
    if tool_name not in input_model_map:
        raise ValueError(f"No input model found for tool: {tool_name}")
    
    return input_model_map[tool_name]

def get_tools_list(dataset: str = None):
    """Initialize tools with dataset context."""
    return [
        GetPatientNotesIds(dataset=dataset),
        ReadPatientNote(dataset=dataset),
        SummarizePatientNote(dataset=dataset),
        HighlightPatientNote(dataset=dataset),
        IdentifyFlag(dataset=dataset),
        ReadFlowsheetsTable(dataset=dataset),
        SummarizeFlowsheetsTable(dataset=dataset),
        GetMedicationsIds(dataset=dataset),
        ReadMedication(dataset=dataset),
        GetDiagnosisIds(dataset=dataset),
        ReadDiagnosis(dataset=dataset),
    ]

# Get default tools description (this will be updated per-request in supervisor_stream)
default_tools = get_tools_list()
tools_description = "\n".join(f"- {tool.name}: {tool.description}" for tool in default_tools)

system_prompt = """
You are a supervisor of a worker network.
You are given a task and a list of workers.

If the task is fully completed, you should return the result.
If more steps are required, you should call the appropriate tool with the appropriate arguments.

If asked about what medications are used to treat delirium, you always say:
Haloperidol 
Risperidone
Quetiapine
Olanzapine
Aripiprazole
Dexmedetomidine
Clonidine

DO NOT SAY ANYTHING AFTER THIS LIST.

If asked to highlight medications from the patient's chart, you always use the GetMedicationsIds tool and then respond with:
"The medications have been highlighted in the patient medications tab."

There is code that will understand how to perform the rest. You just need to let the user know that it has been done. 
DO NOT USE ANY TOOLS AFTER THAT. 



The tools you have available are:
{tools_description}
"""


def supervisor_stream(user_prompt: str, mrn: int = None, csn: int = None, dataset: str = None):
    print(f"[SUPERVISOR DEBUG] supervisor_stream called with prompt: {user_prompt}, dataset: {dataset}")
    
    client = OpenAI(api_key=api_key)
    model_name = "gpt-4o-2024-11-20"

    # Get tools with dataset context
    tools_list = get_tools_list(dataset)
    
    # Create a mapping of tool names to their instances
    tool_name_map = {tool.name: tool for tool in tools_list}
    
    # Convert tools to OpenAI function format
    tools = [tool.to_dict() for tool in tools_list]

    messages = [{"role": "user", "content": user_prompt}]

    print(f"[SUPERVISOR DEBUG] Starting processing loop...")
    while True:
        try:
            yield from publish_llm_thinking()
            response = client.responses.create(
                model=model_name,
                instructions=system_prompt,
                input=messages,
                tools=tools
            )
        except Exception as e:
            yield from publish_error("llm_call", str(e))
            break

        if response.output[0].type == "function_call":
            tool_call = response.output[0]
            try:
                args = json.loads(tool_call.arguments)
            except Exception as e:
                yield from publish_error(
                    "parsing_arguments", 
                    f"Failed to parse arguments: {str(e)}", 
                    tool_name=tool_call.name,
                    raw_args=tool_call.arguments
                )
                break

            # Get the tool instance and its category
            tool_instance = tool_name_map[tool_call.name]
            tool_category = tool_instance.category

            print(f"[SUPERVISOR DEBUG] Processing tool call: {tool_call.name}")
            print(f"[SUPERVISOR DEBUG] Tool arguments: {args}")

            # Check if this tool should emit data item events for processing highlights
            if should_use_data_item_events(tool_call.name):
                print(f"[SUPERVISOR DEBUG] Tool {tool_call.name} should use data item events")
                data_item = get_data_item_from_tool(tool_call.name, args)
                print(f"[SUPERVISOR DEBUG] Data item extracted: {data_item}")
                if data_item:
                    print(f"[SUPERVISOR DEBUG] Publishing tool_call with dataItem: {data_item}")
                    yield from publish_tool_call_with_data_item(
                        tool_call.name, 
                        args, 
                        data_item_type=data_item['type'],
                        data_item_id=data_item['id'],
                        status=data_item['status'],
                        category=tool_category
                    )
                else:
                    print(f"[SUPERVISOR DEBUG] No data item found, using regular publish_tool_call")
                    yield from publish_tool_call(tool_call.name, args, tool_category)
            else:
                print(f"[SUPERVISOR DEBUG] Tool {tool_call.name} does not use data item events")
                yield from publish_tool_call(tool_call.name, args, tool_category)

            try:
                # Convert raw arguments to Pydantic model
                input_model_class = get_input_model_for_tool(tool_call.name)
                validated_inputs = input_model_class(**args)
                result = tool_instance(validated_inputs)
            except Exception as e:
                yield from publish_error(
                    "tool_execution",
                    str(e),
                    tool_name=tool_call.name,
                    args=args
                )
                break

            # Special case: if this is HighlightPatientNote, return result immediately
            if tool_call.name == "highlight_patient_note":
                print(f"[SUPERVISOR DEBUG] HighlightPatientNote called, returning result directly")
                print(f"Highlight result: {result}")
                chat_result = {
                    "mrn": mrn or 2075253,
                    "csn": csn or 18303177,
                    "flags": {},
                    "workflow_type": "highlight_analysis",
                    "status": "completed",
                    "chat_response": result[0]
                }
                yield from publish_final_result(chat_result)
                break

            # Publish tool result with data item info if applicable
            if should_use_data_item_events(tool_call.name):
                data_item = get_data_item_from_tool(tool_call.name, args)
                print(f"[SUPERVISOR DEBUG] Publishing tool result for {tool_call.name}, data_item: {data_item}")
                if data_item:
                    print(f"[SUPERVISOR DEBUG] Publishing tool_result with dataItem: {data_item}")
                    yield from publish_tool_result_with_data_item(
                        tool_call.name, 
                        result, 
                        data_item_type=data_item['type'],
                        data_item_id=data_item['id'],
                        status='completed',
                        category=tool_category
                    )
                else:
                    print(f"[SUPERVISOR DEBUG] No data item for result, using regular publish_tool_result")
                    yield from publish_tool_result(tool_call.name, result, tool_category)
            else:
                print(f"[SUPERVISOR DEBUG] Tool {tool_call.name} does not use data item events for result")
                yield from publish_tool_result(tool_call.name, result, tool_category)

            messages.append({"role": "assistant", "content": f'<tool_call>{tool_call.name}</tool_call><tool_args>{args}</tool_args>'})
            messages.append({"role": "assistant", "content": f'<tool_result>{result}</tool_result>'})
            messages.append({"role": "user", "content": "Please continue with the next step. If you need to make another tool call, do so."})
        else:
            print("Final response received.")
            pprint(response.output[0].content[0].text)
            
            # Use provided MRN/CSN or defaults
            if mrn is None:
                mrn = 2075253  # Default for now
            if csn is None:
                csn = 18303177  # Default for now
            
            # Initialize flags similar to process workflow
            flags = {
                "treatment_medications": {
                    "state": False, 
                    "medications": ["haloperidol", "risperidone", "quetiapine", "olanzapine", "aripiprazole", "dexmedetomidine", "clonidine"], 
                    "sources": []
                }
            }

            if 'the medications' in user_prompt:
                # Check medications using the same logic as process workflow
                print('[SUPERVISOR DEBUG] User prompt indicates medication check is needed.')
                yield from check_medications_for_chat(flags, mrn, csn, dataset)

            # Create structured result
            chat_result = {
                "mrn": mrn,
                "csn": csn,
                "flags": flags,
                "workflow_type": "chat_analysis",
                "status": "completed",
                "chat_response": response.output[0].content[0].text
            }
            
            yield from publish_final_result(chat_result)
            break

def check_medications_for_chat(flags, mrn, csn, dataset=None):
    """Check patient medications against treatment medications with streaming events for chat workflow"""
    medications_to_check = flags["treatment_medications"]["medications"]
    
    try:
        # Get all medication IDs with dataset context
        # yield from publish_tool_call_with_data_item(
        #     "get_medications_ids",
        #     {"mrn": mrn, "csn": csn},
        #     data_item_type="medications",
        #     data_item_id="all",
        #     status="loading",
        #     category="medications"
        # )
        
        medications_ids = GetMedicationsIds(dataset=dataset)(inputs=GetMedicationsIdsInput(mrn=mrn, csn=csn))
        
        yield from publish_tool_result_with_data_item(
            "get_medications_ids",
            {"count": len(medications_ids)},
            data_item_type="medications", 
            data_item_id="all",
            status="loaded",
            category="medications"
        )
        
        # Process each medication
        for medication_id in medications_ids:
            try:
                # Read medication
                # yield from publish_tool_call_with_data_item(
                #     "read_medication",
                #     {"mrn": mrn, "csn": csn, "order_id": medication_id},
                #     data_item_type="medications",
                #     data_item_id=medication_id,
                #     status="reading",
                #     category="medications"
                # )
                
                medication_json_string = ReadMedication(dataset=dataset)(inputs=ReadMedicationInput(mrn=mrn, csn=csn, order_id=medication_id))
                medication_dict = json.loads(medication_json_string)
                
                # yield from publish_tool_result_with_data_item(
                #     "read_medication",
                #     {"medication_name": medication_dict.get('medication_name', 'N/A')},
                #     data_item_type="medications",
                #     data_item_id=medication_id,
                #     status="checking",
                #     category="medications"
                # )

                # Check medication against target list
                # yield from publish_tool_call_with_data_item(
                #     "check_medication_match",
                #     {"medication_id": medication_id, "targets": medications_to_check},
                #     data_item_type="medications",
                #     data_item_id=medication_id,
                #     status="checking",
                #     category="medications"
                # )
                
                # Check if medication name or simple generic name matches any in medications_to_check
                medication_name = str(medication_dict.get('medication_name', '')).lower()
                simple_generic_name = str(medication_dict.get('simple_generic_name', '')).lower()
                
                # Skip if both names are nan
                if medication_name == 'nan' and simple_generic_name == 'nan':
                    # yield from publish_tool_result_with_data_item(
                    #     "check_medication_match",
                    #     {"match_found": False, "reason": "No valid medication name"},
                    #     data_item_type="medications",
                    #     data_item_id=medication_id,
                    #     status="completed",
                    #     category="medications"
                    # )
                    continue
                    
                # Convert 'nan' to empty string for comparison
                medication_name = '' if medication_name == 'nan' else medication_name
                simple_generic_name = '' if simple_generic_name == 'nan' else simple_generic_name
                
                match_found = False
                for med_to_check in medications_to_check:
                    if med_to_check.lower() in medication_name or med_to_check.lower() in simple_generic_name:
                        print(f"Found matching medication: {medication_dict.get('medication_name', 'N/A')}")
                        flags["treatment_medications"]["state"] = True
                        flags["treatment_medications"]["sources"].append({
                            "type": "medications",
                            "details": medication_dict
                        })
                        match_found = True
                        break
                
                yield from publish_tool_result_with_data_item(
                    "check_medication_match",
                    {"match_found": match_found, "medication_name": medication_dict.get('medication_name', 'N/A')},
                    data_item_type="medications",
                    data_item_id=medication_id,
                    status="completed",
                    category="medications"
                )
                
            except Exception as e:
                yield from publish_error(
                    "medication_processing", 
                    str(e), 
                    tool_name="read_medication",
                    args={"medication_id": medication_id}
                )
                
    except Exception as e:
        yield from publish_error(
            "medications_check",
            str(e),
            tool_name="get_medications_ids"
        )

def main(user_prompt: str = None, mrn: int = 0, csn: int = 0):
    """Test the supervisor_stream function with colored output."""
    print(f"{Colors.BOLD}{Colors.UNDERLINE}Testing Supervisor Stream{Colors.END}\n")

    # Use provided values or defaults
    if mrn == 0:
        mrn = 2044540
    if csn == 0:
        csn = 16337607

    # Use provided prompt or default
    if user_prompt is None:
        user_prompt = "Summarize the first patient note"
    
    # Append MRN and CSN to the prompt
    full_prompt = f"{user_prompt} from the patient with MRN {mrn} and CSN {csn}."

    try:
        for stream_output in supervisor_stream(full_prompt):
            try:
                # Parse the JSON output
                event_data = json.loads(stream_output.strip())
                print_colored_event(event_data)
            except json.JSONDecodeError as e:
                print(f"{Colors.RED}Error parsing JSON: {e}{Colors.END}")
                print(f"{Colors.RED}Raw output: {stream_output}{Colors.END}")
    
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Interrupted by user{Colors.END}")
    except Exception as e:
        print(f"{Colors.RED}Unexpected error: {e}{Colors.END}")

