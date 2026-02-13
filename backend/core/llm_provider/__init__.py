"""Unified LLM Provider Library.

This library provides a consistent interface for making LLM calls across
multiple providers (OpenAI, Anthropic, Google).

All calls require a managed key_name which resolves to the model,
API credentials, and key identity for cost tracking.

Example Usage:
    >>> from core.llm_provider import call, ToolDefinition
    >>>
    >>> # Simple call
    >>> result = call(messages=[{"role": "user", "content": "Hello!"}], key_name="my-key")
    >>> print(result.content)
    >>>
    >>> # Structured output
    >>> from pydantic import BaseModel
    >>> class Person(BaseModel):
    ...     name: str
    ...     age: int
    >>> result = call(messages=[...], key_name="my-key", schema=Person)
    >>> print(result.parsed.name)
    >>>
    >>> # Tool calling
    >>> tools = [ToolDefinition(name="get_time", description="...", parameters={...})]
    >>> result = call(messages=[...], key_name="my-key", tools=tools)
    >>> if result.has_tool_calls:
    ...     for tc in result.tool_calls:
    ...         print(tc.name, tc.arguments)
"""

from .client import call
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
    # Main function
    "call",
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
