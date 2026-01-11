"""Google Gemini API provider implementation."""

import json
import os
from typing import Any, Dict, List, Optional, Type, Union

from dotenv import load_dotenv
from pydantic import BaseModel

from .base import BaseProvider, ProviderResponse, ToolDefinition
from ..result import ToolCall

load_dotenv()

# Import google.generativeai - will be configured on first use
try:
    import google.generativeai as genai
    from google.generativeai.types import FunctionDeclaration, Tool
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    genai = None


class GoogleProvider(BaseProvider):
    """Google Gemini API provider."""

    def __init__(self):
        self._configured = False

    def _ensure_configured(self):
        """Configure the Gemini API on first use."""
        if not GENAI_AVAILABLE:
            raise ImportError(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )

        if not self._configured:
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError("GOOGLE_API_KEY environment variable not set")
            genai.configure(api_key=api_key)
            self._configured = True

    def _convert_messages(
        self, messages: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """Convert OpenAI-style messages to Gemini format."""
        gemini_messages = []
        for msg in messages:
            role = "model" if msg["role"] == "assistant" else "user"
            gemini_messages.append({
                "role": role,
                "parts": [msg["content"]],
            })
        return gemini_messages

    def _convert_tools(self, tools: List[ToolDefinition]) -> List[Any]:
        """Convert ToolDefinition to Gemini format."""
        function_declarations = []
        for tool in tools:
            # Gemini expects a specific format for parameters
            fd = FunctionDeclaration(
                name=tool.name,
                description=tool.description,
                parameters=tool.parameters,
            )
            function_declarations.append(fd)
        return [Tool(function_declarations=function_declarations)]

    def _convert_tool_choice(
        self, tool_choice: Union[str, Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Convert tool_choice to Gemini format."""
        if isinstance(tool_choice, str):
            if tool_choice == "auto":
                return {"function_calling_config": {"mode": "AUTO"}}
            elif tool_choice == "required":
                return {"function_calling_config": {"mode": "ANY"}}
            elif tool_choice == "none":
                return {"function_calling_config": {"mode": "NONE"}}
            else:
                # Specific function name
                return {
                    "function_calling_config": {
                        "mode": "ANY",
                        "allowed_function_names": [tool_choice],
                    }
                }
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
        self._ensure_configured()

        model = genai.GenerativeModel(
            model_name=model_id,
            system_instruction=system,
        )

        gemini_messages = self._convert_messages(messages)

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }

        response = model.generate_content(
            gemini_messages,
            generation_config=generation_config,
        )

        return ProviderResponse(
            content=response.text,
            input_tokens=response.usage_metadata.prompt_token_count,
            output_tokens=response.usage_metadata.candidates_token_count,
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
        """Make a structured output call using Gemini's JSON mode."""
        self._ensure_configured()

        model = genai.GenerativeModel(
            model_name=model_id,
            system_instruction=system,
        )

        gemini_messages = self._convert_messages(messages)

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
            "response_mime_type": "application/json",
            "response_schema": schema,
        }

        response = model.generate_content(
            gemini_messages,
            generation_config=generation_config,
        )

        content = response.text
        parsed = schema.model_validate_json(content)

        return ProviderResponse(
            content=content,
            parsed=parsed,
            input_tokens=response.usage_metadata.prompt_token_count,
            output_tokens=response.usage_metadata.candidates_token_count,
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
        self._ensure_configured()

        gemini_tools = self._convert_tools(tools)
        tool_config = self._convert_tool_choice(tool_choice)

        model = genai.GenerativeModel(
            model_name=model_id,
            system_instruction=system,
            tools=gemini_tools,
        )

        gemini_messages = self._convert_messages(messages)

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }

        response = model.generate_content(
            gemini_messages,
            generation_config=generation_config,
            tool_config=tool_config,
        )

        # Extract content and tool calls
        content = ""
        tool_calls = []

        for part in response.candidates[0].content.parts:
            if hasattr(part, "text") and part.text:
                content = part.text
            elif hasattr(part, "function_call") and part.function_call:
                fc = part.function_call
                # Convert args to dict
                args = dict(fc.args) if fc.args else {}
                tool_calls.append(
                    ToolCall(
                        id=f"call_{fc.name}",  # Gemini doesn't provide IDs
                        name=fc.name,
                        arguments=args,
                    )
                )

        return ProviderResponse(
            content=content,
            input_tokens=response.usage_metadata.prompt_token_count,
            output_tokens=response.usage_metadata.candidates_token_count,
            tool_calls=tool_calls if tool_calls else None,
            raw_response=response,
        )


def main():
    """Run Google Gemini provider tests."""
    print("=" * 60)
    print("Google Gemini Provider Tests")
    print("=" * 60)

    provider = GoogleProvider()
    model_id = "models/gemini-2.0-flash"  # Use cheaper model for tests

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
