"""Google Gemini API provider implementation using google.genai SDK."""

import os
from typing import Any, Dict, Generator, List, Optional, Type, Union

from dotenv import load_dotenv
from pydantic import BaseModel

from .base import BaseProvider, ProviderResponse, ProviderStreamChunk, ToolDefinition
from ..result import ToolCall

load_dotenv()

# Import google.genai - will be configured on first use
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    genai = None
    types = None


class GoogleProvider(BaseProvider):
    """Google Gemini API provider using the new google.genai SDK."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        """Lazy client initialization."""
        if not GENAI_AVAILABLE:
            raise ImportError(
                "google-genai package not installed. "
                "Install with: pip install google-genai"
            )
        if self._client is None:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable not set")
            self._client = genai.Client(api_key=api_key)
        return self._client

    def _convert_messages(
        self, messages: List[Dict[str, str]]
    ) -> List[Any]:
        """Convert OpenAI-style messages to Gemini Content format."""
        contents = []
        for msg in messages:
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part(text=msg["content"])]
                )
            )
        return contents

    def _convert_tools(self, tools: List[ToolDefinition]) -> List[Any]:
        """Convert ToolDefinition to Gemini Tool format."""
        function_declarations = []
        for tool in tools:
            fd = types.FunctionDeclaration(
                name=tool.name,
                description=tool.description,
                parameters=tool.parameters,
            )
            function_declarations.append(fd)
        return [types.Tool(function_declarations=function_declarations)]

    def _convert_tool_choice(
        self, tool_choice: Union[str, Dict[str, Any]]
    ) -> Optional[Any]:
        """Convert tool_choice to Gemini ToolConfig."""
        if isinstance(tool_choice, str):
            if tool_choice == "auto":
                mode = "AUTO"
            elif tool_choice == "required":
                mode = "ANY"
            elif tool_choice == "none":
                mode = "NONE"
            else:
                # Specific function name
                return types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(
                        mode="ANY",
                        allowed_function_names=[tool_choice],
                    )
                )
            return types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode=mode)
            )
        return None

    def _build_config(
        self,
        system: Optional[str],
        temperature: float,
        max_tokens: int,
        schema: Optional[Type[BaseModel]] = None,
        tools: Optional[List[Any]] = None,
        tool_config: Optional[Any] = None,
    ) -> Any:
        """Build unified GenerateContentConfig."""
        config_kwargs = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }

        if system:
            config_kwargs["system_instruction"] = system

        if schema and not tools:
            # Structured output mode
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = schema

        if tools:
            config_kwargs["tools"] = tools
            if tool_config:
                config_kwargs["tool_config"] = tool_config

        return types.GenerateContentConfig(**config_kwargs)

    def _extract_response(
        self,
        response: Any,
        schema: Optional[Type[BaseModel]] = None,
    ) -> ProviderResponse:
        """Extract content and tool calls from Gemini response."""
        content = ""
        tool_calls = []
        parsed = None

        # Try to get text directly first
        if hasattr(response, 'text') and response.text:
            content = response.text

        # Extract from candidates for tool calls
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and candidate.content:
                for part in candidate.content.parts:
                    if hasattr(part, 'text') and part.text and not content:
                        content = part.text
                    elif hasattr(part, 'function_call') and part.function_call:
                        fc = part.function_call
                        args = dict(fc.args) if fc.args else {}
                        tool_calls.append(
                            ToolCall(
                                id=f"call_{fc.name}",
                                name=fc.name,
                                arguments=args,
                            )
                        )

        # For structured output, parse the JSON content
        if schema and content and not tool_calls:
            parsed = schema.model_validate_json(content)

        # Get token counts
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            input_tokens = response.usage_metadata.prompt_token_count or 0
            output_tokens = response.usage_metadata.candidates_token_count or 0

        return ProviderResponse(
            content=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            parsed=parsed,
            tool_calls=tool_calls if tool_calls else None,
            raw_response=response,
        )

    def _get_client(self, api_key: Optional[str] = None):
        """Get client - use override api_key if provided, otherwise default."""
        if api_key:
            return genai.Client(api_key=api_key)
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

        # Convert inputs
        contents = self._convert_messages(messages)
        gemini_tools = self._convert_tools(tools) if tools else None
        tool_config = self._convert_tool_choice(tool_choice) if tools else None

        # Build config
        config = self._build_config(
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            schema=schema,
            tools=gemini_tools,
            tool_config=tool_config,
        )

        if stream:
            return self._call_stream(model_id, contents, config, schema, client=client)

        # Non-streaming call
        response = client.models.generate_content(
            model=model_id,
            contents=contents,
            config=config,
        )

        return self._extract_response(response, schema)

    def _call_stream(
        self,
        model_id: str,
        contents: List[Any],
        config: Any,
        schema: Optional[Type[BaseModel]],
        client=None,
    ) -> Generator[ProviderStreamChunk, None, None]:
        """Stream a call, yielding chunks as they arrive."""
        client = client or self.client
        response_stream = client.models.generate_content_stream(
            model=model_id,
            contents=contents,
            config=config,
        )

        accumulated_content = ""
        final_tool_calls = []
        final_input_tokens = 0
        final_output_tokens = 0
        last_chunk = None

        for chunk in response_stream:
            last_chunk = chunk

            # Extract text from chunk
            if hasattr(chunk, 'text') and chunk.text:
                accumulated_content += chunk.text
                yield ProviderStreamChunk(content=chunk.text)

            # Check for function calls in chunk
            if hasattr(chunk, 'candidates') and chunk.candidates:
                for candidate in chunk.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        for part in candidate.content.parts:
                            if hasattr(part, 'function_call') and part.function_call:
                                fc = part.function_call
                                args = dict(fc.args) if fc.args else {}
                                final_tool_calls.append(
                                    ToolCall(
                                        id=f"call_{fc.name}",
                                        name=fc.name,
                                        arguments=args,
                                    )
                                )

            # Check for usage metadata
            if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                final_input_tokens = chunk.usage_metadata.prompt_token_count or 0
                final_output_tokens = chunk.usage_metadata.candidates_token_count or 0

        # Yield final chunk with metadata
        yield ProviderStreamChunk(
            content="",
            is_final=True,
            tool_calls=final_tool_calls if final_tool_calls else None,
            input_tokens=final_input_tokens,
            output_tokens=final_output_tokens,
        )


def main():
    """Run Google Gemini provider tests."""
    print("=" * 60)
    print("Google Gemini Provider Tests (google.genai SDK)")
    print("=" * 60)

    provider = GoogleProvider()
    model_id = "gemini-2.0-flash"

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
