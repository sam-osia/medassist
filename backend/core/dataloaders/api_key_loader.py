import json
import logging
import uuid
import datetime
from typing import List, Dict, Any, Optional
from threading import Lock
from pathlib import Path

logger = logging.getLogger(__name__)

KEYS_FILE = Path(__file__).parent.parent.parent / "api_keys" / "keys.json"


class ApiKeyCache:
    """Thread-safe singleton cache for API key data."""
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
                self._cache = None
                self._initialized = True

    def _get_cache(self) -> Dict[str, Any]:
        if self._cache is None:
            with self._lock:
                if self._cache is None:
                    self._cache = self._load_all()
        return self._cache

    def invalidate(self):
        with self._lock:
            self._cache = None

    def _load_all(self) -> Dict[str, Any]:
        if not KEYS_FILE.exists():
            KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
            data = {"keys": [], "assignments": []}
            with open(KEYS_FILE, 'w') as f:
                json.dump(data, f, indent=2)
            return data
        try:
            with open(KEYS_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Error reading keys file: {e}")
            return {"keys": [], "assignments": []}

    def _save_to_disk(self, data: Dict[str, Any]) -> None:
        KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(KEYS_FILE, 'w') as f:
            json.dump(data, f, indent=2)

    # ── Key CRUD ──

    def list_keys(self) -> List[Dict]:
        return self._get_cache().get("keys", [])

    def get_key(self, key_id: str) -> Optional[Dict]:
        for key in self.list_keys():
            if key.get("key_id") == key_id:
                return key
        return None

    def get_key_by_name(self, key_name: str) -> Optional[Dict]:
        for key in self.list_keys():
            if key.get("key_name") == key_name:
                return key
        return None

    def key_name_exists(self, key_name: str) -> bool:
        return self.get_key_by_name(key_name) is not None

    def save_key(self, data: Dict[str, Any]) -> Dict:
        cache = self._get_cache()
        # If key_id exists, update; otherwise create
        key_id = data.get("key_id")
        if key_id:
            for i, key in enumerate(cache["keys"]):
                if key["key_id"] == key_id:
                    cache["keys"][i].update(data)
                    self._save_to_disk(cache)
                    with self._lock:
                        self._cache = cache
                    return cache["keys"][i]

        # New key
        data["key_id"] = str(uuid.uuid4())
        data["created_date"] = datetime.datetime.now().isoformat()
        cache["keys"].append(data)
        self._save_to_disk(cache)
        with self._lock:
            self._cache = cache
        return data

    def delete_key(self, key_id: str) -> bool:
        cache = self._get_cache()
        original_count = len(cache["keys"])
        cache["keys"] = [k for k in cache["keys"] if k.get("key_id") != key_id]
        if len(cache["keys"]) == original_count:
            return False
        # Also remove assignments for this key
        cache["assignments"] = [a for a in cache["assignments"] if a.get("key_id") != key_id]
        self._save_to_disk(cache)
        with self._lock:
            self._cache = cache
        return True

    # ── Assignments ──

    def list_assignments(self) -> List[Dict]:
        return self._get_cache().get("assignments", [])

    def get_user_keys(self, username: str) -> List[Dict]:
        """Return full key records for a user's assignments."""
        assignments = self.list_assignments()
        user_key_ids = [a["key_id"] for a in assignments if a.get("username") == username]
        return [k for k in self.list_keys() if k.get("key_id") in user_key_ids]

    def assign_key(self, username: str, key_id: str) -> bool:
        cache = self._get_cache()
        # Check not already assigned
        for a in cache["assignments"]:
            if a.get("username") == username and a.get("key_id") == key_id:
                return True  # Already assigned
        cache["assignments"].append({"username": username, "key_id": key_id})
        self._save_to_disk(cache)
        with self._lock:
            self._cache = cache
        return True

    def unassign_key(self, username: str, key_id: str) -> bool:
        cache = self._get_cache()
        original_count = len(cache["assignments"])
        cache["assignments"] = [
            a for a in cache["assignments"]
            if not (a.get("username") == username and a.get("key_id") == key_id)
        ]
        if len(cache["assignments"]) == original_count:
            return False
        self._save_to_disk(cache)
        with self._lock:
            self._cache = cache
        return True


# Singleton instance
_cache = ApiKeyCache()


# Public API
def list_keys() -> List[Dict]:
    return _cache.list_keys()

def get_key(key_id: str) -> Optional[Dict]:
    return _cache.get_key(key_id)

def get_key_by_name(key_name: str) -> Optional[Dict]:
    return _cache.get_key_by_name(key_name)

def key_name_exists(key_name: str) -> bool:
    return _cache.key_name_exists(key_name)

def save_key(data: Dict[str, Any]) -> Dict:
    return _cache.save_key(data)

def delete_key(key_id: str) -> bool:
    return _cache.delete_key(key_id)

def list_assignments() -> List[Dict]:
    return _cache.list_assignments()

def get_user_keys(username: str) -> List[Dict]:
    return _cache.get_user_keys(username)

def assign_key(username: str, key_id: str) -> bool:
    return _cache.assign_key(username, key_id)

def unassign_key(username: str, key_id: str) -> bool:
    return _cache.unassign_key(username, key_id)

def invalidate_cache():
    _cache.invalidate()
