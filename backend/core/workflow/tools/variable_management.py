"""Variable management tools for workflow data aggregation.

These tools allow workflows to accumulate data across loop iterations
and format aggregated data for downstream LLM consumption.
"""

from typing import Any, Dict, List

from jinja2 import Template

from core.workflow.tools.base import Tool
from core.workflow.schemas.tool_inputs import (
    InitStoreInput, StoreAppendInput, StoreReadInput, BuildTextInput
)


class InitStore(Tool):
    """Create an empty store for accumulating data across workflow steps."""

    def __init__(self, dataset: str = None):
        # Dataset not used but kept for consistency with other tools
        self.dataset = dataset

    @property
    def name(self) -> str:
        return "init_store"

    @property
    def description(self) -> str:
        return "Create an empty store for accumulating data. Use 'list' for collecting items, 'text' for concatenating strings, or 'dict' for key-value pairs."

    @property
    def display_name(self) -> str:
        return "Initialize Store"

    @property
    def user_description(self) -> str:
        return "Create an empty store for accumulating data across workflow steps. Stores can be of type 'list' (for collecting items), 'text' (for concatenating strings), or 'dict' (for key-value storage)."

    @property
    def category(self) -> str:
        return "variable_management"

    @property
    def returns(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "store_name": {
                    "type": "string",
                    "description": "The name of the created store"
                },
                "type": {
                    "type": "string",
                    "description": "The type of the store (list, text, or dict)"
                },
                "initialized": {
                    "type": "boolean",
                    "description": "Whether the store was successfully initialized"
                }
            },
            "required": ["store_name", "type", "initialized"]
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Unique identifier for the store"
                },
                "type": {
                    "type": "string",
                    "enum": ["list", "text", "dict"],
                    "description": "Type of store: 'list' for arrays, 'text' for string concatenation, 'dict' for key-value pairs"
                }
            },
            "required": ["name", "type"],
            "additionalProperties": False
        }

    def __call__(self, inputs: InitStoreInput) -> Dict[str, Any]:
        # Tool is stateless - returns declaration of intent
        # Actual store creation is handled by the executor
        return {
            "store_name": inputs.name,
            "type": inputs.type,
            "initialized": True
        }


class StoreAppend(Tool):
    """Add a value to an existing store."""

    def __init__(self, dataset: str = None):
        self.dataset = dataset

    @property
    def name(self) -> str:
        return "store_append"

    @property
    def description(self) -> str:
        return "Add a value to a store. For list: appends item. For text: concatenates with separator. For dict: sets key=value (key required)."

    @property
    def display_name(self) -> str:
        return "Append to Store"

    @property
    def user_description(self) -> str:
        return "Add a value to an existing store. Behavior depends on store type: list stores append the value, text stores concatenate with a separator, dict stores require a key and set key=value."

    @property
    def category(self) -> str:
        return "variable_management"

    @property
    def returns(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "store_name": {
                    "type": "string",
                    "description": "The name of the store that was appended to"
                },
                "success": {
                    "type": "boolean",
                    "description": "Whether the append operation was successful"
                }
            },
            "required": ["store_name", "success"]
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "store": {
                    "type": "string",
                    "description": "Name of the store to append to"
                },
                "value": {
                    "description": "Value to add to the store (any JSON-serializable type)"
                },
                "key": {
                    "type": "string",
                    "description": "Key for dict stores (required for dict type, ignored for list/text)"
                },
                "separator": {
                    "type": "string",
                    "default": "\\n",
                    "description": "Separator for text stores when concatenating (default: newline)"
                }
            },
            "required": ["store", "value"],
            "additionalProperties": False
        }

    def __call__(self, inputs: StoreAppendInput) -> Dict[str, Any]:
        # Tool is stateless - returns declaration of intent
        # Actual append operation is handled by the executor
        return {
            "store_name": inputs.store,
            "success": True
        }


class StoreRead(Tool):
    """Read the contents of a store."""

    def __init__(self, dataset: str = None):
        self.dataset = dataset

    @property
    def name(self) -> str:
        return "store_read"

    @property
    def description(self) -> str:
        return "Read the contents of a store. Returns the full store contents, or a specific key for dict stores."

    @property
    def display_name(self) -> str:
        return "Read Store"

    @property
    def user_description(self) -> str:
        return "Read the contents of a store. For list stores, returns the array of items. For text stores, returns the concatenated string. For dict stores, returns the full dict or a specific key's value if key is provided."

    @property
    def category(self) -> str:
        return "variable_management"

    @property
    def returns(self) -> dict:
        return {
            "description": "The contents of the store. Type depends on store type: array for list, string for text, object for dict."
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "store": {
                    "type": "string",
                    "description": "Name of the store to read from"
                },
                "key": {
                    "type": "string",
                    "description": "For dict stores: specific key to retrieve (optional, returns full dict if not provided)"
                }
            },
            "required": ["store"],
            "additionalProperties": False
        }

    def __call__(self, inputs: StoreReadInput) -> Any:
        # Tool is stateless - returns declaration of intent
        # Actual read operation is handled by the executor
        # For now, return a placeholder that indicates what should be read
        return {
            "store_name": inputs.store,
            "key": inputs.key,
            "_pending_read": True
        }


class BuildText(Tool):
    """Format list/store data into a text string for LLM consumption."""

    def __init__(self, dataset: str = None):
        self.dataset = dataset

    @property
    def name(self) -> str:
        return "build_text"

    @property
    def description(self) -> str:
        return "Format a list or store data into a text string. Use 'join' mode for simple concatenation, or provide a Jinja2 template for custom formatting."

    @property
    def display_name(self) -> str:
        return "Build Text"

    @property
    def user_description(self) -> str:
        return "Format list or store data into a text string suitable for LLM consumption. Supports 'join' mode for simple concatenation with a separator, or custom Jinja2 templates for complex formatting. Templates receive the data as 'items' variable."

    @property
    def category(self) -> str:
        return "variable_management"

    @property
    def returns(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The formatted text output"
                }
            },
            "required": ["text"]
        }

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "source": {
                    "description": "Store name or direct list/array data to format"
                },
                "mode": {
                    "type": "string",
                    "enum": ["join"],
                    "default": "join",
                    "description": "Formatting mode: 'join' concatenates items with separator"
                },
                "template": {
                    "type": "string",
                    "description": "Jinja2 template for custom formatting. Receives data as 'items' variable. If provided, overrides mode."
                },
                "separator": {
                    "type": "string",
                    "default": "\\n",
                    "description": "Separator for 'join' mode (default: newline)"
                }
            },
            "required": ["source"],
            "additionalProperties": False
        }

    def __call__(self, inputs: BuildTextInput) -> Dict[str, str]:
        source = inputs.source

        # If template is provided, use Jinja2 rendering
        if inputs.template:
            # Ensure source is a list for template rendering
            items = source if isinstance(source, list) else [source]
            template = Template(inputs.template)
            text = template.render(items=items)
            return {"text": text}

        # Default: join mode
        if isinstance(source, list):
            # Convert each item to string and join
            text_items = []
            for item in source:
                if isinstance(item, str):
                    text_items.append(item)
                elif isinstance(item, dict):
                    # For dicts, try to extract a reasonable string representation
                    # Common patterns: look for 'text', 'content', 'reasoning', 'value'
                    for key in ['text', 'content', 'reasoning', 'value', 'summary']:
                        if key in item:
                            text_items.append(str(item[key]))
                            break
                    else:
                        # Fallback to string representation
                        text_items.append(str(item))
                else:
                    text_items.append(str(item))
            text = inputs.separator.join(text_items)
        elif isinstance(source, str):
            text = source
        else:
            text = str(source)

        return {"text": text}
