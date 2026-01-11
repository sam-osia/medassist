"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Type, Union

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
    ) -> ProviderResponse:
        """Make a standard completion call.

        Args:
            model_id: The provider-specific model ID
            messages: List of messages in OpenAI format [{"role": "user", "content": "..."}]
            system: Optional system prompt
            temperature: Sampling temperature (0.0 - 2.0)
            max_tokens: Maximum tokens in response

        Returns:
            ProviderResponse with content and token counts
        """
        pass

    @abstractmethod
    def call_structured(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        schema: Type[BaseModel],
        system: Optional[str] = None,
        temperature: float = 1.0,
        max_tokens: int = 8192,
    ) -> ProviderResponse:
        """Make a structured output call.

        Args:
            model_id: The provider-specific model ID
            messages: List of messages
            schema: Pydantic model class for response structure
            system: Optional system prompt
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response

        Returns:
            ProviderResponse with .parsed containing the Pydantic model instance
        """
        pass

    @abstractmethod
    def call_with_tools(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        tools: List[ToolDefinition],
        system: Optional[str] = None,
        temperature: float = 1.0,
        max_tokens: int = 8192,
        tool_choice: Union[str, Dict[str, Any]] = "auto",
    ) -> ProviderResponse:
        """Make a call with tool/function calling support.

        Args:
            model_id: The provider-specific model ID
            messages: List of messages
            tools: List of ToolDefinition objects
            system: Optional system prompt
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            tool_choice: Tool selection mode ("auto", "required", "none", or specific tool)

        Returns:
            ProviderResponse with .tool_calls if the model wants to call tools
        """
        pass
