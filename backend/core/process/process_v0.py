from openai import OpenAI
from dotenv import load_dotenv
import os
import json

from core.workflow.tools.notes import (
    GetPatientNotesIds, ReadPatientNote,
    SummarizePatientNote, HighlightPatientNote, KeywordCount)
from core.workflow.tools.flowsheets import (
    ReadFlowsheetsTable, SummarizeFlowsheetsTable)
from core.workflow.schemas.tool_inputs import (
    GetPatientNotesIdsInput, ReadPatientNoteInput, SummarizePatientNoteInput,
    HighlightPatientNoteInput, KeywordCountInput)

from pydantic import BaseModel


def main():
    load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY")

    client = OpenAI(api_key=api_key)
    model_name = "gpt-4o-2024-11-20"

    # load the file with the note keywords
    with open("../prompts/notes/note_keywords.txt", "r") as f:
        note_keywords = f.read()


    patients = [{"mrn": 2075253, "csn": 18303177}, 
                ]

    for patient in patients:
        mrn = patient["mrn"]
        csn = patient["csn"]
        
        # NOTES 
        note_ids = GetPatientNotesIds()(inputs=GetPatientNotesIdsInput(mrn=mrn, csn=csn))
        for note_id in note_ids:
            note_json_string = ReadPatientNote()(ReadPatientNoteInput(mrn=mrn, csn=csn, note_id=note_id))
            note_dict = json.loads(note_json_string)  # Parse JSON string back to dictionary
            note_text = note_dict['note_text']
            
            keyword_count = KeywordCount()(KeywordCountInput(text=note_text, keywords=note_keywords))
            print('original note:')
            print(note_text)
            print()
            print(f'keyword count: {keyword_count.count}')
            print(keyword_count.formatted_text)
            print()
            print("--------------------------------")
            print()
                 


if __name__ == "__main__":
    main()
