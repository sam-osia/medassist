import os
from dotenv import load_dotenv
load_dotenv()

from transformers import pipeline
import torch
from huggingface_hub import login
login(token=os.getenv("HUGGINGFACE_TOKEN"))


device = "cuda" if torch.cuda.is_available() else "cpu"
# Use the dedicated "image-text-to-text" pipeline so that text prompts – and, if
# MedGemma is a multimodal vision–language model.  
# desired later, images – are accepted in the chat‐style `messages` format.

pipe = pipeline(
    "image-text-to-text",
    model="google/medgemma-4b-it",
    torch_dtype=torch.bfloat16,
    device=device,
)

messages = [
    {
        "role": "system",
        "content": [
            {"type": "text", "text": "You are a helpful medical assistant."}
        ],
    },
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe how you would look for cases of pediatric delerium in a patient in the ICU based on their clinical notes, CAPD, medications and flowsheets. describe your approach in a step by step manner."}
        ],
    },
]

output = pipe(text=messages, max_new_tokens=20)
print(output[0]["generated_text"][-1]["content"])
