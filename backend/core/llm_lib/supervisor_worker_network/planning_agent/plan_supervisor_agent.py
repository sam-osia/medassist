import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from typing import Dict, Any, Optional

from core.llm_lib.supervisor_worker_network.planning_agent.plan_generation_agent import GeneratePlan, GeneratePlanInput
from core.llm_lib.supervisor_worker_network.planning_agent.plan_editing_agent import EditPlan, EditPlanInput

load_dotenv()

def get_input_model_for_tool(tool_name: str):
    """Map tool names to their corresponding Pydantic input model classes."""
    input_model_map = {
        "generate_plan": GeneratePlanInput,
        "edit_plan": EditPlanInput,
    }
    
    if tool_name not in input_model_map:
        raise ValueError(f"No input model found for tool: {tool_name}")
    
    return input_model_map[tool_name]

def get_planning_tools_list(dataset: str = None):
    """Initialize planning tools with dataset context."""
    return [
        GeneratePlan(dataset=dataset),
        EditPlan(dataset=dataset),
    ]

# System prompt for the conversational planning agent
planning_system_prompt = """
You are a planning assistant that can help with both conversation and plan generation.

Available tools:
- generate_plan(prompt, mrn, csn): Creates a structured execution plan for medical data analysis tasks. 
  NOTE: MRN and CSN are ALWAYS set to 0 during planning as placeholders. The workflow executor will replace 
  these with actual patient data values at execution time.
- edit_plan(existing_plan, edit_request): Modifies an existing plan based on user feedback or change requests.
  IMPORTANT: You MUST extract the existing_plan from the conversation history. Look for JSON plan objects in 
  previous assistant messages. The existing_plan parameter must be the complete plan object (dict), not a string.

Plan Versioning:
When you generate or edit a plan, it will be saved in the conversation as plan_v1, plan_v2, etc. You can see previous plans in the conversation history and reference them naturally in your responses.

When to use the generate_plan tool:
- User explicitly asks for a new plan, steps, roadmap, or structured approach
- Task requires breaking down into actionable steps for medical data analysis
- User mentions "plan", "steps", "how to", "workflow", "process"
- User requests analysis of patient data that would benefit from a systematic approach
- No suitable plan exists in conversation history

When to use the edit_plan tool:
- User wants to modify, update, or change an existing plan (look for plan_v# in conversation)
- User provides feedback on a plan and requests changes
- User asks to add, remove, or modify steps in an existing plan
- User mentions editing, changing, updating, or improving a plan
- CRITICAL: When calling edit_plan, you MUST:
  1. Look through the conversation history for the most recent plan (it will be a JSON object in an assistant message)
  2. Extract the complete plan object from that message
  3. Pass it as the existing_plan parameter (as a dict/object, NOT as a string)
  4. Include the user's edit request as the edit_request parameter

When to respond conversationally:
- General questions about planning concepts
- Clarification requests about existing plans
- Explanations of planning methodology
- Casual conversation about medical planning
- Simple questions that don't require structured execution

If you use a planning tool, always explain the generated or modified plan in your final response and provide helpful context about how it can be used.
"""

def conversational_planning_agent(messages: list, mrn: int = 0, csn: int = 0, dataset: str = None) -> Dict[str, Any]:
    """
    Conversational planning agent that can respond with text or generate plans using chain-of-thought reasoning.

    Args:
        messages: Full conversation history in OpenAI format [{role: "user"|"assistant", content: "..."}]
        mrn: Medical Record Number (default 0 as placeholder for execution time)
        csn: CSN encounter ID (default 0 as placeholder for execution time)
        dataset: Dataset name (optional)

    Returns:
        Dict with response_type, text_response, and optional plan_data
    
    Note: MRN and CSN are placeholders during planning. They will be set by the workflow executor
          to actual values from the data at execution time.
    """
    print(f"[PLANNING AGENT DEBUG] Called with {len(messages)} messages, dataset: {dataset}")
    
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)
    model_name = "gpt-4o-2024-11-20"

    # Get planning tools with dataset context
    tools_list = get_planning_tools_list(dataset)
    
    # Create a mapping of tool names to their instances
    tool_name_map = {tool.name: tool for tool in tools_list}
    
    # Convert tools to OpenAI function format
    tools = [tool.to_dict() for tool in tools_list]

    # Messages already contain full conversation history from API
    plan_data = None

    print(f"[PLANNING AGENT DEBUG] Starting chain-of-thought processing...")
    
    while True:
        try:
            print(f"[PLANNING AGENT DEBUG] Making LLM call with {len(messages)} messages")
            response = client.responses.create(
                model=model_name,
                instructions=planning_system_prompt,
                input=messages,
                tools=tools
            )
        except Exception as e:
            print(f"[PLANNING AGENT DEBUG] LLM call failed: {e}")
            return {
                "response_type": "text",
                "text_response": f"I encountered an error: {str(e)}",
                "plan_data": None
            }

        if response.output[0].type == "function_call":
            # Agent decided to use the planning tool
            tool_call = response.output[0]
            print(f"[PLANNING AGENT DEBUG] Agent called tool: {tool_call.name}")
            try:
                args = json.loads(tool_call.arguments)
                print(f"[PLANNING AGENT DEBUG] Tool arguments: {args}")
            except Exception as e:
                print(f"[PLANNING AGENT DEBUG] Failed to parse tool arguments: {e}")
                return {
                    "response_type": "text", 
                    "text_response": f"I had trouble understanding the planning request: {str(e)}",
                    "plan_data": None
                }

            # Get the tool instance
            tool_instance = tool_name_map[tool_call.name]

            try:
                # Convert raw arguments to Pydantic model and execute tool
                input_model_class = get_input_model_for_tool(tool_call.name)

                validated_inputs = input_model_class(**args)
                result = tool_instance(validated_inputs)
                plan_data = result
                print(f"[PLANNING AGENT DEBUG] Tool execution successful")
                
            except Exception as e:
                print(f"[PLANNING AGENT DEBUG] Tool execution failed: {e}")
                return {
                    "response_type": "text",
                    "text_response": f"I encountered an error while generating the plan: {str(e)}",
                    "plan_data": None
                }

            # Add tool call and result to conversation history
            messages.append({
                "role": "assistant", 
                "content": f'<tool_call>{tool_call.name}</tool_call><tool_args>{args}</tool_args>'
            })
            messages.append({
                "role": "assistant", 
                "content": f'<tool_result>{result}</tool_result>'
            })
            messages.append({
                "role": "user", 
                "content": "Provide your final response with a very brief summary of the plan."
            })
            
        else:
            # Agent provided final text response - conversation complete
            print("[PLANNING AGENT DEBUG] Agent provided final text response")
            final_text = response.output[0].content[0].text

            # Determine response type based on whether planning tool was used
            response_type = "plan" if plan_data else "text"

            return {
                "response_type": response_type,
                "text_response": final_text,
                "plan_data": plan_data
            }

def main(user_prompt: str = None, mrn: int = None, csn: int = None):
    """Test the conversational planning agent."""
    print("Testing Conversational Planning Agent\n")

    # Use provided values or defaults (0 for planning phase)
    if mrn is None:
        mrn = 0
    if csn is None:
        csn = 0

    # Use provided prompt or default
    if user_prompt is None:
        user_prompt = "Can you create a plan to analyze the patient's mental health status from their medical records?"

    print(f"User Prompt: {user_prompt}")
    print(f"MRN: {mrn}, CSN: {csn}\n")

    try:
        # Convert user prompt to messages format
        messages = [{"role": "user", "content": user_prompt}]
        result = conversational_planning_agent(messages, mrn, csn)
        
        print("=== RESULT ===")
        print(f"Response Type: {result['response_type']}")
        print(f"Text Response: {result['text_response']}")
        
        if result['plan_data']:
            print("\n=== PLAN DATA ===")
            print(f"Raw Plan:\n{json.dumps(result['plan_data']['raw_plan'], indent=2)}")
        
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"Unexpected error: {e}")

if __name__ == "__main__":
    main()