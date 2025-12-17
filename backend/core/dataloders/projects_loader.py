import json
import logging
import os
from typing import List, Dict, Any, Optional
from threading import Lock
import datetime
import shutil

logger = logging.getLogger(__name__)

# Configuration
PROJECTS_DIR = "projects"


class ProjectCache:
    """Thread-safe singleton cache for project data."""
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
                self._projects_cache = None
                self._initialized = True

    def get_projects_cache(self) -> Dict[str, Any]:
        """Get cached projects, loading them if necessary."""
        if self._projects_cache is None:
            with self._lock:
                if self._projects_cache is None:  # Double-check lock pattern
                    self._projects_cache = self._load_all_projects()
        return self._projects_cache

    def invalidate(self):
        """Clear the cached projects."""
        with self._lock:
            self._projects_cache = None

    def _load_all_projects(self) -> Dict[str, Any]:
        """Load all projects from disk."""
        logger.info("Loading projects from disk...")

        projects = {}

        if not os.path.exists(PROJECTS_DIR):
            os.makedirs(PROJECTS_DIR, exist_ok=True)
            logger.info(f"Created projects directory: {PROJECTS_DIR}")
            return projects

        for project_name in os.listdir(PROJECTS_DIR):
            project_path = os.path.join(PROJECTS_DIR, project_name)
            if not os.path.isdir(project_path):
                continue

            metadata_path = os.path.join(project_path, "metadata.json")

            if not os.path.exists(metadata_path):
                continue

            try:
                with open(metadata_path, 'r') as f:
                    project_data = json.load(f)

                # Validate required fields
                required_fields = ['project_name', 'owner', 'summary', 'created_date']
                if all(field in project_data for field in required_fields):
                    projects[project_name] = project_data
                else:
                    logger.warning(f"Project {project_name} missing required fields, skipping")

            except Exception as e:
                logger.error(f"Error loading project {project_name}: {e}")
                continue

        logger.info(f"Loaded {len(projects)} projects from disk")
        return projects

    def save_project(self, project_name: str, project_data: Dict[str, Any], created_by: str = None) -> bool:
        """Save a project to disk and update cache."""
        try:
            # Ensure projects directory exists
            os.makedirs(PROJECTS_DIR, exist_ok=True)

            # Add timestamps
            current_time = datetime.datetime.now().isoformat()
            project_data['project_name'] = project_name
            project_data['last_modified_date'] = current_time

            # Set created_date and owner if it's a new project
            if 'created_date' not in project_data:
                project_data['created_date'] = current_time
                if created_by:
                    project_data['owner'] = created_by

            # Ensure allowed_users exists
            if 'allowed_users' not in project_data:
                project_data['allowed_users'] = []

            # Ensure contacts is a list
            if 'contacts' not in project_data:
                project_data['contacts'] = []

            # Ensure references is a list
            if 'references' not in project_data:
                project_data['references'] = []

            # Create project directory
            project_path = os.path.join(PROJECTS_DIR, project_name)
            os.makedirs(project_path, exist_ok=True)

            # Save metadata to disk
            metadata_path = os.path.join(project_path, "metadata.json")
            with open(metadata_path, 'w') as f:
                json.dump(project_data, f, indent=2)

            # Update cache
            with self._lock:
                if self._projects_cache is not None:
                    self._projects_cache[project_name] = project_data

            logger.info(f"Saved project: {project_name}")
            return True

        except Exception as e:
            logger.error(f"Error saving project {project_name}: {e}")
            return False

    def get_project(self, project_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific project."""
        projects = self.get_projects_cache()
        return projects.get(project_name)

    def list_projects(self) -> List[Dict[str, Any]]:
        """Get all projects with summary information."""
        projects = self.get_projects_cache()

        project_list = []
        for project_name, project_data in projects.items():
            project_list.append({
                "project_name": project_name,
                "owner": project_data.get("owner"),
                "summary": project_data.get("summary"),
                "created_date": project_data.get("created_date")
            })

        # Sort by created date (newest first)
        project_list.sort(
            key=lambda x: x.get("created_date", ""),
            reverse=True
        )

        return project_list

    def delete_project(self, project_name: str) -> bool:
        """Delete a project from disk and cache."""
        try:
            # Remove from disk
            project_path = os.path.join(PROJECTS_DIR, project_name)
            if os.path.exists(project_path):
                shutil.rmtree(project_path)

            # Remove from cache
            with self._lock:
                if self._projects_cache is not None and project_name in self._projects_cache:
                    del self._projects_cache[project_name]

            logger.info(f"Deleted project: {project_name}")
            return True

        except Exception as e:
            logger.error(f"Error deleting project {project_name}: {e}")
            return False

    def project_exists(self, project_name: str) -> bool:
        """Check if a project exists."""
        projects = self.get_projects_cache()
        return project_name in projects

    def add_user_to_project(self, project_name: str, username: str) -> bool:
        """Add a user to a project's allowed_users list."""
        try:
            project = self.get_project(project_name)
            if not project:
                logger.warning(f"Project {project_name} not found")
                return False

            allowed_users = project.get('allowed_users', [])
            if username not in allowed_users:
                allowed_users.append(username)
                project['allowed_users'] = allowed_users
                return self.save_project(project_name, project)

            return True  # Already has access

        except Exception as e:
            logger.error(f"Error adding user to project {project_name}: {e}")
            return False

    def remove_user_from_project(self, project_name: str, username: str) -> bool:
        """Remove a user from a project's allowed_users list."""
        try:
            project = self.get_project(project_name)
            if not project:
                logger.warning(f"Project {project_name} not found")
                return False

            allowed_users = project.get('allowed_users', [])
            if username in allowed_users:
                allowed_users.remove(username)
                project['allowed_users'] = allowed_users
                return self.save_project(project_name, project)

            return True  # Already doesn't have access

        except Exception as e:
            logger.error(f"Error removing user from project {project_name}: {e}")
            return False

    def reassign_project_owner(self, project_name: str, new_owner: str) -> bool:
        """Reassign project to a new owner."""
        try:
            project = self.get_project(project_name)
            if not project:
                logger.warning(f"Project {project_name} not found")
                return False

            project['owner'] = new_owner
            return self.save_project(project_name, project)

        except Exception as e:
            logger.error(f"Error reassigning project owner for {project_name}: {e}")
            return False


# Initialize the global cache instance
_cache = ProjectCache()


def save_project(project_name: str, project_data: Dict[str, Any], created_by: str = None) -> bool:
    """Save a project with the given data."""
    return _cache.save_project(project_name, project_data, created_by)


def get_project(project_name: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Get a specific project, with access validation."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_project_access(current_user, project_name):
            return None
    return _cache.get_project(project_name)


def list_projects(current_user: str = None) -> List[Dict[str, Any]]:
    """Get all projects, filtered by user access."""
    all_projects = _cache.list_projects()

    # No filtering if no user specified (backward compatibility)
    if not current_user:
        return all_projects

    # Import here to avoid circular dependency
    from core.auth import permissions

    # Admin sees everything
    if permissions.is_admin(current_user):
        return all_projects

    # Filter: owned OR in allowed_users
    filtered = []
    for project in all_projects:
        project_name = project['project_name']
        if permissions.has_project_access(current_user, project_name):
            filtered.append(project)

    return filtered


def delete_project(project_name: str) -> bool:
    """Delete a project."""
    return _cache.delete_project(project_name)


def project_exists(project_name: str) -> bool:
    """Check if a project exists."""
    return _cache.project_exists(project_name)


def add_user_to_project(project_name: str, username: str) -> bool:
    """Add a user to a project."""
    return _cache.add_user_to_project(project_name, username)


def remove_user_from_project(project_name: str, username: str) -> bool:
    """Remove a user from a project."""
    return _cache.remove_user_from_project(project_name, username)


def reassign_project_owner(project_name: str, new_owner: str) -> bool:
    """Reassign project to a new owner."""
    return _cache.reassign_project_owner(project_name, new_owner)


def invalidate_project_cache():
    """Force reload of project cache."""
    _cache.invalidate()
