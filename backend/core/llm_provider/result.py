"""Result types for LLM provider library."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ToolCall:
    """Represents a tool/function call requested by the model."""
    id: str                      # Tool call ID (for feeding results back)
    name: str                    # Function/tool name
    arguments: Dict[str, Any]    # Parsed arguments


@dataclass
class ToolResult:
    """Result from executing a tool, to be fed back to the model."""
    tool_call_id: str
    content: str                 # Result to feed back to model


@dataclass
class StreamChunk:
    """A chunk of streamed response from an LLM."""
    content: str                                  # Delta text content
    is_final: bool = False                        # True for the last chunk
    tool_calls: Optional[List[ToolCall]] = None   # Tool calls (usually in final chunk)
    input_tokens: Optional[int] = None            # Only populated in final chunk
    output_tokens: Optional[int] = None           # Only populated in final chunk


@dataclass
class LLMResult:
    """Unified result from any LLM call."""
    content: str                                              # The text response
    model: str                                                # Friendly model name used
    provider: str                                             # "openai", "anthropic", "google"
    input_tokens: int                                         # Tokens in prompt
    output_tokens: int                                        # Tokens in response
    cost: float                                               # Calculated cost in USD
    parsed: Optional[Any] = None                              # For structured outputs
    tool_calls: Optional[List[ToolCall]] = None               # For tool calling
    raw_response: Optional[Any] = None                        # Original provider response

    @property
    def total_tokens(self) -> int:
        """Total tokens used (input + output)."""
        return self.input_tokens + self.output_tokens

    @property
    def has_tool_calls(self) -> bool:
        """Check if the response contains tool calls."""
        return self.tool_calls is not None and len(self.tool_calls) > 0
