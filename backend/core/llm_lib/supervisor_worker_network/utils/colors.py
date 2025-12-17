# ANSI color codes for terminal output
class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'  # End color

def print_colored_event(event_data):
    """Print supervisor stream events with different colors based on event type."""
    event_type = event_data.get("event", "unknown")
    
    if event_type == "llm_thinking":
        print(f"{Colors.BLUE}🤔 deLLiriuM is thinking...{Colors.END}")
    
    elif event_type == "tool_call":
        tool_name = event_data.get("tool_name", "unknown")
        args = event_data.get("args", {})
        print(f"{Colors.YELLOW}🔧 TOOL CALL: {Colors.BOLD}{tool_name}{Colors.END}")
        print(f"{Colors.YELLOW}   Arguments: {args}{Colors.END}")
    
    elif event_type == "tool_result":
        tool_name = event_data.get("tool_name", "unknown")
        result = event_data.get("result", "N/A")
        print(f"{Colors.CYAN}✅ TOOL RESULT from {Colors.BOLD}{tool_name}{Colors.END}")
        # Truncate long results for readability
        if isinstance(result, str) and len(result) > 200:
            print(f"{Colors.CYAN}   Result: {result[:200]}...{Colors.END}")
        else:
            print(f"{Colors.CYAN}   Result: {result}{Colors.END}")
    
    elif event_type == "final_result":
        content = event_data.get("content", "N/A")
        print(f"{Colors.BOLD}{Colors.GREEN}🎯 FINAL RESULT:{Colors.END}")
        print(f"{Colors.WHITE}{content}{Colors.END}")
        print("=" * 80)
    
    elif event_type == "error":
        stage = event_data.get("stage", "unknown")
        message = event_data.get("message", "N/A")
        print(f"{Colors.BOLD}{Colors.RED}❌ ERROR at {stage}:{Colors.END}")
        print(f"{Colors.RED}   Message: {message}{Colors.END}")
        if "tool_name" in event_data:
            print(f"{Colors.RED}   Tool: {event_data['tool_name']}{Colors.END}")
        if "args" in event_data:
            print(f"{Colors.RED}   Args: {event_data['args']}{Colors.END}")
    
    else:
        print(f"{Colors.PURPLE}❓ Unknown event: {event_type} - {event_data}{Colors.END}")
    
    print()  # Add spacing between events

__all__ = ["Colors", "print_colored_event"]