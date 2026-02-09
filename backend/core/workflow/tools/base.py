from abc import ABC, abstractmethod
from typing import Any, Dict

from pydantic import BaseModel

class Tool(ABC):
    """Base class for all tools in the supervisor worker network."""

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
    def input_help(self) -> Dict[str, str]:
        """Return help text for input fields. Override to provide field-specific guidance."""
        return {}

    @property
    @abstractmethod
    def returns(self) -> dict:
        """Return the returns schema for the tool."""
        pass


    @property
    @abstractmethod
    def parameters(self) -> Dict[str, Any]:
        """Return the parameters schema for the tool."""
        pass


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