"""Test the Process Execution Engine (V1)

Tests the plan execution system that runs structured plans generated
by the planning agent. Executes steps sequentially, manages variables,
and resolves dependencies.

Usage:
    python test_process.py

The process executor:
1. Loads a plan (steps with tools and inputs)
2. Executes each step in sequence
3. Manages variable context ({{variable}} references)
4. Handles errors and dependencies
5. Returns execution results
"""
import sys
sys.path.append('../')

from core.process.process_v1 import main

if __name__ == "__main__":
    main()