import json

sample_mrn = 2075253
sample_csn = 18303177

sample_patient_information = {
    "mrn": sample_mrn,
    "csn": sample_csn
}

example_task_1 = """
Summarize every patient note and every per‑note summary in a variable `note_summary`
"""

example_plan_1 = {
  "steps": [
    {
      "id": "get_note_ids_if",
      "type": "if",
      "condition": "True",
      "then": {
        "id": "get_note_ids",
        "type": "tool",
        "tool": "get_patient_notes_ids",
        "inputs": {
          "mrn": "{{mrn}}",
          "csn": "{{csn}}"
        },
        "output": "note_ids"
      }
    },
    {
      "id": "loop_notes_if",
      "type": "if",
      "condition": "{{note_ids}}",
      "then": {
        "id": "loop_summarise",
        "type": "loop",
        "for": "note_id",
        "in": "{{note_ids}}",
        "output_dict": "note_summary",
        "body": [
          {
            "id": "read_note",
            "type": "tool",
            "tool": "read_patient_note",
            "inputs": {
              "mrn": "{{mrn}}",
              "csn": "{{csn}}",
              "note_id": "{{note_id}}"
            },
            "output": "note_text"
          },
          {
            "id": "summarise_note",
            "type": "tool",
            "tool": "summarize_patient_note",
            "inputs": {
              "note": "{{note_text}}",
              "criteria": "general"
            },
            "output": "note_summary_item"
          },
          {
            "id": "store_summary",
            "type": "tool",
            "tool": "store_note_result",
            "inputs": {
              "mrn": "{{mrn}}",
              "csn": "{{csn}}",
              "note_id": "{{note_id}}",
              "result": "{{note_summary_item}}",
              "result_name": "note_summary"
            },
            "output": "store_success"
          }
        ]
      }
    }
  ]
}

example_task_2 = """
Summarize the first patient note. Then, read the summary and highlight any portion of the text that may indicate pediatric delirium as defined by the DSM-5. 
"""

example_plan_2 = {
  "steps": [
    {
      "id": "get_note_ids_if",
      "type": "if",
      "condition": {
        "type": "expression", 
        "expression": "True"
      },
      "then": {
        "id": "get_note_ids",
        "type": "tool",
        "tool": "get_patient_notes_ids",
        "inputs": {
          "mrn": "{{mrn}}",
          "csn": "{{csn}}"
        },
        "output": "note_ids"
      }
    },
    {
      "id": "check_notes_exist_if",
      "type": "if", 
      "condition": {
        "type": "comparison",
        "left": "len(note_ids)",
        "operator": ">",
        "right": 0
      },
      "then": {
        "id": "read_first_note",
        "type": "tool",
        "tool": "read_patient_note", 
        "inputs": {
          "mrn": "{{mrn}}",
          "csn": "{{csn}}",
          "note_id": "{{note_ids[0]}}"
        },
        "output": "first_note_text"
      }
    },
    {
      "id": "summarize_note_if",
      "type": "if",
      "condition": {
        "type": "expression",
        "expression": "{{first_note_text}}"
      },
      "then": {
        "id": "summarize_first_note",
        "type": "tool",
        "tool": "summarize_patient_note",
        "inputs": {
          "note": "{{first_note_text}}",
          "criteria": "general clinical summary"
        },
        "output": "note_summary"
      }
    },
    {
      "id": "highlight_delirium_if",
      "type": "if", 
      "condition": {
        "type": "expression",
        "expression": "{{note_summary}}"
      },
      "then": {
        "id": "highlight_delirium_indicators",
        "type": "tool",
        "tool": "highlight_patient_note",
        "inputs": {
          "note": "{{note_summary}}",
          "criteria": "pediatric delirium indicators as defined by DSM-5: altered consciousness, cognitive changes, attention deficits, disorganized thinking, perceptual disturbances, psychomotor changes, sleep-wake cycle disruption"
        },
        "output": "delirium_highlights"
      }
    }
  ]
}

combined_example_1 = {
    "task": example_task_1,
    "patient_information": sample_patient_information,
    "plan": example_plan_1
}

combined_example_2 = {
    "task": example_task_2,
    "patient_information": sample_patient_information,
    "plan": example_plan_2
}
