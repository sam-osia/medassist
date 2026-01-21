"""Base agent class for workflow agents."""

from abc import ABC, abstractmethod
from pydantic import BaseModel


class BaseAgent(ABC):
    """Base class for all workflow agents."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Agent identifier."""
        pass

    @abstractmethod
    def run(self, inputs: BaseModel) -> BaseModel:
        """Execute the agent with given inputs."""
        pass
