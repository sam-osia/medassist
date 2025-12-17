import sys
import argparse
sys.path.append('../')

from core.llm_lib.supervisor_worker_network.agents.supervisor import main as supervisor_main


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test supervisor with custom prompt")
    parser.add_argument("--prompt", type=str, help="User prompt for the supervisor")
    args = parser.parse_args()
    
    supervisor_main(args.prompt)