#!/usr/bin/env python3
"""
Interactive CLI for testing the multi-agent workflow system.
Usage: python tester_codes/workflow_cli.py [--dataset NAME] [--mrn NUM] [--csn NUM] [--debug]
"""
import sys
import json
import argparse
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.workflow.orchestrator import WorkflowOrchestrator
from core.workflow.state import WorkflowAgentState, ConversationEntry
from core.workflow.schemas.plan_schema import Plan as Workflow

# ANSI colors
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
DIM = "\033[2m"
RESET = "\033[0m"
BOLD = "\033[1m"


def print_agent_call(agent_name: str, task: str, result, verbose: bool):
    """Print agent call info."""
    # Format agent name
    agent_display = agent_name.replace("call_", "")
    print(f"  {YELLOW}> {agent_display}{RESET}", end="")

    if task:
        task_preview = task[:60] + "..." if len(task) > 60 else task
        print(f" - {DIM}{task_preview}{RESET}")
    else:
        print()

    if verbose and result:
        # Show abbreviated result
        if hasattr(result, 'model_dump'):
            data = result.model_dump()
            # Truncate workflow to avoid spam
            if 'workflow' in data and data['workflow']:
                steps = data['workflow'].get('steps', [])
                data['workflow'] = f"[{len(steps)} steps]"
            result_str = json.dumps(data, default=str)
            if len(result_str) > 200:
                result_str = result_str[:200] + "..."
            print(f"    {DIM}{result_str}{RESET}")
        else:
            print(f"    {DIM}{str(result)[:200]}{RESET}")


def save_state(state: WorkflowAgentState, filepath: str):
    """Save conversation state to JSON."""
    data = {
        "mrn": state.mrn,
        "csn": state.csn,
        "conversation": [
            {"role": e.role, "content": e.content, "workflow_ref": e.workflow_ref}
            for e in state.conversation
        ],
        "workflow_history": {
            k: v.model_dump() for k, v in state.workflow_history.items()
        },
        "current_workflow_id": state.current_workflow_id,
    }
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"{GREEN}State saved to {filepath}{RESET}")


def load_state(filepath: str) -> WorkflowAgentState:
    """Load conversation state from JSON."""
    with open(filepath, 'r') as f:
        data = json.load(f)

    state = WorkflowAgentState(mrn=data.get("mrn", 0), csn=data.get("csn", 0))
    state.conversation = [
        ConversationEntry(**e) for e in data.get("conversation", [])
    ]
    state.workflow_history = {
        k: Workflow.model_validate(v)
        for k, v in data.get("workflow_history", {}).items()
    }
    state.current_workflow_id = data.get("current_workflow_id")
    print(f"{GREEN}Loaded state from {filepath}{RESET}")
    return state


def print_help():
    """Print available commands."""
    print(f"""
{BOLD}Commands:{RESET}
  /save <file>   Save conversation state to file
  /load <file>   Load conversation state from file
  /state         Show current state summary
  /workflow      Show current workflow JSON
  /history       Show conversation history
  /clear         Clear conversation and start fresh
  /debug         Toggle debug mode
  /help          Show this help
  /quit          Exit the CLI
""")


def main():
    parser = argparse.ArgumentParser(description="Workflow Agent CLI")
    parser.add_argument("--dataset", default=None, help="Dataset name (e.g., delirium, sdoh)")
    parser.add_argument("--load", default=None, help="Load state from file")
    parser.add_argument("--mrn", type=int, default=12345, help="Patient MRN")
    parser.add_argument("--csn", type=int, default=67890, help="Encounter CSN")
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    args = parser.parse_args()

    # Setup logging based on debug flag
    if args.debug:
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(name)s - %(levelname)s - %(message)s'
        )
    else:
        logging.basicConfig(
            level=logging.INFO,
            format='%(name)s - %(levelname)s - %(message)s'
        )

    verbose = args.debug

    # Initialize state
    if args.load and Path(args.load).exists():
        state = load_state(args.load)
    else:
        state = WorkflowAgentState(mrn=args.mrn, csn=args.csn)

    orchestrator = WorkflowOrchestrator(dataset=args.dataset)

    print(f"\n{BOLD}Workflow Agent CLI{RESET}")
    print(f"Dataset: {args.dataset or 'default'}, MRN: {state.mrn}, CSN: {state.csn}")
    print(f"Type /help for commands\n")

    while True:
        try:
            user_input = input(f"{CYAN}You: {RESET}").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        # Handle commands
        if user_input.startswith("/"):
            parts = user_input.split(maxsplit=1)
            cmd = parts[0].lower()
            arg = parts[1] if len(parts) > 1 else None

            if cmd == "/quit" or cmd == "/q":
                print("Goodbye!")
                break
            elif cmd == "/help" or cmd == "/h":
                print_help()
            elif cmd == "/save" and arg:
                save_state(state, arg)
            elif cmd == "/load" and arg:
                if Path(arg).exists():
                    state = load_state(arg)
                else:
                    print(f"{RED}File not found: {arg}{RESET}")
            elif cmd == "/state":
                print(f"Conversation: {len(state.conversation)} messages")
                print(f"Workflows: {list(state.workflow_history.keys())}")
                print(f"Current workflow: {state.current_workflow_id}")
                print(f"Pending workflow: {'Yes' if state.pending_workflow else 'No'}")
            elif cmd == "/workflow":
                wf = state.get_current_workflow()
                if wf:
                    print(json.dumps(wf.model_dump(), indent=2))
                else:
                    print("No current workflow")
            elif cmd == "/history":
                for i, entry in enumerate(state.conversation):
                    role_color = CYAN if entry.role == "user" else GREEN
                    content_preview = entry.content[:100] + "..." if len(entry.content) > 100 else entry.content
                    print(f"{i+1}. {role_color}{entry.role}{RESET}: {content_preview}")
                    if entry.workflow_ref:
                        print(f"   {DIM}[{entry.workflow_ref}]{RESET}")
            elif cmd == "/clear":
                state = WorkflowAgentState(mrn=state.mrn, csn=state.csn)
                print(f"{GREEN}Conversation cleared{RESET}")
            elif cmd == "/debug":
                verbose = not verbose
                level = logging.DEBUG if verbose else logging.INFO
                logging.getLogger().setLevel(level)
                print(f"{GREEN}Debug mode: {'ON' if verbose else 'OFF'}{RESET}")
            else:
                print(f"{RED}Unknown command: {cmd}. Type /help for available commands.{RESET}")
            continue

        # Process message with tracing
        print(f"{DIM}Processing...{RESET}")

        try:
            result = orchestrator.process_message_with_trace(user_input, state, verbose=verbose)

            # Show trace
            for step in result.get("trace", []):
                print_agent_call(
                    step["agent"],
                    step.get("task", ""),
                    step.get("result"),
                    verbose
                )

            # Show response
            print()
            if result["response_type"] == "workflow":
                print(f"{GREEN}Assistant:{RESET} {result['text']}")
                print(f"{DIM}[Workflow returned: {result.get('workflow_id', 'unknown')}]{RESET}")
                if result.get("summary"):
                    print(f"{DIM}Summary: {result['summary']}{RESET}")
            else:
                print(f"{GREEN}Assistant:{RESET} {result['text']}")
            print()

        except Exception as e:
            print(f"{RED}Error: {e}{RESET}")
            if verbose:
                import traceback
                traceback.print_exc()


if __name__ == "__main__":
    main()
