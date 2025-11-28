"""Configuration for MGX Clone backend."""

import os
from pathlib import Path

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent.parent  # MetaGPT root
MGX_CLONE_ROOT = Path(__file__).parent.parent
BACKEND_ROOT = Path(__file__).parent

# Storage paths
DATA_DIR = MGX_CLONE_ROOT / "data"
DATABASE_PATH = DATA_DIR / "mgx_clone.db"
WORKSPACE_DIR = DATA_DIR / "workspace"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

# Database URL
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH}"

# Server config
HOST = os.getenv("MGX_HOST", "0.0.0.0")
PORT = int(os.getenv("MGX_PORT", "8000"))

# MetaGPT config
DEFAULT_INVESTMENT = 3.0
DEFAULT_N_ROUNDS = 5

