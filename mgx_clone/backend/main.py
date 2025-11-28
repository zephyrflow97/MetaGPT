#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MGX Clone - FastAPI Backend Entry Point
"""
import sys
from pathlib import Path

# Add MetaGPT to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from mgx_clone.backend.api.routes import router as api_router
from mgx_clone.backend.api.websocket import router as ws_router
from mgx_clone.backend.storage.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Initialize database on startup
    await init_db()
    yield
    # Cleanup on shutdown


app = FastAPI(
    title="MGX Clone API",
    description="A MetaGPT powered natural language programming platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api")
app.include_router(ws_router)

# Serve generated projects as static files
workspace_path = Path(__file__).parent.parent.parent / "workspace"
workspace_path.mkdir(exist_ok=True)
app.mount("/workspace", StaticFiles(directory=str(workspace_path)), name="workspace")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "mgx-clone"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
