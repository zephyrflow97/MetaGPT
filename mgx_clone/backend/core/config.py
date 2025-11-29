#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Configuration settings for MGX Clone
"""
import os
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
    
    # CORS - 允许所有来源（公网部署时需要）
    # 可通过环境变量 CORS_ORIGINS 配置，格式: "http://example.com,http://localhost:3000"
    CORS_ORIGINS: list[str] = ["*"]
    
    # Frontend URL for share links and password reset
    # 可通过环境变量 FRONTEND_URL 配置，如: "http://136.110.50.15:3000"
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()

