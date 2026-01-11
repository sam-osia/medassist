from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any, List
import logging

from core.dataloders import annotations_loader
from core.dataloders.projects_loader import project_exists
from core.auth import permissions
from .dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

# Valid source types for annotations
VALID_SOURCES = {"note", "encounter", "medication", "diagnosis"}
VALID_FIELD_TYPES = {"boolean", "text", "numeric", "categorical"}


def validate_project_access(project_name: str, current_user: str):
    """Validate project exists and user has access."""
    if not project_exists(project_name):
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found")
    if not permissions.has_project_access(current_user, project_name):
        raise HTTPException(status_code=403, detail="Access denied to this project")


# =====================
# Annotation Groups
# =====================

@router.get("/{project_name}/annotations/groups")
def list_groups(project_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """List all annotation groups for a project."""
    try:
        validate_project_access(project_name, current_user)
        groups = annotations_loader.list_annotation_groups(project_name, current_user)

        # Add stats to each group
        groups_with_stats = []
        for group in groups:
            group_copy = dict(group)
            stats = annotations_loader.get_annotation_stats(project_name, group["id"])
            group_copy["stats"] = stats
            groups_with_stats.append(group_copy)

        return {
            "status": "success",
            "total_groups": len(groups_with_stats),
            "groups": groups_with_stats
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing annotation groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_name}/annotations/groups")
def create_group(
    project_name: str,
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create a new annotation group."""
    try:
        validate_project_access(project_name, current_user)

        # Validate required fields
        name = data.get("name")
        source = data.get("source")
        fields = data.get("fields", [])

        if not name:
            raise HTTPException(status_code=400, detail="Group name is required")
        if not source:
            raise HTTPException(status_code=400, detail="Source type is required")
        if source not in VALID_SOURCES:
            raise HTTPException(status_code=400, detail=f"Invalid source. Must be one of: {VALID_SOURCES}")
        if not fields:
            raise HTTPException(status_code=400, detail="At least one field is required")

        # Validate fields
        for i, field in enumerate(fields):
            if not field.get("name"):
                raise HTTPException(status_code=400, detail=f"Field {i+1}: name is required")
            if not field.get("type"):
                raise HTTPException(status_code=400, detail=f"Field {i+1}: type is required")
            if field.get("type") not in VALID_FIELD_TYPES:
                raise HTTPException(status_code=400, detail=f"Field {i+1}: invalid type. Must be one of: {VALID_FIELD_TYPES}")
            if field.get("type") == "categorical" and not field.get("options"):
                raise HTTPException(status_code=400, detail=f"Field {i+1}: categorical fields require options")

        # Create the group
        new_group = annotations_loader.create_annotation_group(project_name, data, current_user)

        if not new_group:
            raise HTTPException(status_code=500, detail="Failed to create annotation group")

        return {
            "status": "success",
            "message": "Annotation group created successfully",
            "group": new_group
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating annotation group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_name}/annotations/groups/{group_id}")
def get_group(
    project_name: str,
    group_id: str,
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get a specific annotation group with stats."""
    try:
        validate_project_access(project_name, current_user)

        group = annotations_loader.get_annotation_group(project_name, group_id, current_user)
        if not group:
            raise HTTPException(status_code=404, detail=f"Annotation group '{group_id}' not found")

        stats = annotations_loader.get_annotation_stats(project_name, group_id)

        return {
            "status": "success",
            **group,
            "stats": stats
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting annotation group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{project_name}/annotations/groups/{group_id}")
def update_group(
    project_name: str,
    group_id: str,
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update an annotation group."""
    try:
        validate_project_access(project_name, current_user)

        # Check group exists
        existing = annotations_loader.get_annotation_group(project_name, group_id)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Annotation group '{group_id}' not found")

        # Validate fields if provided
        if "fields" in data:
            for i, field in enumerate(data["fields"]):
                if not field.get("name"):
                    raise HTTPException(status_code=400, detail=f"Field {i+1}: name is required")
                if not field.get("type"):
                    raise HTTPException(status_code=400, detail=f"Field {i+1}: type is required")
                if field.get("type") not in VALID_FIELD_TYPES:
                    raise HTTPException(status_code=400, detail=f"Field {i+1}: invalid type")
                if field.get("type") == "categorical" and not field.get("options"):
                    raise HTTPException(status_code=400, detail=f"Field {i+1}: categorical fields require options")

        # Cannot change source (would invalidate existing annotations)
        if "source" in data and data["source"] != existing.get("source"):
            raise HTTPException(status_code=400, detail="Cannot change annotation source type")

        success = annotations_loader.update_annotation_group(project_name, group_id, data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update annotation group")

        updated = annotations_loader.get_annotation_group(project_name, group_id)

        return {
            "status": "success",
            "message": "Annotation group updated successfully",
            "group": updated
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating annotation group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_name}/annotations/groups/{group_id}")
def delete_group(
    project_name: str,
    group_id: str,
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Delete an annotation group and all its values."""
    try:
        validate_project_access(project_name, current_user)

        # Check group exists
        existing = annotations_loader.get_annotation_group(project_name, group_id)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Annotation group '{group_id}' not found")

        success = annotations_loader.delete_annotation_group(project_name, group_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete annotation group")

        return {
            "status": "success",
            "message": f"Annotation group '{group_id}' and all its values deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting annotation group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# Annotation Values
# =====================

@router.get("/{project_name}/annotations/groups/{group_id}/values")
def get_group_values(
    project_name: str,
    group_id: str,
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get all annotation values for a group."""
    try:
        validate_project_access(project_name, current_user)

        # Check group exists
        group = annotations_loader.get_annotation_group(project_name, group_id)
        if not group:
            raise HTTPException(status_code=404, detail=f"Annotation group '{group_id}' not found")

        values = annotations_loader.get_annotations_for_group(project_name, group_id, current_user)

        return {
            "status": "success",
            "group_id": group_id,
            "total_annotations": len(values),
            "annotations": values
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting annotation values: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_name}/annotations/groups/{group_id}/values/{item_id}")
def get_annotation(
    project_name: str,
    group_id: str,
    item_id: str,
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get a specific annotation value."""
    try:
        validate_project_access(project_name, current_user)

        # Check group exists
        group = annotations_loader.get_annotation_group(project_name, group_id)
        if not group:
            raise HTTPException(status_code=404, detail=f"Annotation group '{group_id}' not found")

        annotation = annotations_loader.get_annotation(project_name, group_id, item_id, current_user)
        if not annotation:
            raise HTTPException(status_code=404, detail=f"Annotation for item '{item_id}' not found")

        return {
            "status": "success",
            **annotation
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting annotation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_name}/annotations/groups/{group_id}/values/{item_id}")
def save_annotation(
    project_name: str,
    group_id: str,
    item_id: str,
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Save or update an annotation value."""
    try:
        validate_project_access(project_name, current_user)

        # Check group exists
        group = annotations_loader.get_annotation_group(project_name, group_id)
        if not group:
            raise HTTPException(status_code=404, detail=f"Annotation group '{group_id}' not found")

        values = data.get("values", {})
        if not values:
            raise HTTPException(status_code=400, detail="Annotation values are required")

        success = annotations_loader.save_annotation(project_name, group_id, item_id, values, current_user)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save annotation")

        return {
            "status": "success",
            "message": f"Annotation saved for item '{item_id}'"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving annotation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_name}/annotations/groups/{group_id}/values/{item_id}")
def delete_annotation(
    project_name: str,
    group_id: str,
    item_id: str,
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Delete an annotation value."""
    try:
        validate_project_access(project_name, current_user)

        # Check group exists
        group = annotations_loader.get_annotation_group(project_name, group_id)
        if not group:
            raise HTTPException(status_code=404, detail=f"Annotation group '{group_id}' not found")

        success = annotations_loader.delete_annotation(project_name, group_id, item_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Annotation for item '{item_id}' not found")

        return {
            "status": "success",
            "message": f"Annotation deleted for item '{item_id}'"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting annotation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
