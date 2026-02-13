"""Anthropic Claude API provider implementation."""

import json
import os
from typing import Any, Dict, Generator, List, Optional, Type, Union

from anthropic import Anthropic
from dotenv import load_dotenv
from pydantic import BaseModel

from .base import BaseProvider, ProviderResponse, ProviderStreamChunk, ToolDefinition
from ..result import ToolCall

load_dotenv()


class AnthropicProvider(BaseProvider):
    """Anthropic Claude API provider."""

    def __init__(self):
        self._client: Optional[Anthropic] = None

    @property
    def client(self) -> Anthropic:
        """Lazy client initialization."""
        if self._client is None:
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY environment variable not set")
            self._client = Anthropic(api_key=api_key)
        return self._client

    def _convert_tools(self, tools: List[ToolDefinition]) -> List[Dict[str, Any]]:
        """Convert ToolDefinition to Anthropic format."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.parameters,
            }
            for tool in tools
        ]

    def _convert_tool_choice(
        self, tool_choice: Union[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Convert tool_choice to Anthropic format."""
        if isinstance(tool_choice, str):
            if tool_choice == "auto":
                return {"type": "auto"}
            elif tool_choice == "required":
                return {"type": "any"}
            elif tool_choice == "none":
                # Anthropic doesn't have "none" - we just don't pass tools
                return {"type": "auto"}
            else:
                # Assume it's a function name
                return {"type": "tool", "name": tool_choice}
        return tool_choice

    def _get_client(self, api_key: Optional[str] = None) -> Anthropic:
        """Get client - use override api_key if provided, otherwise default."""
        if api_key:
            return Anthropic(api_key=api_key)
        return self.client

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
        api_key: Optional[str] = None,
    ) -> Union[ProviderResponse, Generator[ProviderStreamChunk, None, None]]:
        """Unified call method with optional structured output, tools, and streaming."""
        client = self._get_client(api_key)

        if stream:
            return self._call_stream(
                model_id, messages, system, temperature, max_tokens, schema, tools, tool_choice, client=client
            )

        # Non-streaming calls
        if schema and not tools:
            return self._call_structured(model_id, messages, schema, system, temperature, max_tokens, client=client)
        elif tools:
            return self._call_with_tools(
                model_id, messages, tools, tool_choice, system, temperature, max_tokens, client=client
            )
        else:
            return self._call_basic(model_id, messages, system, temperature, max_tokens, client=client)

    def _call_basic(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        system: Optional[str],
        temperature: float,
        max_tokens: int,
        client: Optional[Anthropic] = None,
    ) -> ProviderResponse:
        """Make a standard completion call."""
        kwargs: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
        }

        if system:
            kwargs["system"] = system
        if temperature != 1.0:
            kwargs["temperature"] = temperature

        client = client or self.client
        response = client.messages.create(**kwargs)

        # Extract text content
        content = ""
        for block in response.content:
            if block.type == "text":
                content = block.text
                break

        return ProviderResponse(
            content=content,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            raw_response=response,
        )

    def _call_structured(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        schema: Type[BaseModel],
        system: Optional[str],
        temperature: float,
        max_tokens: int,
        client: Optional[Anthropic] = None,
    ) -> ProviderResponse:
        """Make a structured output call using Anthropic's tool_use pattern."""
        # Define a tool based on the Pydantic schema
        tool_definition = {
            "name": "structured_response",
            "description": "Provide your response in the required structured format",
            "input_schema": schema.model_json_schema(),
        }

        # Modify system prompt to encourage tool use
        structured_system = (system or "") + (
            "\n\nYou MUST use the structured_response tool to provide your answer. "
            "Do not respond with plain text."
        )

        kwargs: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "system": structured_system,
            "max_tokens": max_tokens,
            "tools": [tool_definition],
            "tool_choice": {"type": "tool", "name": "structured_response"},
        }

        if temperature != 1.0:
            kwargs["temperature"] = temperature

        client = client or self.client
        response = client.messages.create(**kwargs)

        # Extract from tool_use block
        tool_block = next(
            (b for b in response.content if b.type == "tool_use"),
            None,
        )

        if tool_block:
            parsed = schema.model_validate(tool_block.input)
            content = json.dumps(tool_block.input)
        else:
            # Fallback to text content if tool wasn't used
            content = ""
            for block in response.content:
                if block.type == "text":
                    content = block.text
                    break
            parsed = None

        return ProviderResponse(
            content=content,
            parsed=parsed,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            raw_response=response,
        )

    def _call_with_tools(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        tools: List[ToolDefinition],
        tool_choice: Union[str, Dict[str, Any]],
        system: Optional[str],
        temperature: float,
        max_tokens: int,
        client: Optional[Anthropic] = None,
    ) -> ProviderResponse:
        """Make a call with tool/function calling support."""
        anthropic_tools = self._convert_tools(tools)
        anthropic_tool_choice = self._convert_tool_choice(tool_choice)

        kwargs: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            "tools": anthropic_tools,
            "tool_choice": anthropic_tool_choice,
        }

        if system:
            kwargs["system"] = system
        if temperature != 1.0:
            kwargs["temperature"] = temperature

        client = client or self.client
        response = client.messages.create(**kwargs)

        # Extract content and tool calls
        content = ""
        tool_calls = []

        for block in response.content:
            if block.type == "text":
                content = block.text
            elif block.type == "tool_use":
                tool_calls.append(
                    ToolCall(
                        id=block.id,
                        name=block.name,
                        arguments=block.input,
                    )
                )

        return ProviderResponse(
            content=content,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            tool_calls=tool_calls if tool_calls else None,
            raw_response=response,
        )

    def _call_stream(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        system: Optional[str],
        temperature: float,
        max_tokens: int,
        schema: Optional[Type[BaseModel]],
        tools: Optional[List[ToolDefinition]],
        tool_choice: Union[str, Dict[str, Any]],
        client: Optional[Anthropic] = None,
    ) -> Generator[ProviderStreamChunk, None, None]:
        """Stream a call, yielding chunks as they arrive."""
        kwargs: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
        }

        if system:
            kwargs["system"] = system
        if temperature != 1.0:
            kwargs["temperature"] = temperature

        # Add tools if provided
        if tools:
            kwargs["tools"] = self._convert_tools(tools)
            kwargs["tool_choice"] = self._convert_tool_choice(tool_choice)

        # For structured output, use tool pattern
        if schema and not tools:
            tool_definition = {
                "name": "structured_response",
                "description": "Provide your response in the required structured format",
                "input_schema": schema.model_json_schema(),
            }
            kwargs["tools"] = [tool_definition]
            kwargs["tool_choice"] = {"type": "tool", "name": "structured_response"}
            # Modify system for structured output
            kwargs["system"] = (system or "") + (
                "\n\nYou MUST use the structured_response tool to provide your answer."
            )

        # Use the streaming context manager
        client = client or self.client
        with client.messages.stream(**kwargs) as stream:
            accumulated_content = ""
            tool_call_accumulators: Dict[str, Dict[str, Any]] = {}  # id -> {name, input_json}

            for event in stream:
                # Handle different event types
                if event.type == "content_block_start":
                    if hasattr(event, "content_block"):
                        block = event.content_block
                        if block.type == "tool_use":
                            tool_call_accumulators[block.id] = {
                                "name": block.name,
                                "input_json": ""
                            }

                elif event.type == "content_block_delta":
                    if hasattr(event, "delta"):
                        delta = event.delta
                        if delta.type == "text_delta":
                            accumulated_content += delta.text
                            yield ProviderStreamChunk(content=delta.text)
                        elif delta.type == "input_json_delta":
                            # Accumulate tool input JSON
                            if hasattr(event, "index"):
                                # Find the tool call by checking current accumulators
                                for tool_id, tool_data in tool_call_accumulators.items():
                                    tool_data["input_json"] += delta.partial_json

            # Get final message for token counts
            final_message = stream.get_final_message()

            # Build final tool calls
            final_tool_calls = None
            if tool_call_accumulators:
                final_tool_calls = []
                for tool_id, tool_data in tool_call_accumulators.items():
                    try:
                        arguments = json.loads(tool_data["input_json"]) if tool_data["input_json"] else {}
                    except json.JSONDecodeError:
                        arguments = {}
                    final_tool_calls.append(
                        ToolCall(
                            id=tool_id,
                            name=tool_data["name"],
                            arguments=arguments,
                        )
                    )

            # For structured output via tools, the content is the JSON
            if schema and not tools and final_tool_calls:
                accumulated_content = json.dumps(final_tool_calls[0].arguments)

            # Yield final chunk with metadata
            yield ProviderStreamChunk(
                content="",
                is_final=True,
                tool_calls=final_tool_calls,
                input_tokens=final_message.usage.input_tokens,
                output_tokens=final_message.usage.output_tokens,
            )


def main():
    """Run Anthropic provider tests."""
    print("=" * 60)
    print("Anthropic Provider Tests")
    print("=" * 60)

    provider = AnthropicProvider()
    model_id = "claude-3-5-haiku-20241022"

    # Test 1: Simple call
    print("\n--- Test 1: Simple Call ---")
    try:
        response = provider.call(
            model_id=model_id,
            messages=[{"role": "user", "content": "What is 2+2? Reply with just the number."}],
            temperature=0,
        )
        print(f"Content: {response.content}")
        print(f"Tokens: {response.input_tokens} in, {response.output_tokens} out")
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

    # Test 2: Structured output
    print("\n--- Test 2: Structured Output ---")
    try:
        class Person(BaseModel):
            name: str
            age: int

        response = provider.call(
            model_id=model_id,
            messages=[
                {
                    "role": "user",
                    "content": "Extract the person info: John Smith is 30 years old.",
                }
            ],
            schema=Person,
            temperature=0,
        )
        print(f"Content: {response.content}")
        print(f"Parsed: {response.parsed}")
        print(f"Parsed type: {type(response.parsed)}")
        print(f"Name: {response.parsed.name}, Age: {response.parsed.age}")
        print(f"Tokens: {response.input_tokens} in, {response.output_tokens} out")
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

    # Test 3: Tool calling
    print("\n--- Test 3: Tool Calling ---")
    try:
        tools = [
            ToolDefinition(
                name="get_current_time",
                description="Get the current time in a specific timezone",
                parameters={
                    "type": "object",
                    "properties": {
                        "timezone": {
                            "type": "string",
                            "description": "The timezone (e.g., 'America/New_York')",
                        }
                    },
                    "required": ["timezone"],
                },
            )
        ]

        response = provider.call(
            model_id=model_id,
            messages=[{"role": "user", "content": "What time is it in Tokyo?"}],
            tools=tools,
            temperature=0,
        )
        print(f"Content: {response.content}")
        print(f"Tool calls: {response.tool_calls}")
        if response.tool_calls:
            for tc in response.tool_calls:
                print(f"  - {tc.name}({tc.arguments})")
        print(f"Tokens: {response.input_tokens} in, {response.output_tokens} out")
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

    # Test 4: Streaming basic
    print("\n--- Test 4: Streaming Basic ---")
    try:
        stream = provider.call(
            model_id=model_id,
            messages=[{"role": "user", "content": "Count from 1 to 5, one number per line."}],
            temperature=0,
            stream=True,
        )
        print("Streamed content: ", end="")
        for chunk in stream:
            if chunk.content:
                print(chunk.content, end="", flush=True)
            if chunk.is_final:
                print(f"\nFinal - Tokens: {chunk.input_tokens} in, {chunk.output_tokens} out")
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

    # Test 5: Streaming with tools
    print("\n--- Test 5: Streaming with Tools ---")
    try:
        tools = [
            ToolDefinition(
                name="get_weather",
                description="Get weather for a location",
                parameters={
                    "type": "object",
                    "properties": {
                        "location": {"type": "string", "description": "City name"}
                    },
                    "required": ["location"],
                },
            )
        ]

        stream = provider.call(
            model_id=model_id,
            messages=[{"role": "user", "content": "What's the weather in Paris?"}],
            tools=tools,
            temperature=0,
            stream=True,
        )
        print("Streamed: ", end="")
        for chunk in stream:
            if chunk.content:
                print(chunk.content, end="", flush=True)
            if chunk.is_final:
                print(f"\nTool calls: {chunk.tool_calls}")
                print(f"Tokens: {chunk.input_tokens} in, {chunk.output_tokens} out")
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

    print("\n" + "=" * 60)
    print("All tests completed")
    print("=" * 60)


if __name__ == "__main__":
    main()
