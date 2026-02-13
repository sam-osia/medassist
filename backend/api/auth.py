from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Dict, Any
import logging

from core.auth import auth_service
from core.dataloaders import user_loader
from .dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["authentication"])


class LoginRequest(BaseModel):
    """Request model for login endpoint"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Response model for successful login"""
    access_token: str
    refresh_token: str
    token_type: str


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest) -> Dict[str, str]:
    """
    Authenticate user and return JWT access token.

    Args:
        credentials: LoginRequest with username and password

    Returns:
        Dictionary with access_token and token_type

    Raises:
        HTTPException: 401 if credentials are invalid
    """
    # Get user from storage
    user = auth_service.get_user(credentials.username)

    if not user:
        logger.warning(f"Login attempt for non-existent user: {credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    is_valid = auth_service.verify_password(
        credentials.password,
        user["password_hash"],
        user["salt"]
    )

    if not is_valid:
        logger.warning(f"Failed login attempt for user: {credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access and refresh tokens
    access_token = auth_service.create_access_token(username=credentials.username)
    refresh_token = auth_service.create_refresh_token(username=credentials.username)

    logger.info(f"User '{credentials.username}' logged in successfully")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


class RefreshRequest(BaseModel):
    """Request model for token refresh endpoint"""
    refresh_token: str


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(request: RefreshRequest) -> Dict[str, str]:
    """
    Refresh access token using a valid refresh token.

    Args:
        request: RefreshRequest with refresh_token

    Returns:
        Dictionary with new access_token, same refresh_token, and token_type

    Raises:
        HTTPException: 401 if refresh token is invalid or expired
    """
    try:
        # Verify refresh token
        username = auth_service.verify_token(request.refresh_token, expected_type="refresh")

        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Generate new access token
        new_access_token = auth_service.create_access_token(username=username)

        logger.info(f"Access token refreshed for user '{username}'")

        return {
            "access_token": new_access_token,
            "refresh_token": request.refresh_token,  # Return same refresh token
            "token_type": "bearer"
        }

    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh access token",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get("/me")
async def get_current_user_info(current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get current authenticated user's information.

    Args:
        current_user: Username from JWT token (injected by dependency)

    Returns:
        Dictionary with username, is_admin, and allowed_datasets

    Raises:
        HTTPException: 404 if user not found
    """
    user = user_loader.get_user(current_user)

    if not user:
        logger.error(f"Authenticated user {current_user} not found in database")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "username": user.get("username"),
        "is_admin": user.get("is_admin", False),
        "allowed_datasets": user.get("allowed_datasets", [])
    }