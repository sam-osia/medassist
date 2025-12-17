from core.llm_lib.llm_result import LLMResult
from typing import Any, Callable
from core.llm_lib.models.gpt import call_gpt
from core.llm_lib.models import gpt_models


def call_model(messages, model_name: str = "GPT 4o", system_message: str = "You are a helpful assistant.") -> LLMResult:
    if model_name in gpt_models:
        print(f"Calling {model_name}")
        output, error, input_tokens, output_tokens = call_gpt(messages=messages, model_name=model_name, count_tokens=True, system_message=system_message)
        return LLMResult(
            answer=output,
            traces=[],
            model=model_name,
            token_usage={"input_tokens": input_tokens, "output_tokens": output_tokens},
            cost=0)
    else:
        raise ValueError(f"Model {model_name} not supported")


def call_llm(prompt: str, 
             system_prompt: str,
             model: str = "GPT 4o",
             strategy: str = "default",
             strategy_config: dict[str, Any] = {},
             parser: Callable[[str], Any] = None,
             **kwargs) -> LLMResult:
    if strategy == "default":
        print("Calling default")
        return call_model(messages=prompt, model_name=model, system_message=system_prompt, **kwargs)
    else:
        raise ValueError(f"Strategy {strategy} not supported")


def get_models():
    return {
        'OpenAI': gpt_models
    }