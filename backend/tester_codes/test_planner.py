import sys
sys.path.append('../')

from core.llm_lib.supervisor_worker_network.agents.planning_agent import main as planning_agent_main


if __name__ == "__main__":
    planning_agent_main()