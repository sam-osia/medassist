"""Shared input types used across multiple tools and agents."""

from pydantic import BaseModel
from typing import Optional, List


class ExamplePair(BaseModel):
    user_input: str
    assistant_response: str

class PromptInput(BaseModel):
    system_prompt: str
    user_prompt: str
    examples: Optional[List[ExamplePair]] = None

class ModelInput(BaseModel):
    key_name: str
