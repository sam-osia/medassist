import json
import logging
import os
import uuid
from typing import List, Dict, Any, Optional
from threading import Lock
import datetime

logger = logging.getLogger(__name__)

# Configuration
PROJECTS_DIR = "projects"


class AnnotationCache:
    """Thread-safe singleton cache for annotation data."""
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
                self._groups_cache = {}  # project_name -> list of groups
                self._values_cache = {}  # project_name -> group_id -> list of values
                self._initialized = True

    def _get_groups_file_path(self, project_name: str) -> str:
        """Get the path to the annotation_groups.json file."""
        return os.path.join(PROJECTS_DIR, project_name, "annotation_groups.json")

    def _get_annotations_dir(self, project_name: str) -> str:
        """Get the path to the annotations directory."""
        return os.path.join(PROJECTS_DIR, project_name, "annotations")

    def _get_values_file_path(self, project_name: str, group_id: str) -> str:
        """Get the path to the annotation values file for a group."""
        return os.path.join(self._get_annotations_dir(project_name), f"{group_id}.json")

    def _load_groups(self, project_name: str) -> List[Dict[str, Any]]:
        """Load annotation groups from disk."""
        file_path = self._get_groups_file_path(project_name)
        if not os.path.exists(file_path):
            return []
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading annotation groups for {project_name}: {e}")
            return []

    def _save_groups(self, project_name: str, groups: List[Dict[str, Any]]) -> bool:
        """Save annotation groups to disk."""
        file_path = self._get_groups_file_path(project_name)
        try:
            # Ensure project directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w') as f:
                json.dump(groups, f, indent=2)
            return True
        except IOError as e:
            logger.error(f"Error saving annotation groups for {project_name}: {e}")
            return False

    def _load_values(self, project_name: str, group_id: str) -> List[Dict[str, Any]]:
        """Load annotation values for a group from disk."""
        file_path = self._get_values_file_path(project_name, group_id)
        if not os.path.exists(file_path):
            return []
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading annotation values for {project_name}/{group_id}: {e}")
            return []

    def _save_values(self, project_name: str, group_id: str, values: List[Dict[str, Any]]) -> bool:
        """Save annotation values for a group to disk."""
        file_path = self._get_values_file_path(project_name, group_id)
        try:
            # Ensure annotations directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w') as f:
                json.dump(values, f, indent=2)
            return True
        except IOError as e:
            logger.error(f"Error saving annotation values for {project_name}/{group_id}: {e}")
            return False

    def _delete_values_file(self, project_name: str, group_id: str) -> bool:
        """Delete the annotation values file for a group."""
        file_path = self._get_values_file_path(project_name, group_id)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
            return True
        except IOError as e:
            logger.error(f"Error deleting annotation values file for {project_name}/{group_id}: {e}")
            return False

    def get_groups(self, project_name: str) -> List[Dict[str, Any]]:
        """Get cached annotation groups, loading if necessary."""
        if project_name not in self._groups_cache:
            with self._lock:
                if project_name not in self._groups_cache:
                    self._groups_cache[project_name] = self._load_groups(project_name)
        return self._groups_cache.get(project_name, [])

    def get_group(self, project_name: str, group_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific annotation group."""
        groups = self.get_groups(project_name)
        for group in groups:
            if group.get("id") == group_id:
                return group
        return None

    def create_group(self, project_name: str, group_data: Dict[str, Any], created_by: str) -> Optional[Dict[str, Any]]:
        """Create a new annotation group."""
        with self._lock:
            groups = self._load_groups(project_name)

            # Generate ID and add metadata
            new_group = {
                "id": f"ag_{uuid.uuid4().hex[:12]}",
                "name": group_data.get("name"),
                "source": group_data.get("source"),
                "fields": [],
                "created_by": created_by,
                "created_at": datetime.datetime.now().isoformat()
            }

            # Process fields with IDs
            for i, field in enumerate(group_data.get("fields", [])):
                field_entry = {
                    "id": f"f{i+1}",
                    "name": field.get("name"),
                    "type": field.get("type")
                }
                if field.get("type") == "categorical" and field.get("options"):
                    field_entry["options"] = field.get("options")
                new_group["fields"].append(field_entry)

            groups.append(new_group)

            if self._save_groups(project_name, groups):
                self._groups_cache[project_name] = groups
                logger.info(f"Created annotation group {new_group['id']} for project {project_name}")
                return new_group

            return None

    def update_group(self, project_name: str, group_id: str, group_data: Dict[str, Any]) -> bool:
        """Update an existing annotation group."""
        with self._lock:
            groups = self._load_groups(project_name)

            for i, group in enumerate(groups):
                if group.get("id") == group_id:
                    # Update allowed fields
                    if "name" in group_data:
                        groups[i]["name"] = group_data["name"]
                    if "fields" in group_data:
                        # Reprocess fields with IDs
                        new_fields = []
                        for j, field in enumerate(group_data.get("fields", [])):
                            field_entry = {
                                "id": field.get("id", f"f{j+1}"),
                                "name": field.get("name"),
                                "type": field.get("type")
                            }
                            if field.get("type") == "categorical" and field.get("options"):
                                field_entry["options"] = field.get("options")
                            new_fields.append(field_entry)
                        groups[i]["fields"] = new_fields

                    groups[i]["updated_at"] = datetime.datetime.now().isoformat()

                    if self._save_groups(project_name, groups):
                        self._groups_cache[project_name] = groups
                        logger.info(f"Updated annotation group {group_id} for project {project_name}")
                        return True
                    return False

            logger.warning(f"Annotation group {group_id} not found for project {project_name}")
            return False

    def delete_group(self, project_name: str, group_id: str) -> bool:
        """Delete an annotation group and all its values."""
        with self._lock:
            groups = self._load_groups(project_name)

            # Find and remove the group
            new_groups = [g for g in groups if g.get("id") != group_id]

            if len(new_groups) == len(groups):
                logger.warning(f"Annotation group {group_id} not found for project {project_name}")
                return False

            # Delete the values file
            self._delete_values_file(project_name, group_id)

            # Remove from values cache
            if project_name in self._values_cache:
                self._values_cache[project_name].pop(group_id, None)

            if self._save_groups(project_name, new_groups):
                self._groups_cache[project_name] = new_groups
                logger.info(f"Deleted annotation group {group_id} for project {project_name}")
                return True

            return False

    def get_values(self, project_name: str, group_id: str) -> List[Dict[str, Any]]:
        """Get all annotation values for a group."""
        cache_key = (project_name, group_id)
        if project_name not in self._values_cache:
            self._values_cache[project_name] = {}
        if group_id not in self._values_cache[project_name]:
            with self._lock:
                if group_id not in self._values_cache[project_name]:
                    self._values_cache[project_name][group_id] = self._load_values(project_name, group_id)
        return self._values_cache[project_name].get(group_id, [])

    def get_value(self, project_name: str, group_id: str, item_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific annotation value."""
        values = self.get_values(project_name, group_id)
        for value in values:
            if str(value.get("item_id")) == str(item_id):
                return value
        return None

    def save_value(self, project_name: str, group_id: str, item_id: str,
                   values: Dict[str, Any], annotated_by: str) -> bool:
        """Save or update an annotation value."""
        # Validate group exists
        group = self.get_group(project_name, group_id)
        if not group:
            logger.error(f"Annotation group {group_id} not found for project {project_name}")
            return False

        # Validate values against group fields
        valid_field_ids = {f["id"] for f in group.get("fields", [])}
        field_types = {f["id"]: f for f in group.get("fields", [])}

        for field_id, field_value in values.items():
            if field_id not in valid_field_ids:
                logger.error(f"Invalid field ID {field_id} for group {group_id}")
                return False

            field_def = field_types[field_id]
            # Validate categorical values
            if field_def.get("type") == "categorical":
                options = field_def.get("options", [])
                if field_value is not None and field_value not in options:
                    logger.error(f"Invalid categorical value '{field_value}' for field {field_id}. Valid options: {options}")
                    return False

        with self._lock:
            all_values = self._load_values(project_name, group_id)

            # Find existing or create new
            found = False
            for i, val in enumerate(all_values):
                if str(val.get("item_id")) == str(item_id):
                    all_values[i] = {
                        "item_id": str(item_id),
                        "values": values,
                        "annotated_by": annotated_by,
                        "annotated_at": datetime.datetime.now().isoformat()
                    }
                    found = True
                    break

            if not found:
                all_values.append({
                    "item_id": str(item_id),
                    "values": values,
                    "annotated_by": annotated_by,
                    "annotated_at": datetime.datetime.now().isoformat()
                })

            if self._save_values(project_name, group_id, all_values):
                if project_name not in self._values_cache:
                    self._values_cache[project_name] = {}
                self._values_cache[project_name][group_id] = all_values
                logger.info(f"Saved annotation for item {item_id} in group {group_id}")
                return True

            return False

    def delete_value(self, project_name: str, group_id: str, item_id: str) -> bool:
        """Delete an annotation value."""
        with self._lock:
            all_values = self._load_values(project_name, group_id)
            new_values = [v for v in all_values if str(v.get("item_id")) != str(item_id)]

            if len(new_values) == len(all_values):
                logger.warning(f"Annotation for item {item_id} not found in group {group_id}")
                return False

            if self._save_values(project_name, group_id, new_values):
                if project_name not in self._values_cache:
                    self._values_cache[project_name] = {}
                self._values_cache[project_name][group_id] = new_values
                logger.info(f"Deleted annotation for item {item_id} in group {group_id}")
                return True

            return False

    def get_stats(self, project_name: str, group_id: str) -> Dict[str, Any]:
        """Get statistics for an annotation group."""
        values = self.get_values(project_name, group_id)
        return {
            "annotation_count": len(values)
        }

    def invalidate(self, project_name: str = None):
        """Clear cached data."""
        with self._lock:
            if project_name:
                self._groups_cache.pop(project_name, None)
                self._values_cache.pop(project_name, None)
            else:
                self._groups_cache = {}
                self._values_cache = {}


# Initialize the global cache instance
_cache = AnnotationCache()


# Public API functions

def list_annotation_groups(project_name: str, current_user: str = None) -> List[Dict[str, Any]]:
    """Get all annotation groups for a project."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_project_access(current_user, project_name):
            return []
    return _cache.get_groups(project_name)


def get_annotation_group(project_name: str, group_id: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Get a specific annotation group."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_project_access(current_user, project_name):
            return None
    return _cache.get_group(project_name, group_id)


def create_annotation_group(project_name: str, group_data: Dict[str, Any], created_by: str) -> Optional[Dict[str, Any]]:
    """Create a new annotation group."""
    return _cache.create_group(project_name, group_data, created_by)


def update_annotation_group(project_name: str, group_id: str, group_data: Dict[str, Any]) -> bool:
    """Update an existing annotation group."""
    return _cache.update_group(project_name, group_id, group_data)


def delete_annotation_group(project_name: str, group_id: str) -> bool:
    """Delete an annotation group and all its values."""
    return _cache.delete_group(project_name, group_id)


def get_annotations_for_group(project_name: str, group_id: str, current_user: str = None) -> List[Dict[str, Any]]:
    """Get all annotation values for a group."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_project_access(current_user, project_name):
            return []
    return _cache.get_values(project_name, group_id)


def get_annotation(project_name: str, group_id: str, item_id: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Get a specific annotation value."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_project_access(current_user, project_name):
            return None
    return _cache.get_value(project_name, group_id, item_id)


def save_annotation(project_name: str, group_id: str, item_id: str,
                    values: Dict[str, Any], annotated_by: str) -> bool:
    """Save or update an annotation value."""
    return _cache.save_value(project_name, group_id, item_id, values, annotated_by)


def delete_annotation(project_name: str, group_id: str, item_id: str) -> bool:
    """Delete an annotation value."""
    return _cache.delete_value(project_name, group_id, item_id)


def get_annotation_stats(project_name: str, group_id: str) -> Dict[str, Any]:
    """Get statistics for an annotation group."""
    return _cache.get_stats(project_name, group_id)


def invalidate_annotation_cache(project_name: str = None):
    """Force reload of annotation cache."""
    _cache.invalidate(project_name)
