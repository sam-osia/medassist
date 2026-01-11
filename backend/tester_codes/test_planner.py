"""Test the Conversational Planning Agent

Runs the planning agent with user-provided prompt:
- MRN: 0 (placeholder for planning)
- CSN: 0 (placeholder for planning)
- Prompt: User enters prompt when running the script

Usage:
    python test_planner.py                    # Interactive mode
    python test_planner.py --full-test        # Run full test workflow
    python test_planner.py --edit-only        # Test editing only

The agent will:
1. Accept a user prompt
2. Decide whether to generate a plan or respond conversationally
3. Use chain-of-thought reasoning to select appropriate tools
4. Return structured plan or text response
5. Support plan editing for iterative refinement
"""
import sys
import json
sys.path.append('../')

from core.llm_lib.supervisor_worker_network.planning_agent.plan_supervisor_agent import conversational_planning_agent


def test_plan_generation():
    """Test generating a new plan."""
    print("\n" + "="*60)
    print("TEST 1: Plan Generation")
    print("="*60)
    
    user_prompt = "Create a plan to analyze the patient's mental health status from their medical records."
    print(f"\nUser Prompt: {user_prompt}\n")
    
    messages = [{"role": "user", "content": user_prompt}]
    result = conversational_planning_agent(messages, mrn=0, csn=0)
    
    print("\n--- RESULT ---")
    print(f"Response Type: {result['response_type']}")
    print(f"Text Response: {result['text_response']}")
    
    if result['plan_data']:
        print("\n--- GENERATED PLAN ---")
        plan = result['plan_data']['raw_plan']
        print(json.dumps(plan, indent=2))
        return plan
    else:
        print("\nNo plan was generated.")
        return None


def test_plan_editing(existing_plan):
    """Test editing an existing plan."""
    print("\n" + "="*60)
    print("TEST 2: Plan Editing")
    print("="*60)
    
    if existing_plan is None:
        print("\nNo existing plan provided. Cannot test editing.")
        return None
    
    # Test editing by adding a new requirement
    edit_request = "Add a step to also check for any anxiety-related diagnoses before analyzing notes."
    print(f"\nEdit Request: {edit_request}\n")
    
    # Create a conversation history that includes the existing plan
    messages = [
        {"role": "user", "content": "Create a plan to analyze the patient's mental health status from their medical records."},
        {"role": "assistant", "content": f"Here's the plan (plan_v1):\n{json.dumps(existing_plan, indent=2)}"},
        {"role": "user", "content": edit_request}
    ]
    
    result = conversational_planning_agent(messages, mrn=0, csn=0)
    
    print("\n--- RESULT ---")
    print(f"Response Type: {result['response_type']}")
    print(f"Text Response: {result['text_response']}")
    
    if result['plan_data']:
        print("\n--- EDITED PLAN ---")
        edited_plan = result['plan_data']['raw_plan']
        print(json.dumps(edited_plan, indent=2))
        print("\n--- CHANGES SUMMARY ---")
        print(f"Original steps: {len(existing_plan.get('steps', []))}")
        print(f"Edited steps: {len(edited_plan.get('steps', []))}")
        return edited_plan
    else:
        print("\nNo edited plan was generated.")
        return None


def test_multi_edit(existing_plan):
    """Test multiple sequential edits."""
    print("\n" + "="*60)
    print("TEST 3: Multiple Sequential Edits")
    print("="*60)
    
    if existing_plan is None:
        print("\nNo existing plan provided. Cannot test multiple edits.")
        return None
    
    # First edit
    edit_1 = "Remove the summarization step and focus only on highlighting relevant content."
    print(f"\nFirst Edit Request: {edit_1}\n")
    
    messages = [
        {"role": "user", "content": "Create a mental health analysis plan."},
        {"role": "assistant", "content": f"plan_v1:\n{json.dumps(existing_plan, indent=2)}"},
        {"role": "user", "content": edit_1}
    ]
    
    result_1 = conversational_planning_agent(messages, mrn=0, csn=0)
    
    if result_1['plan_data']:
        print(f"Text Response: {result_1['text_response']}")
        plan_v2 = result_1['plan_data']['raw_plan']
        print(f"\nFirst edit completed. New step count: {len(plan_v2.get('steps', []))}")
        
        # Second edit
        edit_2 = "Add a final step to count keywords related to depression and anxiety."
        print(f"\nSecond Edit Request: {edit_2}\n")
        
        messages.extend([
            {"role": "assistant", "content": f"plan_v2:\n{json.dumps(plan_v2, indent=2)}"},
            {"role": "user", "content": edit_2}
        ])
        
        result_2 = conversational_planning_agent(messages, mrn=0, csn=0)
        
        if result_2['plan_data']:
            print(f"Text Response: {result_2['text_response']}")
            plan_v3 = result_2['plan_data']['raw_plan']
            print(f"\nSecond edit completed. Final step count: {len(plan_v3.get('steps', []))}")
            
            print("\n--- EDIT PROGRESSION ---")
            print(f"Original (v1): {len(existing_plan.get('steps', []))} steps")
            print(f"After Edit 1 (v2): {len(plan_v2.get('steps', []))} steps")
            print(f"After Edit 2 (v3): {len(plan_v3.get('steps', []))} steps")
            
            return plan_v3
    
    print("\nMultiple edits test incomplete.")
    return None


def run_full_test():
    """Run the complete test workflow: generation → editing → multiple edits."""
    print("\n" + "="*60)
    print("FULL PLANNING AGENT TEST SUITE")
    print("="*60)
    
    # Step 1: Generate initial plan
    initial_plan = test_plan_generation()
    
    if initial_plan:
        # Step 2: Edit the plan
        edited_plan = test_plan_editing(initial_plan)
        
        # Step 3: Multiple sequential edits
        if edited_plan:
            final_plan = test_multi_edit(edited_plan)
            
            print("\n" + "="*60)
            print("TEST SUITE COMPLETED SUCCESSFULLY")
            print("="*60)
        else:
            print("\n[WARNING] Editing test did not produce a plan.")
    else:
        print("\n[ERROR] Initial plan generation failed. Cannot proceed with editing tests.")


def run_edit_only_test():
    """Test editing with a sample plan."""
    print("\n" + "="*60)
    print("EDIT-ONLY TEST MODE")
    print("="*60)
    
    # Sample plan for editing
    sample_plan = {
        "steps": [
            {
                "id": "1",
                "type": "tool",
                "tool": "get_patient_notes_ids",
                "inputs": {"mrn": "{{mrn}}", "csn": "{{csn}}"},
                "output": "note_ids",
                "step_summary": "Retrieve all note IDs for the patient"
            },
            {
                "id": "2",
                "type": "tool",
                "tool": "read_patient_note",
                "inputs": {"note_id": "{{note_ids[0]}}"},
                "output": "note_content",
                "step_summary": "Read the first patient note"
            }
        ]
    }
    
    print("\n--- SAMPLE PLAN ---")
    print(json.dumps(sample_plan, indent=2))
    
    test_plan_editing(sample_plan)


def interactive_mode():
    """Interactive mode for custom testing."""
    print("\n" + "="*60)
    print("INTERACTIVE PLANNING AGENT TEST")
    print("="*60)
    print("\nMode Options:")
    print("1. Generate a new plan")
    print("2. Edit an existing plan (provide JSON)")
    print("3. Start a conversation")
    
    choice = input("\nSelect mode (1-3): ").strip()
    
    if choice == "1":
        print("\nEnter your planning request:")
        user_prompt = input("Prompt: ").strip()
        if user_prompt:
            messages = [{"role": "user", "content": user_prompt}]
            result = conversational_planning_agent(messages, mrn=0, csn=0)
            
            print("\n--- RESULT ---")
            print(f"Response Type: {result['response_type']}")
            print(f"Text Response: {result['text_response']}")
            
            if result['plan_data']:
                print("\n--- PLAN DATA ---")
                print(json.dumps(result['plan_data']['raw_plan'], indent=2))
        else:
            print("No prompt provided.")
    
    elif choice == "2":
        print("\nPaste your existing plan JSON (end with empty line):")
        lines = []
        while True:
            line = input()
            if not line:
                break
            lines.append(line)
        
        try:
            existing_plan = json.loads('\n'.join(lines))
            print("\nEnter your edit request:")
            edit_request = input("Edit: ").strip()
            
            if edit_request:
                test_plan_editing(existing_plan)
            else:
                print("No edit request provided.")
        except json.JSONDecodeError:
            print("Invalid JSON format.")
    
    elif choice == "3":
        print("\nEnter your message:")
        user_prompt = input("Prompt: ").strip()
        if user_prompt:
            messages = [{"role": "user", "content": user_prompt}]
            result = conversational_planning_agent(messages, mrn=0, csn=0)
            
            print("\n--- RESULT ---")
            print(f"Response Type: {result['response_type']}")
            print(f"Text Response: {result['text_response']}")
    else:
        print("Invalid choice.")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "--full-test":
            run_full_test()
        elif sys.argv[1] == "--edit-only":
            run_edit_only_test()
        else:
            print(f"Unknown option: {sys.argv[1]}")
            print("Usage: python test_planner.py [--full-test | --edit-only]")
    else:
        interactive_mode()
