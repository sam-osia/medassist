import json
import logging
import os
from typing import List, Dict, Any, Optional
from threading import Lock
from pathlib import Path
import datetime

logger = logging.getLogger(__name__)

# Path to user credentials file
USERS_FILE = Path(__file__).parent.parent.parent / "users" / ".login_info"


class UserCache:
    """Thread-safe singleton cache for user data."""
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
                self._users_cache = None
                self._initialized = True

    def get_users_cache(self) -> Dict[str, Any]:
        """Get cached users, loading them if necessary."""
        if self._users_cache is None:
            with self._lock:
                if self._users_cache is None:  # Double-check lock pattern
                    self._users_cache = self._load_all_users()
        return self._users_cache

    def invalidate(self):
        """Clear the cached users."""
        with self._lock:
            self._users_cache = None

    def _load_all_users(self) -> Dict[str, Any]:
        """Load all users from the .login_info JSON file."""
        if not USERS_FILE.exists():
            # Create empty users file if it doesn't exist
            USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
            data = {"users": []}
            with open(USERS_FILE, 'w') as f:
                json.dump(data, f, indent=2)
            return data

        try:
            with open(USERS_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Error reading users file: {e}")
            return {"users": []}

    def _save_users_to_disk(self, users_data: Dict[str, List[Dict]]) -> None:
        """Save users to the .login_info JSON file."""
        USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(USERS_FILE, 'w') as f:
            json.dump(users_data, f, indent=2)
        logger.info("Users file saved successfully")

    def get_user(self, username: str) -> Optional[Dict]:
        """Retrieve a user by username."""
        users_data = self.get_users_cache()
        for user in users_data.get("users", []):
            if user.get("username") == username:
                return user
        return None

    def list_users(self, include_sensitive: bool = False) -> List[Dict[str, Any]]:
        """
        Get all users with summary information.

        Args:
            include_sensitive: If False, sanitize by removing password_hash and salt
        """
        users_data = self.get_users_cache()
        users = users_data.get("users", [])

        if include_sensitive:
            return users

        # Return sanitized view
        sanitized = []
        for user in users:
            sanitized.append({
                "username": user.get("username"),
                "is_admin": user.get("is_admin", False),
                "allowed_datasets": user.get("allowed_datasets", []),
                "created_date": user.get("created_date")
            })
        return sanitized

    def save_user(self, username: str, user_data: Dict[str, Any]) -> bool:
        """Create or update a user."""
        try:
            users_data = self.get_users_cache()

            # Check if user exists
            user_index = None
            for i, user in enumerate(users_data["users"]):
                if user.get("username") == username:
                    user_index = i
                    break

            # Set username
            user_data["username"] = username

            # Set created_date if new user
            if user_index is None:
                if "created_date" not in user_data:
                    user_data["created_date"] = datetime.datetime.now().isoformat()

            # Ensure required fields exist
            if "is_admin" not in user_data:
                user_data["is_admin"] = False
            if "allowed_datasets" not in user_data:
                user_data["allowed_datasets"] = []

            # Update or append
            if user_index is not None:
                users_data["users"][user_index] = user_data
            else:
                users_data["users"].append(user_data)

            # Save to disk and update cache
            self._save_users_to_disk(users_data)
            with self._lock:
                self._users_cache = users_data

            logger.info(f"Saved user: {username}")
            return True

        except Exception as e:
            logger.error(f"Error saving user {username}: {e}")
            return False

    def delete_user(self, username: str) -> bool:
        """Delete a user."""
        try:
            users_data = self.get_users_cache()

            # Find and remove user
            original_count = len(users_data["users"])
            users_data["users"] = [u for u in users_data["users"] if u.get("username") != username]

            if len(users_data["users"]) == original_count:
                logger.warning(f"User {username} not found for deletion")
                return False

            # Save to disk and update cache
            self._save_users_to_disk(users_data)
            with self._lock:
                self._users_cache = users_data

            logger.info(f"Deleted user: {username}")
            return True

        except Exception as e:
            logger.error(f"Error deleting user {username}: {e}")
            return False

    def user_exists(self, username: str) -> bool:
        """Check if a user exists."""
        return self.get_user(username) is not None

    def add_dataset_access(self, username: str, dataset_name: str) -> bool:
        """Add dataset access for a user."""
        try:
            user = self.get_user(username)
            if not user:
                logger.warning(f"User {username} not found")
                return False

            allowed_datasets = user.get("allowed_datasets", [])
            if dataset_name not in allowed_datasets:
                allowed_datasets.append(dataset_name)
                user["allowed_datasets"] = allowed_datasets
                return self.save_user(username, user)

            return True  # Already has access

        except Exception as e:
            logger.error(f"Error adding dataset access for {username}: {e}")
            return False

    def remove_dataset_access(self, username: str, dataset_name: str) -> bool:
        """Remove dataset access for a user."""
        try:
            user = self.get_user(username)
            if not user:
                logger.warning(f"User {username} not found")
                return False

            allowed_datasets = user.get("allowed_datasets", [])
            if dataset_name in allowed_datasets:
                allowed_datasets.remove(dataset_name)
                user["allowed_datasets"] = allowed_datasets
                return self.save_user(username, user)

            return True  # Already doesn't have access

        except Exception as e:
            logger.error(f"Error removing dataset access for {username}: {e}")
            return False

    def get_user_datasets(self, username: str) -> List[str]:
        """Get list of datasets a user has access to."""
        user = self.get_user(username)
        if not user:
            return []
        return user.get("allowed_datasets", [])


# Initialize the global cache instance
_cache = UserCache()


# Public API functions
def get_user(username: str) -> Optional[Dict[str, Any]]:
    """Retrieve a user by username."""
    return _cache.get_user(username)


def list_users(include_sensitive: bool = False) -> List[Dict[str, Any]]:
    """Get all users with summary information."""
    return _cache.list_users(include_sensitive)


def save_user(username: str, user_data: Dict[str, Any]) -> bool:
    """Create or update a user."""
    return _cache.save_user(username, user_data)


def delete_user(username: str) -> bool:
    """Delete a user."""
    return _cache.delete_user(username)


def user_exists(username: str) -> bool:
    """Check if a user exists."""
    return _cache.user_exists(username)


def add_dataset_access(username: str, dataset_name: str) -> bool:
    """Add dataset access for a user."""
    return _cache.add_dataset_access(username, dataset_name)


def remove_dataset_access(username: str, dataset_name: str) -> bool:
    """Remove dataset access for a user."""
    return _cache.remove_dataset_access(username, dataset_name)


def get_user_datasets(username: str) -> List[str]:
    """Get list of datasets a user has access to."""
    return _cache.get_user_datasets(username)


def invalidate_user_cache():
    """Force reload of user cache."""
    _cache.invalidate()