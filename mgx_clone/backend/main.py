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

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from mgx_clone.backend.api.auth import router as auth_router
from mgx_clone.backend.api.routes import router as api_router
from mgx_clone.backend.api.websocket import router as ws_router
from mgx_clone.backend.core.config import settings
from mgx_clone.backend.storage.database import init_db, get_project


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
    version="0.3.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
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


# Preview routes - serve built project files
@app.get("/preview/{project_id}")
@app.get("/preview/{project_id}/")
@app.get("/preview/{project_id}/{file_path:path}")
async def preview_project(request: Request, project_id: str, file_path: str = "index.html"):
    """Serve project files for iframe preview"""
    project = await get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    workspace = project.get("workspace_path")
    if not workspace or not Path(workspace).exists():
        raise HTTPException(status_code=404, detail="Project workspace not found")
    
    workspace = Path(workspace)
    
    # Default to index.html
    if not file_path or file_path == "/":
        file_path = "index.html"
    
    # Try dist folder first (for built projects), then root
    dist_path = workspace / "dist" / file_path
    root_path = workspace / file_path
    
    if dist_path.exists() and dist_path.is_file():
        full_path = dist_path
    elif root_path.exists() and root_path.is_file():
        full_path = root_path
    else:
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    
    # Determine media type
    suffix = full_path.suffix.lower()
    media_types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.webp': 'image/webp',
    }
    media_type = media_types.get(suffix, 'application/octet-stream')
    
    # For HTML files, rewrite absolute paths to use preview route
    if suffix == '.html':
        content = full_path.read_text(encoding='utf-8')
        base_url = f"/preview/{project_id}"
        
        # Replace absolute paths with preview paths
        # Only replace paths that start with / but not already with /preview/
        import re
        
        # Replace href="/xxx" with href="/preview/{id}/xxx" (but not if already /preview/)
        content = re.sub(
            r'href="/(?!preview/)([^"]*)"',
            f'href="{base_url}/\\1"',
            content
        )
        
        # Replace src="/xxx" with src="/preview/{id}/xxx" (but not if already /preview/)
        content = re.sub(
            r'src="/(?!preview/)([^"]*)"',
            f'src="{base_url}/\\1"',
            content
        )
        
        return HTMLResponse(content=content)
    
    return FileResponse(path=full_path, media_type=media_type)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
