from fastapi import APIRouter, HTTPException, Body, Depends, status
from typing import Dict, Any, List
import logging
import binascii
import datetime

from core.dataloaders import user_loader, datasets_loader, projects_loader, workflow_def_loader
from core.auth import auth_service, permissions
from .dependencies import get_admin_user, get_current_user

router = APIRouter(tags=["users"])
logger = logging.getLogger(__name__)


# ============ User CRUD (Admin Only) ============

@router.get("/")
def list_all_users(current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get list of all users."""
    try:
        users = user_loader.list_users(include_sensitive=False)

        return {
            "status": "success",
            "total_users": len(users),
            "users": users
        }

    except Exception as e:
        logger.error(f"Error in list_all_users: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{username}", dependencies=[Depends(get_admin_user)])
def get_user_details(username: str) -> Dict[str, Any]:
    """Get details for a specific user (admin only)."""
    try:
        user = user_loader.get_user(username)

        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        # Return sanitized view (no password hash/salt)
        user_data = {
            "username": user.get("username"),
            "is_admin": user.get("is_admin", False),
            "allowed_datasets": user.get("allowed_datasets", []),
            "created_date": user.get("created_date")
        }

        return {
            "status": "success",
            **user_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_user_details: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/", dependencies=[Depends(get_admin_user)])
def create_user(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create a new user (admin only)."""
    try:
        username = data.get("username")
        password = data.get("password")
        is_admin = data.get("is_admin", False)
        allowed_datasets = data.get("allowed_datasets", [])

        # Validate required fields
        if not all([username, password]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: username, password"
            )

        # Validate username and password length
        if len(username) < 3:
            raise HTTPException(
                status_code=400,
                detail="Username must be at least 3 characters long"
            )

        if len(password) < 8:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters long"
            )

        # Check if user already exists
        if user_loader.user_exists(username):
            raise HTTPException(
                status_code=400,
                detail=f"User '{username}' already exists"
            )

        # Validate datasets exist
        for dataset_name in allowed_datasets:
            if not datasets_loader.dataset_exists(dataset_name):
                raise HTTPException(
                    status_code=400,
                    detail=f"Dataset '{dataset_name}' does not exist"
                )

        # Generate salt and hash password
        salt = auth_service.generate_salt()
        salt_hex = binascii.hexlify(salt).decode('ascii')
        password_hash = auth_service.hash_pwd(password, salt)

        # Create user data
        user_data = {
            "username": username,
            "password_hash": password_hash,
            "salt": salt_hex,
            "is_admin": is_admin,
            "allowed_datasets": allowed_datasets,
            "created_date": datetime.datetime.now().isoformat()
        }

        # Save user
        success = user_loader.save_user(username, user_data)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to create user")

        return {
            "status": "success",
            "message": f"User '{username}' created successfully",
            "username": username
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_user: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/{username}", dependencies=[Depends(get_admin_user)])
def update_user(username: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Update user properties (admin only)."""
    try:
        user = user_loader.get_user(username)

        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        # Update allowed fields
        if "is_admin" in data:
            user["is_admin"] = data["is_admin"]

        if "allowed_datasets" in data:
            # Validate datasets exist
            for dataset_name in data["allowed_datasets"]:
                if not datasets_loader.dataset_exists(dataset_name):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Dataset '{dataset_name}' does not exist"
                    )
            user["allowed_datasets"] = data["allowed_datasets"]

        # Update password if provided
        if "password" in data:
            if len(data["password"]) < 8:
                raise HTTPException(
                    status_code=400,
                    detail="Password must be at least 8 characters long"
                )
            salt = auth_service.generate_salt()
            salt_hex = binascii.hexlify(salt).decode('ascii')
            password_hash = auth_service.hash_pwd(data["password"], salt)
            user["password_hash"] = password_hash
            user["salt"] = salt_hex

        # Save updated user
        success = user_loader.save_user(username, user)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update user")

        return {
            "status": "success",
            "message": f"User '{username}' updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_user: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{username}", dependencies=[Depends(get_admin_user)])
def delete_user_endpoint(username: str) -> Dict[str, Any]:
    """Delete a user and reassign their resources to 'system' (admin only)."""
    try:
        if not user_loader.user_exists(username):
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        # Reassign owned projects to "system"
        all_projects = projects_loader.list_projects()
        for project in all_projects:
            if project.get("owner") == username:
                projects_loader.reassign_project_owner(project["project_name"], "system")
                logger.info(f"Reassigned project {project['project_name']} from {username} to system")

        # Reassign owned plans to "system"
        all_plans = workflow_def_loader.list_workflow_defs()
        for plan in all_plans:
            if plan.get("created_by") == username:
                workflow_def_loader.reassign_workflow_def_owner(plan["plan_name"], "system")
                logger.info(f"Reassigned plan {plan['plan_name']} from {username} to system")

        # Delete the user
        success = user_loader.delete_user(username)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete user")

        return {
            "status": "success",
            "message": f"User '{username}' deleted successfully and resources reassigned to 'system'"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_user_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ============ Dataset Access Management (Admin Only) ============

@router.get("/{username}/datasets", dependencies=[Depends(get_admin_user)])
def get_user_datasets(username: str) -> Dict[str, Any]:
    """Get list of datasets a user has access to (admin only)."""
    try:
        if not user_loader.user_exists(username):
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        datasets = user_loader.get_user_datasets(username)

        return {
            "status": "success",
            "username": username,
            "datasets": datasets
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_user_datasets: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{username}/datasets", dependencies=[Depends(get_admin_user)])
def grant_dataset_access(username: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Grant a user access to a dataset (admin only)."""
    try:
        dataset_name = data.get("dataset_name")

        if not dataset_name:
            raise HTTPException(
                status_code=400,
                detail="Missing required field: dataset_name"
            )

        # Validate user exists
        if not user_loader.user_exists(username):
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        # Validate dataset exists
        if not datasets_loader.dataset_exists(dataset_name):
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_name}' not found"
            )

        # Add dataset access
        success = user_loader.add_dataset_access(username, dataset_name)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to grant dataset access")

        return {
            "status": "success",
            "message": f"Granted user '{username}' access to dataset '{dataset_name}'"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in grant_dataset_access: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{username}/datasets/{dataset_name}", dependencies=[Depends(get_admin_user)])
def revoke_dataset_access(username: str, dataset_name: str) -> Dict[str, Any]:
    """Revoke a user's access to a dataset (admin only)."""
    try:
        # Validate user exists
        if not user_loader.user_exists(username):
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        # Remove dataset access
        success = user_loader.remove_dataset_access(username, dataset_name)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to revoke dataset access")

        return {
            "status": "success",
            "message": f"Revoked user '{username}' access to dataset '{dataset_name}'"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in revoke_dataset_access: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ============ Project Access Management (Admin or Project Owner) ============

@router.get("/{username}/projects")
def get_user_projects(username: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get list of projects a user has access to (admin or project owner)."""
    try:
        # Only admins can view other users' projects
        if username != current_user and not permissions.is_admin(current_user):
            raise HTTPException(
                status_code=403,
                detail="You can only view your own projects"
            )

        if not user_loader.user_exists(username):
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        # Get all projects the user has access to
        all_projects = projects_loader.list_projects()
        user_projects = []

        for project in all_projects:
            if (project.get("owner") == username or
                username in project.get("allowed_users", [])):
                user_projects.append({
                    "project_name": project["project_name"],
                    "owner": project.get("owner"),
                    "summary": project.get("summary")
                })

        return {
            "status": "success",
            "username": username,
            "projects": user_projects
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_user_projects: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{username}/projects")
def add_user_to_project(
    username: str,
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Add a user to a project (admin or project owner only)."""
    try:
        project_name = data.get("project_name")

        if not project_name:
            raise HTTPException(
                status_code=400,
                detail="Missing required field: project_name"
            )

        # Validate user exists
        if not user_loader.user_exists(username):
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        # Validate project exists
        if not projects_loader.project_exists(project_name):
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_name}' not found"
            )

        # Check permission: must be admin or project owner
        if not permissions.can_manage_project_users(current_user, project_name):
            raise HTTPException(
                status_code=403,
                detail="Only project owner or admin can manage project users"
            )

        # Add user to project
        success = projects_loader.add_user_to_project(project_name, username)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to add user to project")

        return {
            "status": "success",
            "message": f"Added user '{username}' to project '{project_name}'"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in add_user_to_project: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{username}/projects/{project_name}")
def remove_user_from_project(
    username: str,
    project_name: str,
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """Remove a user from a project (admin or project owner only)."""
    try:
        # Validate user exists
        if not user_loader.user_exists(username):
            raise HTTPException(
                status_code=404,
                detail=f"User '{username}' not found"
            )

        # Validate project exists
        if not projects_loader.project_exists(project_name):
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_name}' not found"
            )

        # Check permission: must be admin or project owner
        if not permissions.can_manage_project_users(current_user, project_name):
            raise HTTPException(
                status_code=403,
                detail="Only project owner or admin can manage project users"
            )

        # Remove user from project
        success = projects_loader.remove_user_from_project(project_name, username)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to remove user from project")

        return {
            "status": "success",
            "message": f"Removed user '{username}' from project '{project_name}'"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in remove_user_from_project: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")