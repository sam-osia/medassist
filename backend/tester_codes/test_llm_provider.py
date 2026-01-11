import sys

sys.path.append('../')

from core.llm_provider.providers.openai_provider import main as openai_provider
from core.llm_provider.providers.anthropic_provider import main as anthropic_provider
from core.llm_provider.providers.google_provider import main as google_provider


if __name__ == '__main__':
    # openai_provider()
    # anthropic_provider()
    google_provider()
