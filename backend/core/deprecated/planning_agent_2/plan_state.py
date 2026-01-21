from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Literal
from core.llm_lib.supervisor_worker_network.schemas.plan_schema import Plan

@dataclass
class Envelope:
    """Message passed between agents & supervisor"""
    sender: str
    recipient: str
    message: str
    plan_id: str | None = None

@dataclass
class Blackboard:
    """Shared state across agents"""
    task: str
    log: List[Envelope] = field(default_factory=list)

    def post(self, env: Envelope):
        self.log.append(env)

@dataclass
class PlanRecord:
    id: str
    plan: Plan
    summary: str