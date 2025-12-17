"""
Authorization helpers for checking user permissions.

All permission checks follow the pattern:
- Admins bypass all checks (return True)
- Regular users are checked against specific criteria
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def is_admin(username: str) -> bool:
    """
    Check if a user is an admin.

    Args:
        username: Username to check

    Returns:
        True if user is admin, False otherwise
    """
    from core.dataloders import user_loader

    user = user_loader.get_user(username)
    if not user:
        return False
    return user.get('is_admin', False)


def has_dataset_access(username: str, dataset_name: str) -> bool:
    """
    Check if a user has access to a specific dataset.

    Args:
        username: Username to check
        dataset_name: Name of the dataset

    Returns:
        True if user has access (admin or dataset in allowed_datasets)
    """
    from core.dataloders import user_loader

    # Admins have access to everything
    if is_admin(username):
        return True

    user = user_loader.get_user(username)
    if not user:
        return False

    # Check if dataset is in user's allowed list
    allowed_datasets = user.get('allowed_datasets', [])
    return dataset_name in allowed_datasets


def has_project_access(username: str, project_name: str) -> bool:
    """
    Check if a user has access to a specific project.

    Args:
        username: Username to check
        project_name: Name of the project

    Returns:
        True if user has access (admin, owner, or in allowed_users)
    """
    from core.dataloders import projects_loader

    # Admins have access to everything
    if is_admin(username):
        return True

    project = projects_loader.get_project(project_name)
    if not project:
        return False

    # Check if user is owner or in allowed_users
    if username == project.get('owner'):
        return True

    allowed_users = project.get('allowed_users', [])
    return username in allowed_users


def has_plan_access(username: str, plan_name: str) -> bool:
    """
    Check if a user has access to a specific plan.

    Args:
        username: Username to check
        plan_name: Name of the plan

    Returns:
        True if user has access (admin or creator)
    """
    from core.dataloders import plan_loader

    # Admins have access to everything
    if is_admin(username):
        return True

    plan = plan_loader.get_plan(plan_name)
    if not plan:
        return False

    # Check if user is the creator
    return username == plan.get('created_by')


def has_experiment_access(username: str, experiment_name: str) -> bool:
    """
    Check if a user has access to a specific experiment.

    Experiments inherit access from their parent project.

    Args:
        username: Username to check
        experiment_name: Name of the experiment

    Returns:
        True if user has access (admin or has access to parent project)
    """
    from core.dataloders import experiment_loader

    # Admins have access to everything
    if is_admin(username):
        return True

    experiment = experiment_loader.get_experiment_details(experiment_name)
    if not experiment:
        return False

    # Get project name from experiment metadata
    project_name = experiment.get('metadata', {}).get('project_name')
    if not project_name:
        logger.warning(f"Experiment {experiment_name} has no associated project")
        return False

    # Check project access
    return has_project_access(username, project_name)


def is_project_owner(username: str, project_name: str) -> bool:
    """
    Check if a user is the owner of a specific project.

    Args:
        username: Username to check
        project_name: Name of the project

    Returns:
        True if user is the project owner
    """
    from core.dataloders import projects_loader

    project = projects_loader.get_project(project_name)
    if not project:
        return False

    return username == project.get('owner')


def can_manage_project_users(username: str, project_name: str) -> bool:
    """
    Check if a user can manage other users' access to a project.

    Args:
        username: Username to check
        project_name: Name of the project

    Returns:
        True if user can manage (admin or project owner)
    """
    return is_admin(username) or is_project_owner(username, project_name)