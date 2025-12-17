from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any, List
import logging

from core.dataloders.projects_loader import (
    save_project,
    get_project,
    list_projects,
    delete_project,
    project_exists
)
from core.dataloders import datasets_loader
from core.dataloders import user_loader
from core.auth import permissions

from .dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


@router.get("/")
def list_all_projects(current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get list of all projects with summary information."""
    try:
        projects = list_projects(current_user)

        return {
            "status": "success",
            "total_projects": len(projects),
            "projects": projects
        }

    except Exception as e:
        logger.error(f"Error in list_all_projects: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{project_name}")
def get_project_details(project_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get full details for a specific project."""
    try:
        project_data = get_project(project_name, current_user)

        if not project_data:
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_name}' not found"
            )

        return {
            "status": "success",
            **project_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_project_details: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/")
def create_project(data: Dict[str, Any] = Body(...), current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Create a new project."""
    try:
        # Validate required fields
        project_name = data.get("project_name")
        summary = data.get("summary")

        if not all([project_name, summary]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: project_name, summary"
            )

        # Validate project name format (alphanumeric, hyphens, underscores only)
        if not project_name.replace('_', '').replace('-', '').isalnum():
            raise HTTPException(
                status_code=400,
                detail="Project name can only contain letters, numbers, hyphens, and underscores"
            )

        # Check if project already exists
        if project_exists(project_name):
            raise HTTPException(
                status_code=400,
                detail=f"Project '{project_name}' already exists"
            )

        # Validate contacts structure if provided
        contacts = data.get("contacts", [])
        if contacts:
            for i, contact in enumerate(contacts):
                if not isinstance(contact, dict):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Contact at index {i} must be an object"
                    )
                # Check for required contact fields
                if not all(key in contact for key in ["name", "role", "email"]):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Contact at index {i} must have name, role, and email fields"
                    )

        # Prepare project data (owner is current_user)
        project_data = {
            "summary": summary,
            "description": data.get("description", ""),
            "contacts": contacts,
            "references": data.get("references", []),
            "dataset": data.get("dataset")
        }

        # Save project with current_user as owner
        success = save_project(project_name, project_data, created_by=current_user)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to save project")

        return {
            "status": "success",
            "message": f"Project '{project_name}' created successfully",
            "project_name": project_name
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_project: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/{project_name}")
def update_project(project_name: str, data: Dict[str, Any] = Body(...), current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Update an existing project (owner or admin only)."""
    try:
        # Check if project exists
        if not project_exists(project_name):
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_name}' not found"
            )

        # Check permissions (admin or owner)
        if not (permissions.is_admin(current_user) or permissions.is_project_owner(current_user, project_name)):
            raise HTTPException(
                status_code=403,
                detail="Only project owner or admin can update this project"
            )

        # Get existing project
        existing_project = get_project(project_name, current_user)
        if not existing_project:
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_name}' not found"
            )

        # Prevent changing project_name and owner
        if "project_name" in data and data["project_name"] != project_name:
            raise HTTPException(
                status_code=400,
                detail="Cannot change project name"
            )
        if "owner" in data and data["owner"] != existing_project.get("owner"):
            raise HTTPException(
                status_code=400,
                detail="Cannot change project owner"
            )

        # Validate contacts structure if provided
        if "contacts" in data:
            contacts = data["contacts"]
            if contacts:
                for i, contact in enumerate(contacts):
                    if not isinstance(contact, dict):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Contact at index {i} must be an object"
                        )
                    # Check for required contact fields
                    if not all(key in contact for key in ["name", "role", "email"]):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Contact at index {i} must have name, role, and email fields"
                        )

        # Validate dataset exists if provided
        if "dataset" in data and data["dataset"]:
            if not datasets_loader.dataset_exists(data["dataset"]):
                raise HTTPException(
                    status_code=400,
                    detail=f"Dataset '{data['dataset']}' does not exist"
                )

        # Validate allowed_users if provided
        if "allowed_users" in data:
            for username in data["allowed_users"]:
                if not user_loader.user_exists(username):
                    raise HTTPException(
                        status_code=400,
                        detail=f"User '{username}' does not exist"
                    )

        # Update project with provided fields
        updated_project = {**existing_project}

        # Update only provided fields
        if "summary" in data:
            updated_project["summary"] = data["summary"]
        if "description" in data:
            updated_project["description"] = data["description"]
        if "contacts" in data:
            updated_project["contacts"] = data["contacts"]
        if "references" in data:
            updated_project["references"] = data["references"]
        if "dataset" in data:
            updated_project["dataset"] = data["dataset"]
        if "allowed_users" in data:
            updated_project["allowed_users"] = data["allowed_users"]

        # Save project
        success = save_project(project_name, updated_project)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update project")

        return {
            "status": "success",
            "message": f"Project '{project_name}' updated successfully",
            **updated_project
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_project: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{project_name}")
def delete_project_endpoint(project_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Delete a project."""
    try:
        if not project_exists(project_name):
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_name}' not found"
            )

        # Check permissions (admin or owner)
        if not permissions.is_project_owner(current_user, project_name):
            raise HTTPException(
                status_code=403,
                detail="Only project owner or admin can delete this project"
            )

        success = delete_project(project_name)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete project")

        return {
            "status": "success",
            "message": f"Project '{project_name}' deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_project_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")