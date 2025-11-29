#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Configuration settings for MGX Clone
"""
import secrets
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # App settings
    APP_NAME: str = "MGX Clone"
    DEBUG: bool = False
    
    # JWT settings
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Password reset
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Frontend URL for password reset links
    FRONTEND_URL: str = "http://localhost:3000"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()

