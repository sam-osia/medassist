"""File-backed persistence for user-defined custom tools.

Storage: custom_tools/{tool_id}/tool.json (relative to backend root).
Follows the ConversationCache singleton pattern.
"""

import json
import logging
import os
import shutil
from threading import Lock
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

CUSTOM_TOOLS_DIR = "custom_tools"


class CustomToolCache:
    """Thread-safe singleton cache for custom tool definitions."""

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
                self._cache: Optional[Dict[str, Dict[str, Any]]] = None
                self._initialized = True

    def _get_cache(self) -> Dict[str, Dict[str, Any]]:
        if self._cache is None:
            with self._lock:
                if self._cache is None:
                    self._cache = self._load_all()
        return self._cache

    def invalidate(self):
        with self._lock:
            self._cache = None

    def _load_all(self) -> Dict[str, Dict[str, Any]]:
        logger.info("Loading custom tools from disk...")
        tools = {}
        if not os.path.exists(CUSTOM_TOOLS_DIR):
            os.makedirs(CUSTOM_TOOLS_DIR, exist_ok=True)
            return tools

        for item in os.listdir(CUSTOM_TOOLS_DIR):
            item_path = os.path.join(CUSTOM_TOOLS_DIR, item)
            if not os.path.isdir(item_path):
                continue
            tool_path = os.path.join(item_path, "tool.json")
            if not os.path.exists(tool_path):
                continue
            try:
                with open(tool_path, "r") as f:
                    data = json.load(f)
                tools[item] = data
            except Exception as e:
                logger.error(f"Error loading custom tool {item}: {e}")

        logger.info(f"Loaded {len(tools)} custom tools from disk")
        return tools

    def save(self, tool_id: str, data: Dict[str, Any]):
        folder = os.path.join(CUSTOM_TOOLS_DIR, tool_id)
        os.makedirs(folder, exist_ok=True)
        tool_path = os.path.join(folder, "tool.json")
        with open(tool_path, "w") as f:
            json.dump(data, f, indent=2)
        with self._lock:
            if self._cache is not None:
                self._cache[tool_id] = data

    def get(self, tool_id: str) -> Optional[Dict[str, Any]]:
        return self._get_cache().get(tool_id)

    def list_all(self) -> List[Dict[str, Any]]:
        return list(self._get_cache().values())

    def delete(self, tool_id: str) -> bool:
        try:
            folder = os.path.join(CUSTOM_TOOLS_DIR, tool_id)
            if os.path.isdir(folder):
                shutil.rmtree(folder)
            with self._lock:
                if self._cache is not None and tool_id in self._cache:
                    del self._cache[tool_id]
            return True
        except Exception as e:
            logger.error(f"Error deleting custom tool {tool_id}: {e}")
            return False

    def find_by_name_and_user(self, tool_name: str, username: str) -> Optional[Dict[str, Any]]:
        for tool in self._get_cache().values():
            if tool.get("tool_name") == tool_name and tool.get("created_by") == username:
                return tool
        return None


# Global instance
_cache = CustomToolCache()


def save_custom_tool(tool_id: str, data: Dict[str, Any]):
    _cache.save(tool_id, data)


def get_custom_tool(tool_id: str, current_user: str) -> Optional[Dict[str, Any]]:
    """Get a custom tool with ownership check. Admins bypass ownership."""
    tool = _cache.get(tool_id)
    if not tool:
        return None
    from core.auth import permissions
    if permissions.is_admin(current_user):
        return tool
    if tool.get("created_by") != current_user:
        return None
    return tool


def list_custom_tools_for_user(username: str, current_user: str) -> List[Dict[str, Any]]:
    """List tools created by `username`. Requires current_user == username or admin."""
    from core.auth import permissions
    if current_user != username and not permissions.is_admin(current_user):
        return []
    return [t for t in _cache.list_all() if t.get("created_by") == username]


def list_own_custom_tools(current_user: str) -> List[Dict[str, Any]]:
    """List tools created by current_user."""
    return [t for t in _cache.list_all() if t.get("created_by") == current_user]


def delete_custom_tool(tool_id: str, current_user: str) -> bool:
    """Delete a custom tool with ownership check. Admins bypass ownership."""
    tool = _cache.get(tool_id)
    if not tool:
        return False
    from core.auth import permissions
    if not permissions.is_admin(current_user) and tool.get("created_by") != current_user:
        return False
    return _cache.delete(tool_id)


def find_custom_tool_by_name(tool_name: str, username: str) -> Optional[Dict[str, Any]]:
    """Find a custom tool by name and user (for collision checking)."""
    return _cache.find_by_name_and_user(tool_name, username)


def invalidate_cache():
    _cache.invalidate()
