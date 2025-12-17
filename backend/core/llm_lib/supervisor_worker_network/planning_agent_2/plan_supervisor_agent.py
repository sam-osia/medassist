import os
from openai import OpenAI

from pydantic import BaseModel
from typing import Literal
from core.llm_lib.supervisor_worker_network.planning_agent_2.plan_state import Blackboard

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)
model_name = "gpt-4o-2024-11-20"


class SupervisorOutput:
    route: Literal["plan_generate", "plan_edit", "prompt_generate", "text_response"]
    task: str


def plan_supervisor_agent(blackboard: Blackboard):
    pass
