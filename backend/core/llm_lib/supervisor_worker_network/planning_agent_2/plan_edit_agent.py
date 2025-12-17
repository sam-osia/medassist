from pydantic import BaseModel
from typing import Optional, Dict, Any
from core.llm_lib.supervisor_worker_network.schemas.plan_schema import Plan


class EditPlanInput(BaseModel):
    existing_plan: Plan
    edit_request: str
    selected_step_id: Optional[str] = None