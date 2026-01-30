import json
import logging
import os
from typing import List, Dict, Any, Optional
from threading import Lock
import datetime

logger = logging.getLogger(__name__)

# Configuration
WORKFLOW_DEFS_DIR = "workflow_defs"

class WorkflowDefCache:
    """Thread-safe singleton cache for workflow definition data."""
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
                self._workflow_defs_cache = None
                self._initialized = True

    def get_workflow_defs_cache(self) -> Dict[str, Any]:
        """Get cached workflow definitions, loading them if necessary."""
        if self._workflow_defs_cache is None:
            with self._lock:
                if self._workflow_defs_cache is None:  # Double-check lock pattern
                    self._workflow_defs_cache = self._load_all_workflow_defs()
        return self._workflow_defs_cache

    def invalidate(self):
        """Clear the cached workflow definitions."""
        with self._lock:
            self._workflow_defs_cache = None

    def _load_all_workflow_defs(self) -> Dict[str, Any]:
        """Load all workflow definitions from disk."""
        logger.info("Loading workflow definitions from disk...")

        workflow_defs = {}

        if not os.path.exists(WORKFLOW_DEFS_DIR):
            os.makedirs(WORKFLOW_DEFS_DIR, exist_ok=True)
            logger.info(f"Created workflow definitions directory: {WORKFLOW_DEFS_DIR}")
            return workflow_defs

        for filename in os.listdir(WORKFLOW_DEFS_DIR):
            if not filename.endswith('.json'):
                continue

            workflow_name = filename[:-5]  # Remove .json extension
            workflow_path = os.path.join(WORKFLOW_DEFS_DIR, filename)

            try:
                with open(workflow_path, 'r') as f:
                    workflow_data = json.load(f)

                # Validate required fields
                required_fields = ['workflow_name', 'created_date', 'raw_workflow']
                if all(field in workflow_data for field in required_fields):
                    workflow_defs[workflow_name] = workflow_data
                else:
                    logger.warning(f"Workflow definition {workflow_name} missing required fields, skipping")

            except Exception as e:
                logger.error(f"Error loading workflow definition {workflow_name}: {e}")
                continue

        logger.info(f"Loaded {len(workflow_defs)} workflow definitions from disk")
        return workflow_defs

    def save_workflow_def(self, workflow_name: str, workflow_data: Dict[str, Any]) -> bool:
        """Save a workflow definition to disk and update cache."""
        try:
            # Ensure workflow definitions directory exists
            os.makedirs(WORKFLOW_DEFS_DIR, exist_ok=True)

            # Add timestamps
            current_time = datetime.datetime.now().isoformat()
            workflow_data['workflow_name'] = workflow_name
            workflow_data['last_modified_date'] = current_time

            # Set created_date if it's a new workflow definition
            if 'created_date' not in workflow_data:
                workflow_data['created_date'] = current_time

            # Save to disk
            workflow_path = os.path.join(WORKFLOW_DEFS_DIR, f"{workflow_name}.json")
            with open(workflow_path, 'w') as f:
                json.dump(workflow_data, f, indent=2)

            # Update cache
            with self._lock:
                if self._workflow_defs_cache is not None:
                    self._workflow_defs_cache[workflow_name] = workflow_data

            logger.info(f"Saved workflow definition: {workflow_name}")
            return True

        except Exception as e:
            logger.error(f"Error saving workflow definition {workflow_name}: {e}")
            return False

    def get_workflow_def(self, workflow_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific workflow definition."""
        workflow_defs = self.get_workflow_defs_cache()
        return workflow_defs.get(workflow_name)

    def list_workflow_defs(self) -> List[Dict[str, Any]]:
        """Get all workflow definitions with summary information."""
        workflow_defs = self.get_workflow_defs_cache()

        workflow_list = []
        for workflow_name, workflow_data in workflow_defs.items():
            workflow_list.append({
                "workflow_name": workflow_name,
                "created_date": workflow_data.get("created_date"),
                "last_modified_date": workflow_data.get("last_modified_date"),
                "created_by": workflow_data.get("created_by")
            })

        # Sort by last modified date (newest first)
        workflow_list.sort(
            key=lambda x: x.get("last_modified_date", ""),
            reverse=True
        )

        return workflow_list

    def delete_workflow_def(self, workflow_name: str) -> bool:
        """Delete a workflow definition from disk and cache."""
        try:
            # Remove from disk
            workflow_path = os.path.join(WORKFLOW_DEFS_DIR, f"{workflow_name}.json")
            if os.path.exists(workflow_path):
                os.remove(workflow_path)

            # Remove from cache
            with self._lock:
                if self._workflow_defs_cache is not None and workflow_name in self._workflow_defs_cache:
                    del self._workflow_defs_cache[workflow_name]

            logger.info(f"Deleted workflow definition: {workflow_name}")
            return True

        except Exception as e:
            logger.error(f"Error deleting workflow definition {workflow_name}: {e}")
            return False

    def workflow_def_exists(self, workflow_name: str) -> bool:
        """Check if a workflow definition exists."""
        workflow_defs = self.get_workflow_defs_cache()
        return workflow_name in workflow_defs

    def reassign_workflow_def_owner(self, workflow_name: str, new_owner: str) -> bool:
        """Reassign workflow definition to a new owner."""
        try:
            workflow_def = self.get_workflow_def(workflow_name)
            if not workflow_def:
                logger.warning(f"Workflow definition {workflow_name} not found")
                return False

            workflow_def['created_by'] = new_owner
            return self.save_workflow_def(workflow_name, workflow_def)

        except Exception as e:
            logger.error(f"Error reassigning workflow definition owner for {workflow_name}: {e}")
            return False


# Initialize the global cache instance
_cache = WorkflowDefCache()


def save_workflow_def(workflow_name: str, raw_workflow: Dict[str, Any], created_by: str) -> bool:
    """Save a workflow definition with the given data."""
    if not created_by:
        raise ValueError("created_by is required")

    workflow_data = {
        "raw_workflow": raw_workflow,
        "created_by": created_by
    }
    return _cache.save_workflow_def(workflow_name, workflow_data)


def get_workflow_def(workflow_name: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Get a specific workflow definition, with access validation."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_workflow_def_access(current_user, workflow_name):
            return None
    return _cache.get_workflow_def(workflow_name)


def list_workflow_defs(current_user: str) -> List[Dict[str, Any]]:
    """Get all workflow definitions, filtered by user access."""
    all_workflow_defs = _cache.list_workflow_defs()

    # Import here to avoid circular dependency
    from core.auth import permissions

    # Admin sees everything
    if permissions.is_admin(current_user):
        return all_workflow_defs

    # Filter: only workflow definitions created by current_user
    return [w for w in all_workflow_defs if w.get('created_by') == current_user]


def delete_workflow_def(workflow_name: str) -> bool:
    """Delete a workflow definition."""
    return _cache.delete_workflow_def(workflow_name)


def workflow_def_exists(workflow_name: str) -> bool:
    """Check if a workflow definition exists."""
    return _cache.workflow_def_exists(workflow_name)


def reassign_workflow_def_owner(workflow_name: str, new_owner: str) -> bool:
    """Reassign workflow definition to a new owner."""
    return _cache.reassign_workflow_def_owner(workflow_name, new_owner)


def invalidate_workflow_def_cache():
    """Force reload of workflow definition cache."""
    _cache.invalidate()
