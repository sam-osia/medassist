from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Type

from pydantic import BaseModel


class ToolCallMeta(BaseModel):
    """Cost/token metadata returned alongside every tool result."""
    cost: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    api_key_name: Optional[str] = None
    api_key_id: Optional[str] = None


def meta_from_llm_result(llm_result) -> ToolCallMeta:
    """Extract ToolCallMeta from an LLMResult."""
    return ToolCallMeta(
        cost=getattr(llm_result, 'cost', 0.0),
        input_tokens=getattr(llm_result, 'input_tokens', 0),
        output_tokens=getattr(llm_result, 'output_tokens', 0),
        api_key_name=getattr(llm_result, 'api_key_name', None),
        api_key_id=getattr(llm_result, 'api_key_id', None),
    )


class Tool(ABC):
    """Base class for all tools in the supervisor worker network."""

    # Subclasses set these as class attributes:
    #   Input = MyToolInput          (required)
    #   Output = MyToolOutput        (optional — only for structured outputs)
    Input: Type[BaseModel]
    Output: Optional[Type[BaseModel]] = None

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the name of the tool."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Return the description of the tool (for LLM tool discovery)."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Return human-readable display name for the UI."""
        pass

    @property
    @abstractmethod
    def user_description(self) -> str:
        """Return user-facing description (more verbose than LLM description)."""
        pass

    @property
    def role(self) -> str:
        """Tool role: 'compute', 'reader', or 'infrastructure'. Override in subclasses."""
        return "compute"

    @property
    def uses_llm(self) -> bool:
        """Whether this tool makes LLM calls. Override to True in LLM-based tools."""
        return False

    @property
    def input_help(self) -> Dict[str, str]:
        """Return help text for input fields. Override to provide field-specific guidance."""
        return {}

    @property
    def parameters(self) -> Dict[str, Any]:
        """Auto-derived JSON Schema from Input model."""
        return self.Input.model_json_schema()

    @property
    def returns(self) -> dict:
        """Auto-derived JSON Schema from Output model, or _returns_schema() for primitives."""
        if self.Output is not None:
            return self.Output.model_json_schema()
        return self._returns_schema()

    def _returns_schema(self) -> dict:
        """Override in subclasses that return primitives (str, List[int], bool, etc.)."""
        return {}

    @abstractmethod
    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        """Execute the tool functionality."""
        pass

    def to_dict(self) -> Dict[str, Any]:
        """Convert the tool to a dictionary format for OpenAI function calling."""
        return {
            "type": "function",
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters
        }
