"""Model registry with configurations and pricing."""

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class ModelConfig:
    """Immutable model configuration."""
    id: str                       # API model ID (e.g., "gpt-4o-2024-11-20")
    provider: str                 # "openai" | "anthropic" | "google"
    display_name: str             # Human-readable name
    input_price_per_m: float      # USD per 1M input tokens
    output_price_per_m: float     # USD per 1M output tokens
    context_window: int           # Maximum context length in tokens
    supports_structured: bool     # Can do structured/JSON output
    supports_vision: bool         # Can process images
    supports_tools: bool          # Can do function/tool calling
    supports_structured_with_tools: bool = False  # Can do structured output + tools together


# Central registry - single source of truth for all models
MODELS: Dict[str, ModelConfig] = {
    # ===================
    # OpenAI Models
    # ===================
    "gpt-4o": ModelConfig(
        id="gpt-4o-2024-11-20",
        provider="openai",
        display_name="GPT-4o",
        input_price_per_m=2.50,
        output_price_per_m=10.00,
        context_window=128000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "gpt-4o-mini": ModelConfig(
        id="gpt-4o-mini-2024-07-18",
        provider="openai",
        display_name="GPT-4o Mini",
        input_price_per_m=0.15,
        output_price_per_m=0.60,
        context_window=128000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "gpt-4.1": ModelConfig(
        id="gpt-4.1-2025-04-14",
        provider="openai",
        display_name="GPT-4.1",
        input_price_per_m=2.00,
        output_price_per_m=8.00,
        context_window=1000000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "gpt-4.1-mini": ModelConfig(
        id="gpt-4.1-mini-2025-04-14",
        provider="openai",
        display_name="GPT-4.1 Mini",
        input_price_per_m=0.40,
        output_price_per_m=1.60,
        context_window=1000000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "o3": ModelConfig(
        id="o3-2025-04-16",
        provider="openai",
        display_name="o3",
        input_price_per_m=10.00,
        output_price_per_m=40.00,
        context_window=200000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "o4-mini": ModelConfig(
        id="o4-mini-2025-04-16",
        provider="openai",
        display_name="o4 Mini",
        input_price_per_m=1.10,
        output_price_per_m=4.40,
        context_window=200000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),

    # ===================
    # Anthropic Models
    # ===================
    "claude-sonnet": ModelConfig(
        id="claude-sonnet-4-20250514",
        provider="anthropic",
        display_name="Claude Sonnet 4",
        input_price_per_m=3.00,
        output_price_per_m=15.00,
        context_window=200000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "claude-3.5-sonnet": ModelConfig(
        id="claude-3-5-sonnet-20241022",
        provider="anthropic",
        display_name="Claude 3.5 Sonnet",
        input_price_per_m=3.00,
        output_price_per_m=15.00,
        context_window=200000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "claude-haiku": ModelConfig(
        id="claude-3-5-haiku-20241022",
        provider="anthropic",
        display_name="Claude 3.5 Haiku",
        input_price_per_m=0.80,
        output_price_per_m=4.00,
        context_window=200000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),

    # ===================
    # Google Models
    # ===================
    "gemini-2.0-flash": ModelConfig(
        id="models/gemini-2.0-flash",
        provider="google",
        display_name="Gemini 2.0 Flash",
        input_price_per_m=0.10,
        output_price_per_m=0.40,
        context_window=1000000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "gemini-2.5-flash": ModelConfig(
        id="models/gemini-2.5-flash",
        provider="google",
        display_name="Gemini 2.5 Flash",
        input_price_per_m=0.15,
        output_price_per_m=0.60,
        context_window=1000000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
    "gemini-2.5-pro": ModelConfig(
        id="models/gemini-2.5-pro",
        provider="google",
        display_name="Gemini 2.5 Pro",
        input_price_per_m=1.25,
        output_price_per_m=5.00,
        context_window=2000000,
        supports_structured=True,
        supports_vision=True,
        supports_tools=True,
    ),
}


def get_model(name: str) -> ModelConfig:
    """Get model configuration by friendly name.

    Args:
        name: Friendly model name (e.g., "gpt-4o", "claude-sonnet")

    Returns:
        ModelConfig for the requested model

    Raises:
        ValueError: If model name is not found in registry
    """
    if name not in MODELS:
        available = ", ".join(sorted(MODELS.keys()))
        raise ValueError(f"Unknown model '{name}'. Available models: {available}")
    return MODELS[name]


def get_models() -> Dict[str, ModelConfig]:
    """Get all available models."""
    return MODELS.copy()


def get_models_by_provider(provider: str) -> Dict[str, ModelConfig]:
    """Get all models for a specific provider.

    Args:
        provider: Provider name ("openai", "anthropic", "google")

    Returns:
        Dict of model name -> ModelConfig for the provider
    """
    return {k: v for k, v in MODELS.items() if v.provider == provider}


def get_model_names() -> List[str]:
    """Get list of all available model names."""
    return list(MODELS.keys())


def calculate_cost(input_tokens: int, output_tokens: int, config: ModelConfig) -> float:
    """Calculate cost in USD for a given token usage.

    Args:
        input_tokens: Number of input/prompt tokens
        output_tokens: Number of output/completion tokens
        config: ModelConfig with pricing information

    Returns:
        Cost in USD (rounded to 6 decimal places)
    """
    input_cost = (input_tokens / 1_000_000) * config.input_price_per_m
    output_cost = (output_tokens / 1_000_000) * config.output_price_per_m
    return round(input_cost + output_cost, 6)
