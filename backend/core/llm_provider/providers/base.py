"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Generator, List, Optional, Type, Union

from pydantic import BaseModel

from ..result import ToolCall


@dataclass
class ToolDefinition:
    """Standardized tool definition (provider-agnostic).

    This format is converted to provider-specific formats by each provider.
    """
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema format


@dataclass
class ProviderResponse:
    """Standardized response from any provider.

    This is the internal response format returned by provider implementations.
    It is converted to LLMResult by the client layer.
    """
    content: str
    input_tokens: int
    output_tokens: int
    parsed: Optional[Any] = None
    tool_calls: Optional[List[ToolCall]] = None
    raw_response: Optional[Any] = None


@dataclass
class ProviderStreamChunk:
    """Internal streaming chunk from provider."""
    content: str                                  # Delta text content
    is_final: bool = False                        # True for the last chunk
    tool_calls: Optional[List[ToolCall]] = None   # Tool calls (usually in final chunk)
    input_tokens: Optional[int] = None            # Only populated in final chunk
    output_tokens: Optional[int] = None           # Only populated in final chunk


class BaseProvider(ABC):
    """Abstract base class for LLM providers.

    Each provider (OpenAI, Anthropic, Google) implements this interface
    to provide a consistent API across different LLM services.
    """

    @abstractmethod
    def call(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        temperature: float = 1.0,
        max_tokens: int = 8192,
        schema: Optional[Type[BaseModel]] = None,
        tools: Optional[List[ToolDefinition]] = None,
        tool_choice: Union[str, Dict[str, Any]] = "auto",
        stream: bool = False,
    ) -> Union[ProviderResponse, Generator[ProviderStreamChunk, None, None]]:
        """Unified call method with optional structured output, tools, and streaming.

        Args:
            model_id: The provider-specific model ID
            messages: List of messages in OpenAI format [{"role": "user", "content": "..."}]
            system: Optional system prompt
            temperature: Sampling temperature (0.0 - 2.0)
            max_tokens: Maximum tokens in response
            schema: Optional Pydantic model for structured output
            tools: Optional list of ToolDefinition objects for tool calling
            tool_choice: Tool selection mode ("auto", "required", "none", or specific tool)
            stream: If True, return a generator yielding ProviderStreamChunk

        Returns:
            ProviderResponse for non-streaming, or Generator[ProviderStreamChunk] for streaming
        """
        pass
