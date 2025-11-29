#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
FastAPI Dependencies for MGX Clone
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from mgx_clone.backend.core.security import get_user_id_from_token
from mgx_clone.backend.storage.database import get_user_by_id

# Security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """
    Get current user from JWT token.
    Returns None if not authenticated.
    """
    if not credentials:
        return None
    
    token = credentials.credentials
    user_id = get_user_id_from_token(token)
    
    if not user_id:
        return None
    
    user = await get_user_by_id(user_id)
    
    if not user or not user.get("is_active"):
        return None
    
    return user


async def get_current_user_required(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    Get current user from JWT token.
    Raises 401 if not authenticated.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    user_id = get_user_id_from_token(token)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )
    
    return user

