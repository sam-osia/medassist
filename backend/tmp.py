import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

MODEL_NAME = "gpt-4o-2024-11-20"

SYSTEM_PROMPT = """
Your job is to find delirium in clinical notes and only respond with true or false. 
"""

USER_PROMPT = """
Tell me if the following clinical note shows signs of delirium.

## Note
This patient is delirious. 
"""

response = client.responses.create(
    model=MODEL_NAME,
    instructions=SYSTEM_PROMPT,
    input="Tell me a three sentence bedtime story about a unicorn."
)
