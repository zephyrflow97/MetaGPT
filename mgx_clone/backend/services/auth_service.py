#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Authentication Service for MGX Clone
Handles user registration, login, and password management
"""
import re
from typing import Optional

from mgx_clone.backend.core.config import settings
from mgx_clone.backend.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from mgx_clone.backend.storage.database import (
    create_password_reset_token,
    create_user,
    get_password_reset_token,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    update_user_password,
    update_user_profile,
    use_password_reset_token,
)


class AuthError(Exception):
    """Authentication error"""
    def __init__(self, message: str, code: str = "auth_error"):
        self.message = message
        self.code = code
        super().__init__(message)


def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password strength.
    Returns (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Za-z]", password):
        return False, "Password must contain at least one letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, ""


def validate_username(username: str) -> tuple[bool, str]:
    """
    Validate username format.
    Returns (is_valid, error_message)
    """
    if len(username) < 3:
        return False, "Username must be at least 3 characters long"
    if len(username) > 30:
        return False, "Username must be at most 30 characters long"
    if not re.match(r"^[a-zA-Z0-9_-]+$", username):
        return False, "Username can only contain letters, numbers, underscores, and hyphens"
    return True, ""


async def register_user(
    email: str,
    username: str,
    password: str,
    display_name: Optional[str] = None
) -> dict:
    """
    Register a new user.
    Returns user dict with access token.
    """
    # Validate email
    if not validate_email(email):
        raise AuthError("Invalid email format", "invalid_email")
    
    # Validate username
    is_valid, error = validate_username(username)
    if not is_valid:
        raise AuthError(error, "invalid_username")
    
    # Validate password
    is_valid, error = validate_password(password)
    if not is_valid:
        raise AuthError(error, "weak_password")
    
    # Check if email already exists
    existing_user = await get_user_by_email(email)
    if existing_user:
        raise AuthError("Email already registered", "email_exists")
    
    # Check if username already exists
    existing_user = await get_user_by_username(username)
    if existing_user:
        raise AuthError("Username already taken", "username_exists")
    
    # Create user
    hashed_password = get_password_hash(password)
    user = await create_user(
        email=email,
        username=username,
        hashed_password=hashed_password,
        display_name=display_name
    )
    
    # Generate access token
    access_token = create_access_token(data={"sub": user["id"]})
    
    # Return user without password
    user_response = {k: v for k, v in user.items() if k != "hashed_password"}
    user_response["access_token"] = access_token
    user_response["token_type"] = "bearer"
    
    return user_response


async def login_user(email_or_username: str, password: str) -> dict:
    """
    Authenticate user and return access token.
    Accepts either email or username.
    """
    # Try to find user by email or username
    user = await get_user_by_email(email_or_username)
    if not user:
        user = await get_user_by_username(email_or_username)
    
    if not user:
        raise AuthError("Invalid credentials", "invalid_credentials")
    
    # Verify password
    if not verify_password(password, user["hashed_password"]):
        raise AuthError("Invalid credentials", "invalid_credentials")
    
    # Check if user is active
    if not user.get("is_active"):
        raise AuthError("Account is disabled", "account_disabled")
    
    # Generate access token
    access_token = create_access_token(data={"sub": user["id"]})
    
    # Return user without password
    user_response = {k: v for k, v in user.items() if k != "hashed_password"}
    user_response["access_token"] = access_token
    user_response["token_type"] = "bearer"
    
    return user_response


async def change_password(
    user_id: str,
    current_password: str,
    new_password: str
) -> bool:
    """
    Change user password.
    Requires current password verification.
    """
    user = await get_user_by_id(user_id)
    if not user:
        raise AuthError("User not found", "user_not_found")
    
    # Verify current password
    if not verify_password(current_password, user["hashed_password"]):
        raise AuthError("Current password is incorrect", "invalid_password")
    
    # Validate new password
    is_valid, error = validate_password(new_password)
    if not is_valid:
        raise AuthError(error, "weak_password")
    
    # Update password
    hashed_password = get_password_hash(new_password)
    await update_user_password(user_id, hashed_password)
    
    return True


async def request_password_reset(email: str) -> Optional[str]:
    """
    Request password reset.
    Returns reset token if user exists, None otherwise.
    Note: In production, this should send an email instead of returning the token.
    """
    user = await get_user_by_email(email)
    if not user:
        # Don't reveal if user exists
        return None
    
    token = await create_password_reset_token(user["id"])
    
    # In production, send email here
    # For now, we'll just return the token (logged to console)
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    print(f"\n[Password Reset] Reset URL for {email}: {reset_url}\n")
    
    return token


async def reset_password(token: str, new_password: str) -> bool:
    """
    Reset password using reset token.
    """
    # Validate new password
    is_valid, error = validate_password(new_password)
    if not is_valid:
        raise AuthError(error, "weak_password")
    
    # Get and validate token
    token_info = await get_password_reset_token(token)
    if not token_info:
        raise AuthError("Invalid or expired reset token", "invalid_token")
    
    # Update password
    hashed_password = get_password_hash(new_password)
    await update_user_password(token_info["user_id"], hashed_password)
    
    # Mark token as used
    await use_password_reset_token(token)
    
    return True


async def update_profile(
    user_id: str,
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> dict:
    """
    Update user profile.
    Returns updated user.
    """
    user = await update_user_profile(
        user_id=user_id,
        display_name=display_name,
        avatar_url=avatar_url
    )
    
    if not user:
        raise AuthError("User not found", "user_not_found")
    
    # Return user without password
    return {k: v for k, v in user.items() if k != "hashed_password"}


async def get_user_profile(user_id: str) -> Optional[dict]:
    """
    Get user profile by ID.
    Returns user without password.
    """
    user = await get_user_by_id(user_id)
    if not user:
        return None
    
    return {k: v for k, v in user.items() if k != "hashed_password"}

