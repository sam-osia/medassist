import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.llm_lib.supervisor_worker_network.tools.registry import list_tools, get_tool
from core.llm_lib.supervisor_worker_network.tools.runner import run_tool

def verify_integration():
    print("--- Verifying Tool Discovery ---")
    tools = list_tools()
    print(f"Registered Tools: {tools}")
    
    if "filter_medication" in tools:
        print("SUCCESS: 'filter_medication' found in registry.")
    else:
        print("FAILURE: 'filter_medication' NOT found in registry.")
        return

    print("\n--- Verifying Tool Metadata ---")
    tool = get_tool("filter_medication")
    print(f"Tool Name: {tool.name}")
    print(f"Tool Description: {tool.description}")
    print(f"Tool Returns: {tool.returns}")

    print("\n--- Verifying Runner Validation (Dry Run) ---")
    # This will fail on LLM call or data fetching, but we want to see if validation passes
    inputs = {
        "mrn": 12345,
        "csn": 67890,
        "prompt": "Find meds with dose > 50"
    }
    
    # We expect 'no dataset found' or similar if we don't mock correctly, 
    # but we want to ensure the infrastructure (registry/runner) knows the tool.
    result = run_tool("filter_medication", inputs)
    print(f"Runner Result (OK?): {result.get('ok')}")
    if not result.get('ok'):
        print(f"Expected Error: {result.get('error')}")

if __name__ == "__main__":
    verify_integration()
