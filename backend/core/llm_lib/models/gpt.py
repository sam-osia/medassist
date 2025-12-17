import sys
sys.path.append("../..")

import os
from dotenv import load_dotenv
from openai import OpenAI
from tqdm import tqdm


load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

models = {
    'GPT 4o': 'gpt-4o-2024-11-20',
    'GPT o3': 'o3-2025-04-16',
    'GPT 4.1': 'gpt-4.1-2025-04-14',
    'GPT o4-mini': 'o4-mini-2025-04-16',
    'GPT 4.1-mini': 'gpt-4.1-mini-2025-04-14'
}

model_name = models['GPT 4o']

client = OpenAI(api_key=api_key)

def call_gpt(messages: list, model_name: str = model_name, count_tokens: bool = False, system_message: str = "You are a helpful assistant.") -> (str, bool):
    """
    output: Tuple containing the response/error string and a boolean indicating success or failure
    """
    # add the system message to the messages at the beginning
    messages.insert(0, {"role": "system", "content": system_message})

    try:
        response = client.chat.completions.create(
            model=models[model_name],
            messages=messages,
        )

        output = response.choices[0].message.content

        if count_tokens:
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            return output, False, input_tokens, output_tokens
        else:
            return output, False


    except Exception as e:
        # Extract and return detailed error information
        print(e)
        error_info = {}

        if hasattr(e, 'response'):
            error_details = e.response.json()
            error_message = error_details.get('error', {}).get('message', 'No error message provided.')
            error_code = error_details.get('error', {}).get('code', 'No error code provided.')
            content_filter_result = error_details.get('error', {}).get('innererror', {}).get('content_filter_result', {})

            # Extract filter details
            error_info = {
                'error_code': error_code,
                'error_message': error_message,
                'content_filter_result': {
                    'hate': content_filter_result.get('hate', {}),
                    'violence': content_filter_result.get('violence', {}),
                    'self_harm': content_filter_result.get('self_harm', {}),
                    'sexual': content_filter_result.get('sexual', {}),
                    'jailbreak': content_filter_result.get('jailbreak', {}),
                }
            }
        else:
            # Handle cases where there isn't a detailed error response
            error_info = {
                'error_code': 'unknown_error',
                'error_message': str(e),
                'content_filter_result': {}
            }

            # convert the error_info dictionary to a string
            error_info = str(error_info)

        if count_tokens:
            return error_info, True, input_tokens, output_tokens
        else:
            return error_info, True
    

def call_gpt_raw(messages: list, model_name: str = model_name, count_tokens: bool = False, system_message: str = "You are a helpful assistant.") -> (str, bool):
    """
    output: Tuple containing the response/error string and a boolean indicating success or failure
    """
    # add the system message to the messages at the beginning
    messages.insert(0, {"role": "system", "content": system_message})

    try:
        response = client.chat.completions.create(
            model=models[model_name],
            messages=messages,
        )

        output = response.choices[0].message

        if count_tokens:
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            return output, False, input_tokens, output_tokens
        else:
            return output, False


    except Exception as e:
        # Extract and return detailed error information
        print(e)
        error_info = {}

        if hasattr(e, 'response'):
            error_details = e.response.json()
            error_message = error_details.get('error', {}).get('message', 'No error message provided.')
            error_code = error_details.get('error', {}).get('code', 'No error code provided.')
            content_filter_result = error_details.get('error', {}).get('innererror', {}).get('content_filter_result', {})

            # Extract filter details
            error_info = {
                'error_code': error_code,
                'error_message': error_message,
                'content_filter_result': {
                    'hate': content_filter_result.get('hate', {}),
                    'violence': content_filter_result.get('violence', {}),
                    'self_harm': content_filter_result.get('self_harm', {}),
                    'sexual': content_filter_result.get('sexual', {}),
                    'jailbreak': content_filter_result.get('jailbreak', {}),
                }
            }
        else:
            # Handle cases where there isn't a detailed error response
            error_info = {
                'error_code': 'unknown_error',
                'error_message': str(e),
                'content_filter_result': {}
            }

            # convert the error_info dictionary to a string
            error_info = str(error_info)

        if count_tokens:
            return error_info, True, input_tokens, output_tokens
        else:
            return error_info, True



def call_gpt_parsed(input_text: str, json_schema, model_name: str = model_name, system_message: str = "You are a helpful assistant."):
    """
    Call GPT with structured output parsing, matching the planning agent implementation
    """
    try:
        response = client.responses.parse(
            model=models[model_name],
            instructions=system_message,
            input=input_text,
            text_format=json_schema,
        )
        
        return response.output_parsed
    except Exception as e:
        print(f"Structured output parsing failed: {e}")
        raise e

    

def construct_messages(input_message=None):
    messages = []
    
    # If input is a string, create a single user message
    if isinstance(input_message, str):
        messages.append({"role": "user", "content": input_message})
    
    # If input is a list, process it as message history
    elif isinstance(input_message, list):
        for msg in input_message:
            # Check if it's already in the right format
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                messages.append(msg)
            # Check if it's in the format from chat.py
            elif isinstance(msg, dict) and "sender" in msg and "text" in msg:
                role = "user" if msg["sender"] == "user" else "assistant"
                messages.append({"role": role, "content": msg["text"]})
    
    return messages


if __name__ == "__main__":
    messages = [
        {"role": "user", "content": "Hello, how are you?"}
    ]
    response = call_gpt(messages, count_tokens=True)
    print(response)
    print('\n\n')
    