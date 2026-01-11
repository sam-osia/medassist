"""Main client orchestration layer for LLM provider library."""

from typing import Any, Dict, List, Optional, Type, Union

from pydantic import BaseModel

from .registry import MODELS, get_model, calculate_cost, ModelConfig
from .result import LLMResult, ToolCall, ToolResult
from .providers.base import BaseProvider, ToolDefinition
from .providers.openai_provider import OpenAIProvider
from .providers.anthropic_provider import AnthropicProvider
from .providers.google_provider import GoogleProvider


# Singleton provider instances (lazy initialized)
_providers: Dict[str, BaseProvider] = {}


def _get_provider(name: str) -> BaseProvider:
    """Get or create provider instance."""
    if name not in _providers:
        if name == "openai":
            _providers[name] = OpenAIProvider()
        elif name == "anthropic":
            _providers[name] = AnthropicProvider()
        elif name == "google":
            _providers[name] = GoogleProvider()
        else:
            raise ValueError(f"Unknown provider: {name}")
    return _providers[name]


def call(
    model: str,
    messages: List[Dict[str, str]],
    system: Optional[str] = None,
    temperature: float = 1.0,
    max_tokens: int = 8192,
) -> LLMResult:
    """Make a standard LLM completion call.

    Args:
        model: Friendly model name (e.g., "gpt-4o", "claude-sonnet", "gemini-1.5-pro")
        messages: List of messages in OpenAI format [{"role": "user", "content": "..."}]
        system: Optional system prompt
        temperature: Sampling temperature (0.0 - 2.0)
        max_tokens: Maximum tokens in response (default: 8192)

    Returns:
        LLMResult with content, token counts, and cost

    Raises:
        ValueError: If model name is not found in registry

    Example:
        >>> result = call(
        ...     model="gpt-4o",
        ...     messages=[{"role": "user", "content": "Hello!"}],
        ...     system="You are a helpful assistant.",
        ... )
        >>> print(result.content)
        >>> print(f"Cost: ${result.cost:.6f}")
    """
    config = get_model(model)
    provider = _get_provider(config.provider)

    response = provider.call(
        model_id=config.id,
        messages=messages,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    cost = calculate_cost(response.input_tokens, response.output_tokens, config)

    return LLMResult(
        content=response.content,
        model=model,
        provider=config.provider,
        input_tokens=response.input_tokens,
        output_tokens=response.output_tokens,
        cost=cost,
        raw_response=response.raw_response,
    )


def call_structured(
    model: str,
    messages: List[Dict[str, str]],
    schema: Type[BaseModel],
    system: Optional[str] = None,
    temperature: float = 1.0,
    max_tokens: int = 8192,
) -> LLMResult:
    """Make a structured output LLM call.

    Args:
        model: Friendly model name
        messages: List of messages
        schema: Pydantic model class for response structure
        system: Optional system prompt
        temperature: Sampling temperature
        max_tokens: Maximum tokens in response (default: 8192)

    Returns:
        LLMResult with .parsed containing the Pydantic model instance

    Raises:
        ValueError: If model doesn't support structured output

    Example:
        >>> class Person(BaseModel):
        ...     name: str
        ...     age: int
        >>> result = call_structured(
        ...     model="gpt-4o",
        ...     messages=[{"role": "user", "content": "John is 30 years old"}],
        ...     schema=Person,
        ... )
        >>> print(result.parsed.name, result.parsed.age)
    """
    config = get_model(model)

    if not config.supports_structured:
        raise ValueError(f"Model '{model}' does not support structured output")

    provider = _get_provider(config.provider)

    response = provider.call_structured(
        model_id=config.id,
        messages=messages,
        schema=schema,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    cost = calculate_cost(response.input_tokens, response.output_tokens, config)

    return LLMResult(
        content=response.content,
        parsed=response.parsed,
        model=model,
        provider=config.provider,
        input_tokens=response.input_tokens,
        output_tokens=response.output_tokens,
        cost=cost,
        raw_response=response.raw_response,
    )


def call_with_tools(
    model: str,
    messages: List[Dict[str, str]],
    tools: List[ToolDefinition],
    system: Optional[str] = None,
    temperature: float = 1.0,
    max_tokens: int = 8192,
    tool_choice: Union[str, Dict[str, Any]] = "auto",
) -> LLMResult:
    """Make an LLM call with tool/function calling support.

    Args:
        model: Friendly model name
        messages: List of messages
        tools: List of ToolDefinition objects defining available tools
        system: Optional system prompt
        temperature: Sampling temperature
        max_tokens: Maximum tokens in response (default: 8192)
        tool_choice: Tool selection mode:
            - "auto": Model decides whether to call tools (default)
            - "required": Model must call at least one tool
            - "none": Model should not call any tools
            - "<function_name>": Force calling a specific function

    Returns:
        LLMResult with .tool_calls if the model wants to call tools,
        or .content if the model responded with text

    Raises:
        ValueError: If model doesn't support tool calling

    Example:
        >>> tools = [
        ...     ToolDefinition(
        ...         name="get_weather",
        ...         description="Get weather for a location",
        ...         parameters={
        ...             "type": "object",
        ...             "properties": {
        ...                 "location": {"type": "string"}
        ...             },
        ...             "required": ["location"]
        ...         }
        ...     )
        ... ]
        >>> result = call_with_tools(
        ...     model="gpt-4o",
        ...     messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
        ...     tools=tools,
        ... )
        >>> if result.has_tool_calls:
        ...     for tc in result.tool_calls:
        ...         print(f"Call {tc.name} with {tc.arguments}")
    """
    config = get_model(model)

    if not config.supports_tools:
        raise ValueError(f"Model '{model}' does not support tool calling")

    provider = _get_provider(config.provider)

    response = provider.call_with_tools(
        model_id=config.id,
        messages=messages,
        tools=tools,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
        tool_choice=tool_choice,
    )

    cost = calculate_cost(response.input_tokens, response.output_tokens, config)

    return LLMResult(
        content=response.content,
        model=model,
        provider=config.provider,
        input_tokens=response.input_tokens,
        output_tokens=response.output_tokens,
        cost=cost,
        tool_calls=response.tool_calls,
        raw_response=response.raw_response,
    )
