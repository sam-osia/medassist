"""OpenAI API provider implementation."""

import json
import os
from typing import Any, Dict, List, Optional, Type, Union

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

from .base import BaseProvider, ProviderResponse, ToolDefinition
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
    ) -> ProviderResponse:
        """Make a standard completion call."""
        full_messages = self._build_messages(messages, system)

        response = self.client.chat.completions.create(
            model=model_id,
            messages=full_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return ProviderResponse(
            content=response.choices[0].message.content or "",
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            raw_response=response,
        )

    def call_structured(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        schema: Type[BaseModel],
        system: Optional[str] = None,
        temperature: float = 1.0,
        max_tokens: int = 8192,
    ) -> ProviderResponse:
        """Make a structured output call using OpenAI's native parsing."""
        full_messages = self._build_messages(messages, system)

        response = self.client.beta.chat.completions.parse(
            model=model_id,
            messages=full_messages,
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
        """Make a call with tool/function calling support."""
        full_messages = self._build_messages(messages, system)
        openai_tools = self._convert_tools(tools)
        openai_tool_choice = self._convert_tool_choice(tool_choice)

        response = self.client.chat.completions.create(
            model=model_id,
            messages=full_messages,
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


def main():
    """Run OpenAI provider tests."""
    print("=" * 60)
    print("OpenAI Provider Tests")
    print("=" * 60)

    provider = OpenAIProvider()
    model_id = "gpt-4o-mini-2024-07-18"  # Use cheaper model for tests

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

        response = provider.call_structured(
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

        response = provider.call_with_tools(
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

    print("\n" + "=" * 60)
    print("All tests completed")
    print("=" * 60)


if __name__ == "__main__":
    main()
