from pathlib import Path
from typing import Dict, Any
import pickle
import logging
from threading import Lock

logger = logging.getLogger(__name__)


class CaboodleCache:
    """Thread-safe singleton cache for Caboodle dictionary."""
    _instance = None
    _lock = Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return

        with self._lock:
            if not self._initialized:
                self._dictionary_cache = None
                self._initialized = True

    def get_dictionary_cache(self) -> Dict[str, Dict[str, Any]]:
        """Get cached dictionary, loading if necessary."""
        if self._dictionary_cache is None:
            with self._lock:
                if self._dictionary_cache is None:  # Double-check lock pattern
                    self._dictionary_cache = self._load_dictionary()
        return self._dictionary_cache

    def invalidate(self):
        """Clear cached dictionary."""
        with self._lock:
            self._dictionary_cache = None

    def _load_dictionary(self) -> Dict[str, Dict[str, Any]]:
        """Load the caboodle dictionary from pickle file."""
        logger.info("Loading Caboodle dictionary from disk...")

        pickle_path = Path(__file__).parent.parent.parent / "caboodle" / "caboodle_dictionary.pkl"

        if not pickle_path.exists():
            logger.error(f"Caboodle dictionary not found at {pickle_path}")
            raise FileNotFoundError(f"Caboodle dictionary not found at {pickle_path}")

        try:
            with open(pickle_path, "rb") as f:
                dictionary = pickle.load(f)

            logger.info(f"Loaded Caboodle dictionary with {len(dictionary)} tables")
            return dictionary
        except Exception as e:
            logger.error(f"Error loading Caboodle dictionary: {e}")
            raise

    def get_full_dictionary(self) -> Dict[str, Dict[str, Any]]:
        """
        Return the complete Caboodle dictionary.

        Returns:
            Full dictionary with all tables and their data
        """
        return self.get_dictionary_cache()


# Initialize the global cache instance
_cache = CaboodleCache()


def get_full_dictionary() -> Dict[str, Dict[str, Any]]:
    """Get the complete Caboodle dictionary."""
    return _cache.get_full_dictionary()


def invalidate_caboodle_cache():
    """Force reload of Caboodle cache."""
    _cache.invalidate()


def process_llm_query(query: str) -> Dict[str, Any]:
    """
    Process an LLM query about the Caboodle dictionary.

    Args:
        query: User's question about the data dictionary

    Returns:
        Response dictionary with status and message
    """
    from core.caboodle.caboodle_retreival_agent import get_candidate_tables, evaluate_candidate_table

    print(f"[Caboodle LLM Query]: {query}")

    try:
        # Stage 1: Get candidate tables
        candidate_tables = get_candidate_tables(query)

        # Stage 2: Evaluate each candidate table
        results = {}
        for table_name in candidate_tables:
            selected_variables = evaluate_candidate_table(table_name, query)
            if selected_variables:
                results[table_name] = selected_variables

        return {
            "status": "success",
            "results": results,
            "query": query
        }
    except Exception as e:
        logger.error(f"Error processing LLM query: {e}")
        return {
            "status": "error",
            "message": str(e),
            "query": query
        }
