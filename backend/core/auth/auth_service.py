import hashlib
import binascii
import os
import secrets
from typing import Optional, Dict
from datetime import datetime, timedelta
import logging
import jwt
from core.dataloders import user_loader

logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = secrets.token_urlsafe(32)  # Generate a random secret key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # Access token expires in 15 minutes
REFRESH_TOKEN_EXPIRE_DAYS = 7  # Refresh token expires in 7 days


def generate_salt() -> bytes:
    """Generate a random salt for password hashing."""
    return os.urandom(32)


def hash_pwd(pwd: str, salt: bytes) -> str:
    """Return a hashed password using PBKDF2-HMAC-SHA512."""
    pwdhash = binascii.hexlify(
        hashlib.pbkdf2_hmac('sha512', pwd.encode('utf-8'), salt, 100000)
    ).decode('ascii')
    return pwdhash


def verify_password(pwd: str, stored_hash: str, salt: str) -> bool:
    """Verify a password against the stored hash."""
    try:
        salt_bytes = binascii.unhexlify(salt)
        computed_hash = hash_pwd(pwd, salt_bytes)
        return computed_hash == stored_hash
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def get_user(username: str) -> Optional[Dict]:
    """
    Retrieve a user by username.

    This function now delegates to user_loader for consistency.
    """
    return user_loader.get_user(username)


# ============ JWT Token Functions ============

def create_access_token(username: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token for the given username.

    Args:
        username: The username to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": username,
        "exp": expire
    }

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(username: str) -> str:
    """
    Create a JWT refresh token for the given username.

    Args:
        username: The username to encode in the token

    Returns:
        Encoded JWT refresh token string
    """
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": username,
        "exp": expire,
        "type": "refresh"
    }

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, expected_type: Optional[str] = None) -> Optional[str]:
    """
    Verify and decode a JWT token.

    Args:
        token: The JWT token to verify
        expected_type: Optional token type to verify ("refresh" for refresh tokens)

    Returns:
        Username if token is valid, None otherwise

    Raises:
        jwt.ExpiredSignatureError: If token has expired
        jwt.InvalidTokenError: If token is invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")

        if username is None:
            return None

        # Check token type if specified
        if expected_type and token_type != expected_type:
            logger.warning(f"Invalid token type. Expected: {expected_type}, Got: {token_type}")
            return None

        return username
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        raise