from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")


from typing import List

from openai import OpenAI
from pydantic import BaseModel

class EntitiesModel(BaseModel):
    attributes: List[str]
    colors: List[str]
    animals: List[str]

client = OpenAI(api_key=api_key)

with client.responses.stream(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "Extract entities from the input text"},
        {
            "role": "user",
            "content": "The quick brown fox jumps over the lazy dog with piercing blue eyes",
        },
    ],
    text_format=EntitiesModel,
) as stream:
    for event in stream:
        if event.type == "response.refusal.delta":
            print(event.delta, end="")
        elif event.type == "response.output_text.delta":
            print(event.delta, end="", flush=True)
        elif event.type == "response.error":
            print(event.error, end="")
        elif event.type == "response.completed":
            print("\nCompleted")

    final_response = stream.get_final_response()
    parsed_data = final_response.output[0].content[0].parsed
    print(f"Parsed: {parsed_data}")