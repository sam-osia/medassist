"""Unified LLM Provider Library.

This library provides a consistent interface for making LLM calls across
multiple providers (OpenAI, Anthropic, Google).

Main Functions:
    - call(): Standard completion call
    - call_structured(): Structured output with Pydantic models
    - call_with_tools(): Function/tool calling support

Example Usage:
    >>> from core.llm_provider import call, call_structured, call_with_tools, ToolDefinition
    >>>
    >>> # Simple call
    >>> result = call(model="gpt-4o", messages=[{"role": "user", "content": "Hello!"}])
    >>> print(result.content)
    >>>
    >>> # Structured output
    >>> from pydantic import BaseModel
    >>> class Person(BaseModel):
    ...     name: str
    ...     age: int
    >>> result = call_structured(model="gpt-4o", messages=[...], schema=Person)
    >>> print(result.parsed.name)
    >>>
    >>> # Tool calling
    >>> tools = [ToolDefinition(name="get_time", description="...", parameters={...})]
    >>> result = call_with_tools(model="gpt-4o", messages=[...], tools=tools)
    >>> if result.has_tool_calls:
    ...     for tc in result.tool_calls:
    ...         print(tc.name, tc.arguments)
"""

from .client import call, call_structured, call_with_tools
from .result import LLMResult, ToolCall, ToolResult, StreamChunk
from .registry import (
    MODELS,
    ModelConfig,
    get_model,
    get_models,
    get_models_by_provider,
    get_model_names,
    calculate_cost,
)
from .providers.base import ToolDefinition

__all__ = [
    # Main functions
    "call",
    "call_structured",
    "call_with_tools",
    # Result types
    "LLMResult",
    "ToolCall",
    "ToolResult",
    "StreamChunk",
    "ToolDefinition",
    # Registry
    "MODELS",
    "ModelConfig",
    "get_model",
    "get_models",
    "get_models_by_provider",
    "get_model_names",
    "calculate_cost",
]
