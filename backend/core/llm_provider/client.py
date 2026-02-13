"""Main client orchestration layer for LLM provider library."""

from typing import Any, Dict, Generator, List, Optional, Type, Union

from pydantic import BaseModel

from .registry import MODELS, get_model, calculate_cost, ModelConfig
from .result import LLMResult, ToolCall, ToolResult, StreamChunk
from .providers.base import BaseProvider, ToolDefinition, ProviderStreamChunk
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
    messages: List[Dict[str, str]],
    key_name: str,
    system: Optional[str] = None,
    temperature: float = 1.0,
    max_tokens: int = 8192,
    schema: Optional[Type[BaseModel]] = None,
    tools: Optional[List[ToolDefinition]] = None,
    tool_choice: str = "auto",
    stream: bool = False,
) -> Union[LLMResult, Generator[StreamChunk, None, LLMResult]]:
    """Unified LLM call with optional structured output, tools, and streaming.

    All LLM calls are identified by a managed key_name which resolves to
    the model, API key, and key identity for cost tracking.

    Args:
        messages: List of messages in OpenAI format [{"role": "user", "content": "..."}]
        key_name: Managed API key name (required). Resolves to model, API key, and identity.
        system: Optional system prompt
        temperature: Sampling temperature (0.0 - 2.0)
        max_tokens: Maximum tokens in response (default: 8192)
        schema: Optional Pydantic model for structured output
        tools: Optional list of ToolDefinition objects for tool calling
        tool_choice: Tool selection mode ("auto", "required", "none", or function name)
        stream: If True, return a generator yielding StreamChunk objects

    Returns:
        LLMResult for non-streaming calls, or Generator[StreamChunk] for streaming

    Raises:
        ValueError: If key_name not found or model doesn't support requested features
    """
    # Resolve managed API key
    from core.dataloaders.api_key_loader import get_key_by_name
    key_record = get_key_by_name(key_name)
    if not key_record:
        raise ValueError(f"API key '{key_name}' not found")
    model = key_record["model_name"]
    api_key = key_record["api_key"]
    resolved_key_name = key_record["key_name"]
    resolved_key_id = key_record["key_id"]

    config = get_model(model)

    # Capability checks
    if schema and not config.supports_structured:
        raise ValueError(f"Model '{model}' does not support structured output")
    if tools and not config.supports_tools:
        raise ValueError(f"Model '{model}' does not support tool calling")
    if schema and tools and not config.supports_structured_with_tools:
        raise ValueError(f"Model '{model}' does not support structured output with tools")

    provider = _get_provider(config.provider)

    if stream:
        return _stream_wrapper(
            provider, config, model, messages, system, temperature, max_tokens,
            schema, tools, tool_choice, api_key, resolved_key_name, resolved_key_id
        )

    # Non-streaming call
    response = provider.call(
        model_id=config.id,
        messages=messages,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
        schema=schema,
        tools=tools,
        tool_choice=tool_choice,
        stream=False,
        api_key=api_key,
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
        tool_calls=response.tool_calls,
        raw_response=response.raw_response,
        api_key_name=resolved_key_name,
        api_key_id=resolved_key_id,
    )


def _stream_wrapper(
    provider: BaseProvider,
    config: ModelConfig,
    model: str,
    messages: List[Dict[str, str]],
    system: Optional[str],
    temperature: float,
    max_tokens: int,
    schema: Optional[Type[BaseModel]],
    tools: Optional[List[ToolDefinition]],
    tool_choice: str,
    api_key: str,
    resolved_key_name: str,
    resolved_key_id: str,
) -> Generator[StreamChunk, None, LLMResult]:
    """Wrapper that yields StreamChunks and returns final LLMResult."""
    accumulated_content = ""
    final_input_tokens = 0
    final_output_tokens = 0
    final_tool_calls = None

    stream = provider.call(
        model_id=config.id,
        messages=messages,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
        schema=schema,
        tools=tools,
        tool_choice=tool_choice,
        stream=True,
        api_key=api_key,
    )

    for chunk in stream:
        accumulated_content += chunk.content

        if chunk.is_final:
            final_input_tokens = chunk.input_tokens or 0
            final_output_tokens = chunk.output_tokens or 0
            final_tool_calls = chunk.tool_calls

        yield StreamChunk(
            content=chunk.content,
            is_final=chunk.is_final,
            tool_calls=chunk.tool_calls,
            input_tokens=chunk.input_tokens,
            output_tokens=chunk.output_tokens,
        )

    # Parse schema at end if provided
    parsed = None
    if schema and accumulated_content:
        try:
            parsed = schema.model_validate_json(accumulated_content)
        except Exception:
            pass  # Parsing failed, leave as None

    cost = calculate_cost(final_input_tokens, final_output_tokens, config)

    # Return final result (accessible via generator.value after StopIteration)
    return LLMResult(
        content=accumulated_content,
        parsed=parsed,
        model=model,
        provider=config.provider,
        input_tokens=final_input_tokens,
        output_tokens=final_output_tokens,
        cost=cost,
        tool_calls=final_tool_calls,
        raw_response=None,  # Not available in streaming
        api_key_name=resolved_key_name,
        api_key_id=resolved_key_id,
    )
