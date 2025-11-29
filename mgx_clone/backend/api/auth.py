#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Authentication API Routes for MGX Clone
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from mgx_clone.backend.core.deps import get_current_user_required
from mgx_clone.backend.services.auth_service import (
    AuthError,
    change_password,
    get_user_profile,
    login_user,
    register_user,
    request_password_reset,
    reset_password,
    update_profile,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ==================== Request/Response Models ====================


class RegisterRequest(BaseModel):
    """User registration request"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=8)
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    """User login request"""
    email_or_username: str = Field(..., description="Email or username")
    password: str


class ChangePasswordRequest(BaseModel):
    """Change password request"""
    current_password: str
    new_password: str = Field(..., min_length=8)


class ResetPasswordRequest(BaseModel):
    """Reset password request (with token)"""
    token: str
    new_password: str = Field(..., min_length=8)


class RequestPasswordResetRequest(BaseModel):
    """Request password reset email"""
    email: EmailStr


class UpdateProfileRequest(BaseModel):
    """Update user profile request"""
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    """User response (without password)"""
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str


class AuthResponse(BaseModel):
    """Authentication response with token"""
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    """Simple message response"""
    message: str


# ==================== API Endpoints ====================


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    """
    Register a new user.
    Returns user info with access token.
    """
    try:
        result = await register_user(
            email=request.email,
            username=request.username,
            password=request.password,
            display_name=request.display_name
        )
        return AuthResponse(**result)
    except AuthError as e:
        if e.code == "email_exists":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=e.message
            )
        elif e.code == "username_exists":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=e.message
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=e.message
            )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Authenticate user and return access token.
    Accepts either email or username.
    """
    try:
        result = await login_user(
            email_or_username=request.email_or_username,
            password=request.password
        )
        return AuthResponse(**result)
    except AuthError as e:
        if e.code == "invalid_credentials":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=e.message
            )
        elif e.code == "account_disabled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=e.message
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=e.message
            )


@router.post("/logout", response_model=MessageResponse)
async def logout():
    """
    Logout user.
    Note: JWT tokens are stateless, so this just returns success.
    The client should remove the token.
    """
    return MessageResponse(message="Successfully logged out")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user_required)
):
    """
    Get current authenticated user's information.
    """
    return UserResponse(**current_user)


@router.put("/profile", response_model=UserResponse)
async def update_user_profile(
    request: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user_required)
):
    """
    Update current user's profile.
    """
    try:
        result = await update_profile(
            user_id=current_user["id"],
            display_name=request.display_name,
            avatar_url=request.avatar_url
        )
        return UserResponse(**result)
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )


@router.put("/password", response_model=MessageResponse)
async def update_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user_required)
):
    """
    Change current user's password.
    Requires current password verification.
    """
    try:
        await change_password(
            user_id=current_user["id"],
            current_password=request.current_password,
            new_password=request.new_password
        )
        return MessageResponse(message="Password updated successfully")
    except AuthError as e:
        if e.code == "invalid_password":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=e.message
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=e.message
            )


@router.post("/password-reset-request", response_model=MessageResponse)
async def request_password_reset_endpoint(request: RequestPasswordResetRequest):
    """
    Request password reset.
    Sends reset email to user (or prints to console in development).
    Always returns success to not reveal if email exists.
    """
    await request_password_reset(email=request.email)
    return MessageResponse(
        message="If an account with this email exists, a password reset link has been sent."
    )


@router.post("/password-reset", response_model=MessageResponse)
async def reset_password_endpoint(request: ResetPasswordRequest):
    """
    Reset password using reset token.
    """
    try:
        await reset_password(
            token=request.token,
            new_password=request.new_password
        )
        return MessageResponse(message="Password reset successfully")
    except AuthError as e:
        if e.code == "invalid_token":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=e.message
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=e.message
            )

