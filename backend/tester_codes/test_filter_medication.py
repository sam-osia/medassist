import pandas as pd
import json
import os
import sys
from typing import List, Dict, Any, Optional

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the actual tool, input schema, and centralized table metadata
from core.llm_lib.supervisor_worker_network.tools.medications import FilterMedication
from core.llm_lib.supervisor_worker_network.schemas.tool_inputs import FilterMedicationInput
from core.llm_lib.supervisor_worker_network.schemas.table_schemas import MEDICATION_TABLE_SCHEMA
# Synthetic Dataset (mimics the structure of 'dataset.json')
SYNTHETIC_PATIENT_DATA = [
    {
        "mrn": 12345,
        "encounters": [
            {
                "csn": 67890,
                "medications": [
                    {
                        "order_id": 101,
                        "medication_name": "Acetaminophen",
                        "simple_generic_name": "Acetaminophen",
"dosage_order_amount": 500,
                        "dosage_order_unit": "mg",
                        "medication_route": "Oral",
                        "admin_action": "Given",
                        "order_datetime": "2026-01-10T08:00:00Z",
                        "dosage_given_amount": 500
                    },
                    {
                        "order_id": 102,
                        "medication_name": "Ibuprofen",
                        "simple_generic_name": "Ibuprofen",
                        "dosage_order_amount": 200,
                        "dosage_order_unit": "mg",
                        "medication_route": "Oral",
                        "admin_action": "Given",
                        "order_datetime": "2026-01-09T14:30:00Z",
                        "dosage_given_amount": 200
                    },
                    {
                        "order_id": 103,
                        "medication_name": "Amoxicillin",
                        "simple_generic_name": "Amoxicillin",
                        "dosage_order_amount": 250,
                        "dosage_order_unit": "mg",
                        "medication_route": "Oral",
                        "admin_action": "New Order",
                        "order_datetime": "2026-01-10T10:15:00Z",
                        "dosage_given_amount": None
                    },
                    {
                        "order_id": 104,
                        "medication_name": "Fentanyl",
                        "simple_generic_name": "Fentanyl",
                        "dosage_order_amount": 50,
                        "dosage_order_unit": "mcg",
                        "medication_route": "IV",
                        "admin_action": "Given",
                        "order_datetime": "2026-01-10T11:45:00Z",
                        "dosage_given_amount": 50
                    },
                    {
                        "order_id": 105,
                        "medication_name": "Sodium Chloride 0.9% (Normal Saline)",
                        "dosage_order_amount": 1000,
                        "dosage_order_unit": "mL",
                        "medication_route": "IV",
                        "admin_action": "Given",
                        "order_datetime": "2025-12-31T23:59:59Z", # Test year crossover
                        "dosage_given_amount": 0 # Test numeric 0
                    },
                    {
                        "order_id": 106,
                        "medication_name": "Dopamine",
                        "dosage_order_amount": 5,
                        "dosage_order_unit": "mcg/kg/min",
                        "medication_route": "IV",
                        "admin_action": "Given",
                        "order_datetime": "2026-01-10T12:00:00Z",
                        "dosage_given_amount": 4 # Test column comparison (given < ordered)
                    }
                ]
            }
        ]
    }
]

# Initialize the real tool
tool = FilterMedication()
# Inject synthetic data into the tool to avoid disk dependency
tool.dataset = SYNTHETIC_PATIENT_DATA

def test_tool_with_prompt(user_prompt: str):
    print(f"\n--- Testing Tool with Prompt: {user_prompt} ---")
    
    # Create input object
    tool_input = FilterMedicationInput(
        mrn=12345,
        csn=67890,
        prompt=user_prompt
    )
    
    try:
        # Call the actual __call__ method of the tool
        result = tool(tool_input)
        print(f"Tool Returned Order IDs: {result}")
        return result
    except Exception as e:
        print(f"Tool Execution failed: {e}")
        return None

if __name__ == "__main__":
    print(f"Current System Time set to: 2026-01-10")
    
    # 1. Complex Condition (Multiple groups)
    test_tool_with_prompt("Find Oral medications given in dose > 100 but not Ibuprofen")
    
    # 2. Date filtering (Stress test)
    test_tool_with_prompt("Show me medications ordered today (Jan 10, 2026)")
    
    # 3. Null handling logic
    test_tool_with_prompt("Find all medications that have not been given yet (dosage_given_amount is empty)")
    
    # 4. Logical negation and substring matching
    test_tool_with_prompt("Show me all medications except for those with IV route")
    
    # 5. Semantic overlap (Pain medications)
    test_tool_with_prompt("Medications used for pain (Ibuprofen, Acetaminophen, Fentanyl) with doses above 40")

    # 6. REGEX Test (Concentrations)
    test_tool_with_prompt("Find all Sodium Chloride with concentration 0.9%")

    # 7. Column-to-Column Comparison
    test_tool_with_prompt("Dose given less than the dose ordered")

    # 8. Prefix matching (Starts With)
    test_tool_with_prompt("Medications starting with 'A'")

    # 9. Year Crossover
    test_tool_with_prompt("Medications ordered in late 2025")

    # 10. Numeric 0 vs None
    test_tool_with_prompt("Find medications where the given amount is exactly 0")
