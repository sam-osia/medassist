"""Test the Chain-of-Thought Supervisor Agent

Tests the supervisor agent that coordinates multiple worker agents using
chain-of-thought reasoning to break down complex medical analysis tasks.

Usage:
    python test_cot.py --prompt "Your custom prompt here"
    python test_cot.py  # Uses default prompt

The supervisor:
1. Analyzes the user's request
2. Breaks it down into sub-tasks
3. Coordinates worker agents to execute tasks
4. Synthesizes results into final response
"""
import sys
import argparse
sys.path.append('../')

from core.llm_lib.supervisor_worker_network.agents.supervisor import main as supervisor_main


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test supervisor with custom prompt")
    parser.add_argument("--prompt", type=str, help="User prompt for the supervisor")
    args = parser.parse_args()
    
    supervisor_main(args.prompt)