"""Tests for the unified LLM provider library."""

import sys
sys.path.append('../')

from pydantic import BaseModel
from core.llm_provider import call, StreamChunk, LLMResult, ToolDefinition


class Person(BaseModel):
    """Test schema for structured output."""
    name: str
    age: int


def test_openai_basic():
    """Test basic OpenAI call."""
    print("\n--- OpenAI: Basic Call ---")
    result = call(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "What is 2+2? Reply with just the number."}],
        temperature=0,
    )
    print(f"Content: {result.content}")
    print(f"Tokens: {result.input_tokens} in, {result.output_tokens} out")
    print(f"Cost: ${result.cost:.6f}")
    print("PASS")


def test_openai_structured():
    """Test OpenAI structured output."""
    print("\n--- OpenAI: Structured Output ---")
    result = call(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "John Smith is 30 years old."}],
        schema=Person,
        temperature=0,
    )
    print(f"Content: {result.content}")
    print(f"Parsed: {result.parsed}")
    print(f"Name: {result.parsed.name}, Age: {result.parsed.age}")
    print("PASS")


def test_openai_tools():
    """Test OpenAI tool calling."""
    print("\n--- OpenAI: Tool Calling ---")
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
    result = call(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
        tools=tools,
        temperature=0,
    )
    print(f"Content: {result.content}")
    print(f"Has tool calls: {result.has_tool_calls}")
    if result.tool_calls:
        for tc in result.tool_calls:
            print(f"  - {tc.name}({tc.arguments})")
    print("PASS")


def test_openai_streaming():
    """Test OpenAI streaming."""
    print("\n--- OpenAI: Streaming ---")
    stream = call(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Count from 1 to 5."}],
        temperature=0,
        stream=True,
    )
    print("Streamed: ", end="")
    for chunk in stream:
        if chunk.content:
            print(chunk.content, end="", flush=True)
        if chunk.is_final:
            print(f"\nTokens: {chunk.input_tokens} in, {chunk.output_tokens} out")
    print("PASS")


def test_openai_streaming_with_tools():
    """Test OpenAI streaming with tools."""
    print("\n--- OpenAI: Streaming with Tools ---")
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
    stream = call(
        model="gpt-4o-mini",
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
    print("PASS")


def test_anthropic_basic():
    """Test basic Anthropic call."""
    print("\n--- Anthropic: Basic Call ---")
    result = call(
        model="claude-haiku",
        messages=[{"role": "user", "content": "What is 2+2? Reply with just the number."}],
        temperature=0,
    )
    print(f"Content: {result.content}")
    print(f"Tokens: {result.input_tokens} in, {result.output_tokens} out")
    print(f"Cost: ${result.cost:.6f}")
    print("PASS")


def test_anthropic_structured():
    """Test Anthropic structured output."""
    print("\n--- Anthropic: Structured Output ---")
    result = call(
        model="claude-haiku",
        messages=[{"role": "user", "content": "John Smith is 30 years old."}],
        schema=Person,
        temperature=0,
    )
    print(f"Content: {result.content}")
    print(f"Parsed: {result.parsed}")
    print(f"Name: {result.parsed.name}, Age: {result.parsed.age}")
    print("PASS")


def test_anthropic_streaming():
    """Test Anthropic streaming."""
    print("\n--- Anthropic: Streaming ---")
    stream = call(
        model="claude-haiku",
        messages=[{"role": "user", "content": "Count from 1 to 5."}],
        temperature=0,
        stream=True,
    )
    print("Streamed: ", end="")
    for chunk in stream:
        if chunk.content:
            print(chunk.content, end="", flush=True)
        if chunk.is_final:
            print(f"\nTokens: {chunk.input_tokens} in, {chunk.output_tokens} out")
    print("PASS")


def test_google_basic():
    """Test basic Google call."""
    print("\n--- Google: Basic Call ---")
    result = call(
        model="gemini-2.0-flash",
        messages=[{"role": "user", "content": "What is 2+2? Reply with just the number."}],
        temperature=0,
    )
    print(f"Content: {result.content}")
    print(f"Tokens: {result.input_tokens} in, {result.output_tokens} out")
    print(f"Cost: ${result.cost:.6f}")
    print("PASS")


def test_google_structured():
    """Test Google structured output."""
    print("\n--- Google: Structured Output ---")
    result = call(
        model="gemini-2.0-flash",
        messages=[{"role": "user", "content": "John Smith is 30 years old."}],
        schema=Person,
        temperature=0,
    )
    print(f"Content: {result.content}")
    print(f"Parsed: {result.parsed}")
    print(f"Name: {result.parsed.name}, Age: {result.parsed.age}")
    print("PASS")


def test_google_streaming():
    """Test Google streaming."""
    print("\n--- Google: Streaming ---")
    stream = call(
        model="gemini-2.0-flash",
        messages=[{"role": "user", "content": "Count from 1 to 5."}],
        temperature=0,
        stream=True,
    )
    print("Streamed: ", end="")
    for chunk in stream:
        if chunk.content:
            print(chunk.content, end="", flush=True)
        if chunk.is_final:
            print(f"\nTokens: {chunk.input_tokens} in, {chunk.output_tokens} out")
    print("PASS")


def run_openai_tests():
    """Run all OpenAI tests."""
    print("\n" + "=" * 60)
    print("OpenAI Provider Tests (via unified call)")
    print("=" * 60)

    try:
        test_openai_basic()
    except Exception as e:
        print(f"FAIL: {e}")

    try:
        test_openai_structured()
    except Exception as e:
        print(f"FAIL: {e}")

    try:
        test_openai_tools()
    except Exception as e:
        print(f"FAIL: {e}")

    try:
        test_openai_streaming()
    except Exception as e:
        print(f"FAIL: {e}")

    try:
        test_openai_streaming_with_tools()
    except Exception as e:
        print(f"FAIL: {e}")


def run_anthropic_tests():
    """Run all Anthropic tests."""
    print("\n" + "=" * 60)
    print("Anthropic Provider Tests (via unified call)")
    print("=" * 60)

    try:
        test_anthropic_basic()
    except Exception as e:
        print(f"FAIL: {e}")

    try:
        test_anthropic_structured()
    except Exception as e:
        print(f"FAIL: {e}")

    try:
        test_anthropic_streaming()
    except Exception as e:
        print(f"FAIL: {e}")


def run_google_tests():
    """Run all Google tests."""
    print("\n" + "=" * 60)
    print("Google Provider Tests (via unified call)")
    print("=" * 60)

    try:
        test_google_basic()
    except Exception as e:
        print(f"FAIL: {e}")

    try:
        test_google_structured()
    except Exception as e:
        print(f"FAIL: {e}")

    try:
        test_google_streaming()
    except Exception as e:
        print(f"FAIL: {e}")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Test LLM Provider')
    parser.add_argument('--provider', choices=['openai', 'anthropic', 'google', 'all'],
                        default='all', help='Provider to test')
    args = parser.parse_args()

    if args.provider == 'openai' or args.provider == 'all':
        run_openai_tests()

    if args.provider == 'anthropic' or args.provider == 'all':
        run_anthropic_tests()

    if args.provider == 'google' or args.provider == 'all':
        run_google_tests()

    print("\n" + "=" * 60)
    print("All tests completed")
    print("=" * 60)
