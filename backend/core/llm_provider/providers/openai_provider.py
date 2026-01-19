"""OpenAI API provider implementation."""

import json
import os
from typing import Any, Dict, Generator, List, Optional, Type, Union

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

from .base import BaseProvider, ProviderResponse, ProviderStreamChunk, ToolDefinition
from ..result import ToolCall

load_dotenv()


class OpenAIProvider(BaseProvider):
    """OpenAI API provider."""

    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        """Lazy client initialization."""
        if self._client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            self._client = OpenAI(api_key=api_key)
        return self._client

    def _build_messages(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """Build messages list without mutating input."""
        full_messages = []
        if system:
            full_messages.append({"role": "system", "content": system})
        full_messages.extend(messages)
        return full_messages

    def _convert_tools(self, tools: List[ToolDefinition]) -> List[Dict[str, Any]]:
        """Convert ToolDefinition to OpenAI format."""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            }
            for tool in tools
        ]

    def _convert_tool_choice(
        self, tool_choice: Union[str, Dict[str, Any]]
    ) -> Union[str, Dict[str, Any]]:
        """Convert tool_choice to OpenAI format."""
        if isinstance(tool_choice, str):
            if tool_choice in ("auto", "none", "required"):
                return tool_choice
            # Assume it's a function name
            return {"type": "function", "function": {"name": tool_choice}}
        return tool_choice

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
        """Unified call method with optional structured output, tools, and streaming."""
        full_messages = self._build_messages(messages, system)

        if stream:
            return self._call_stream(
                model_id, full_messages, temperature, max_tokens, schema, tools, tool_choice
            )

        # Non-streaming calls
        if schema and not tools:
            return self._call_structured(model_id, full_messages, schema, temperature, max_tokens)
        elif tools:
            return self._call_with_tools(
                model_id, full_messages, tools, tool_choice, temperature, max_tokens
            )
        else:
            return self._call_basic(model_id, full_messages, temperature, max_tokens)

    def _call_basic(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> ProviderResponse:
        """Make a basic completion call."""
        response = self.client.chat.completions.create(
            model=model_id,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return ProviderResponse(
            content=response.choices[0].message.content or "",
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            raw_response=response,
        )

    def _call_structured(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        schema: Type[BaseModel],
        temperature: float,
        max_tokens: int,
    ) -> ProviderResponse:
        """Make a structured output call using OpenAI's native parsing."""
        response = self.client.beta.chat.completions.parse(
            model=model_id,
            messages=messages,
            response_format=schema,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        message = response.choices[0].message

        return ProviderResponse(
            content=message.content or "",
            parsed=message.parsed,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            raw_response=response,
        )

    def _call_with_tools(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        tools: List[ToolDefinition],
        tool_choice: Union[str, Dict[str, Any]],
        temperature: float,
        max_tokens: int,
    ) -> ProviderResponse:
        """Make a call with tool/function calling support."""
        openai_tools = self._convert_tools(tools)
        openai_tool_choice = self._convert_tool_choice(tool_choice)

        response = self.client.chat.completions.create(
            model=model_id,
            messages=messages,
            tools=openai_tools,
            tool_choice=openai_tool_choice,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        message = response.choices[0].message
        content = message.content or ""

        # Extract tool calls if present
        tool_calls = None
        if message.tool_calls:
            tool_calls = [
                ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=json.loads(tc.function.arguments),
                )
                for tc in message.tool_calls
            ]

        return ProviderResponse(
            content=content,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            tool_calls=tool_calls,
            raw_response=response,
        )

    def _call_stream(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        schema: Optional[Type[BaseModel]],
        tools: Optional[List[ToolDefinition]],
        tool_choice: Union[str, Dict[str, Any]],
    ) -> Generator[ProviderStreamChunk, None, None]:
        """Stream a call, yielding chunks as they arrive."""
        kwargs: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            "stream_options": {"include_usage": True},
        }

        # Add tools if provided
        if tools:
            kwargs["tools"] = self._convert_tools(tools)
            kwargs["tool_choice"] = self._convert_tool_choice(tool_choice)

        # For structured output with streaming, use JSON mode
        if schema and not tools:
            kwargs["response_format"] = {"type": "json_object"}
            # Add schema hint to help the model
            schema_json = schema.model_json_schema()
            schema_hint = f"\n\nYou must respond with valid JSON matching this schema: {json.dumps(schema_json)}"
            if messages and messages[-1]["role"] == "user":
                messages = messages.copy()
                messages[-1] = {
                    "role": "user",
                    "content": messages[-1]["content"] + schema_hint
                }
                kwargs["messages"] = messages

        response = self.client.chat.completions.create(**kwargs)

        accumulated_content = ""
        # Track tool calls by index: {index: {"id": str, "name": str, "arguments": str}}
        tool_call_accumulators: Dict[int, Dict[str, str]] = {}
        final_input_tokens = 0
        final_output_tokens = 0

        for chunk in response:
            # Handle usage info (comes in final chunk)
            if chunk.usage:
                final_input_tokens = chunk.usage.prompt_tokens
                final_output_tokens = chunk.usage.completion_tokens

            # Handle content delta
            if chunk.choices:
                delta = chunk.choices[0].delta

                # Text content
                if delta and delta.content:
                    accumulated_content += delta.content
                    yield ProviderStreamChunk(content=delta.content)

                # Tool calls (streamed incrementally)
                if delta and delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_call_accumulators:
                            tool_call_accumulators[idx] = {
                                "id": "",
                                "name": "",
                                "arguments": ""
                            }
                        if tc_delta.id:
                            tool_call_accumulators[idx]["id"] = tc_delta.id
                        if tc_delta.function:
                            if tc_delta.function.name:
                                tool_call_accumulators[idx]["name"] = tc_delta.function.name
                            if tc_delta.function.arguments:
                                tool_call_accumulators[idx]["arguments"] += tc_delta.function.arguments

        # Build final tool calls
        final_tool_calls = None
        if tool_call_accumulators:
            final_tool_calls = [
                ToolCall(
                    id=tc["id"],
                    name=tc["name"],
                    arguments=json.loads(tc["arguments"]) if tc["arguments"] else {},
                )
                for tc in tool_call_accumulators.values()
            ]

        # Yield final chunk with metadata
        yield ProviderStreamChunk(
            content="",
            is_final=True,
            tool_calls=final_tool_calls,
            input_tokens=final_input_tokens,
            output_tokens=final_output_tokens,
        )


def main():
    """Run OpenAI provider tests."""
    print("=" * 60)
    print("OpenAI Provider Tests")
    print("=" * 60)

    provider = OpenAIProvider()
    model_id = "gpt-4o-mini-2024-07-18"

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
