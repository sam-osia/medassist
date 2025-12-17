import os

from core.llm_lib.supervisor_worker_network.planning_agent_2.plan_state import Blackboard
from core.llm_lib.supervisor_worker_network.planning_agent_2.plan_supervisor_agent import plan_supervisor_agent


def plan_orchestrator(blackboard: Blackboard):
    # First, call the supervisor
    result = plan_supervisor_agent(blackboard)
