#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
REST API Routes for MGX Clone
"""
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from mgx_clone.backend.core.config import settings
from mgx_clone.backend.core.deps import get_current_user, get_current_user_required
from mgx_clone.backend.services.templates import (
    generate_prompt_from_template,
    get_all_templates,
    get_categories,
    get_template,
    get_templates_by_category,
)
from mgx_clone.backend.storage.database import (
    add_tag_to_project,
    count_projects,
    create_project,
    create_project_share,
    create_tag,
    delete_project_share,
    delete_tag,
    get_all_projects,
    get_project,
    get_project_by_share_token,
    get_project_messages,
    get_project_share,
    get_project_tags,
    get_tag,
    get_tags_by_user,
    remove_tag_from_project,
    update_project_status,
    update_tag,
)

router = APIRouter()


class ProjectCreate(BaseModel):
    """Request model for creating a project"""
    name: str
    requirement: str


class ProjectResponse(BaseModel):
    """Response model for project"""
    id: str
    name: str
    requirement: str
    status: str
    created_at: str
    updated_at: str
    workspace_path: Optional[str] = None
    user_id: Optional[str] = None


class ProjectListResponse(BaseModel):
    """Response model for project list"""
    projects: list[ProjectResponse]
    total: int


class ShareRequest(BaseModel):
    """Request model for creating/updating share"""
    is_public: bool = True
    expires_at: Optional[str] = None


class ShareResponse(BaseModel):
    """Response model for share info"""
    id: str
    project_id: str
    share_token: str
    is_public: bool
    expires_at: Optional[str] = None
    view_count: int
    created_at: str
    share_url: str


class TagCreate(BaseModel):
    """Request model for creating a tag"""
    name: str
    color: str = "#3B82F6"


class TagResponse(BaseModel):
    """Response model for tag"""
    id: str
    user_id: str
    name: str
    color: str
    created_at: str


class TagUpdate(BaseModel):
    """Request model for updating a tag"""
    name: Optional[str] = None
    color: Optional[str] = None


class TagListResponse(BaseModel):
    """Response model for tag list"""
    tags: list[TagResponse]


@router.post("/projects", response_model=ProjectResponse)
async def create_new_project(
    project: ProjectCreate,
    current_user: dict = Depends(get_current_user_required)
):
    """Create a new project (requires authentication)"""
    try:
        result = await create_project(project.name, project.requirement, user_id=current_user["id"])
        return ProjectResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects", response_model=ProjectListResponse)
async def list_projects(
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    current_user: dict = Depends(get_current_user_required)
):
    """Get all projects with pagination, search, and tag filter (requires authentication)"""
    try:
        projects = await get_all_projects(
            skip=skip,
            limit=limit,
            user_id=current_user["id"],
            search=search,
            tag_id=tag
        )
        total = await count_projects(user_id=current_user["id"], search=search, tag_id=tag)
        return ProjectListResponse(
            projects=[ProjectResponse(**p) for p in projects],
            total=total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/search")
async def search_projects(
    q: str,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user_required)
):
    """Search projects by name or requirement (requires authentication)"""
    try:
        projects = await get_all_projects(
            skip=skip,
            limit=limit,
            user_id=current_user["id"],
            search=q
        )
        total = await count_projects(user_id=current_user["id"], search=q)
        return {
            "projects": [ProjectResponse(**p) for p in projects],
            "total": total,
            "query": q
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project_detail(project_id: str):
    """Get project details"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return ProjectResponse(**project)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/messages")
async def get_messages(project_id: str):
    """Get all messages for a project"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        messages = await get_project_messages(project_id)
        return {"messages": messages}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Directories to exclude from file listing (performance optimization)
EXCLUDED_DIRS = {
    "node_modules",
    "__pycache__",
    ".git",
    ".venv",
    "venv",
    ".env",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".output",
    ".cache",
    ".turbo",
    "coverage",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "eggs",
    "*.egg-info",
    ".tox",
    ".nox",
    "htmlcov",
    ".hypothesis",
    "target",  # Rust
    "vendor",  # Go
}

# Maximum number of files to return
MAX_FILES = 500


def should_exclude_path(path: Path) -> bool:
    """Check if a path should be excluded from file listing"""
    parts = path.parts
    for part in parts:
        if part in EXCLUDED_DIRS:
            return True
        # Handle patterns like *.egg-info
        if part.endswith(".egg-info"):
            return True
    return False


@router.get("/projects/{project_id}/files")
async def get_project_files(project_id: str, limit: int = MAX_FILES):
    """Get list of files in a project
    
    Args:
        project_id: The project ID
        limit: Maximum number of files to return (default: 500)
    """
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = project.get("workspace_path")
        if not workspace_path or not Path(workspace_path).exists():
            return {"files": [], "total": 0, "truncated": False}
        
        files = []
        total_count = 0
        workspace = Path(workspace_path)
        
        # Use os.walk for better performance with early directory exclusion
        import os
        for root, dirs, filenames in os.walk(workspace):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.endswith(".egg-info")]
            
            root_path = Path(root)
            for filename in filenames:
                file_path = root_path / filename
                relative_path = file_path.relative_to(workspace)
                
                # Skip hidden files at root level
                if str(relative_path).startswith("."):
                    continue
                
                total_count += 1
                
                # Only add up to limit files
                if len(files) < limit:
                    files.append({
                        "name": filename,
                        "path": str(relative_path),
                        "size": 0,  # Skip stat() call for performance
                        "extension": file_path.suffix,
                    })
        
        return {
            "files": files,
            "total": total_count,
            "truncated": total_count > limit,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/files/{file_path:path}")
async def get_file_content(project_id: str, file_path: str):
    """Get content of a specific file"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = project.get("workspace_path")
        if not workspace_path:
            raise HTTPException(status_code=404, detail="Project workspace not found")
        
        full_path = Path(workspace_path) / file_path
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        if not full_path.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")
        
        # Check if file is binary
        try:
            content = full_path.read_text(encoding="utf-8")
            return {"content": content, "path": file_path}
        except UnicodeDecodeError:
            return {"content": "[Binary file - cannot display]", "path": file_path, "binary": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/download")
async def download_project(project_id: str):
    """Download project as zip file"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = project.get("workspace_path")
        if not workspace_path or not Path(workspace_path).exists():
            raise HTTPException(status_code=404, detail="Project workspace not found")
        
        # Create zip file in temp directory
        temp_dir = tempfile.mkdtemp()
        zip_name = f"{project['name']}_{project_id[:8]}"
        zip_path = shutil.make_archive(
            Path(temp_dir) / zip_name,
            'zip',
            workspace_path
        )
        
        return FileResponse(
            path=zip_path,
            filename=f"{zip_name}.zip",
            media_type="application/zip"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Update status to deleted (soft delete)
        await update_project_status(project_id, "deleted")
        
        return {"message": "Project deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_history(skip: int = 0, limit: int = 50):
    """Get project history (alias for list_projects)"""
    return await list_projects(skip=skip, limit=limit)


# ==================== Templates API ====================


@router.get("/templates")
async def list_templates(category: Optional[str] = None):
    """Get all available project templates"""
    try:
        if category:
            templates = get_templates_by_category(category)
        else:
            templates = get_all_templates()
        return {"templates": templates, "total": len(templates)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/categories")
async def list_template_categories():
    """Get all template categories"""
    try:
        categories = get_categories()
        return {"categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{template_id}")
async def get_template_detail(template_id: str):
    """Get a specific template by ID"""
    try:
        template = get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class GeneratePromptRequest(BaseModel):
    """Request model for generating prompt from template"""
    template_id: str
    project_name: str = "My Project"
    selected_features: Optional[list[str]] = None
    custom_requirements: Optional[str] = None


@router.post("/templates/generate-prompt")
async def generate_template_prompt(request: GeneratePromptRequest):
    """Generate a complete prompt from a template"""
    try:
        template = get_template(request.template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        prompt = generate_prompt_from_template(
            template_id=request.template_id,
            project_name=request.project_name,
            selected_features=request.selected_features,
            custom_requirements=request.custom_requirements,
        )
        
        return {
            "prompt": prompt,
            "template_name": template["name"],
            "project_name": request.project_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/preview/{file_path:path}")
async def preview_project_file(project_id: str, file_path: str):
    """Serve static files from project workspace for preview"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        workspace_path = project.get("workspace_path")
        if not workspace_path or not Path(workspace_path).exists():
            raise HTTPException(status_code=404, detail="Project workspace not found")
        
        # Try dist folder first (for built projects), then root
        dist_path = Path(workspace_path) / "dist" / file_path
        root_path = Path(workspace_path) / file_path
        
        if dist_path.exists() and dist_path.is_file():
            full_path = dist_path
        elif root_path.exists() and root_path.is_file():
            full_path = root_path
        else:
            # Default to index.html in dist or root
            if file_path == "" or file_path == "index.html":
                if (Path(workspace_path) / "dist" / "index.html").exists():
                    full_path = Path(workspace_path) / "dist" / "index.html"
                elif (Path(workspace_path) / "index.html").exists():
                    full_path = Path(workspace_path) / "index.html"
                else:
                    raise HTTPException(status_code=404, detail="index.html not found")
            else:
                raise HTTPException(status_code=404, detail="File not found")
        
        # Determine media type
        suffix = full_path.suffix.lower()
        media_types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
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
        }
        media_type = media_types.get(suffix, 'application/octet-stream')
        
        return FileResponse(path=full_path, media_type=media_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Project Sharing API ====================


@router.post("/projects/{project_id}/share", response_model=ShareResponse)
async def create_share(
    project_id: str,
    request: ShareRequest,
    current_user: dict = Depends(get_current_user_required)
):
    """Create or update a share link for a project"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check ownership
        if project.get("user_id") and project["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to share this project")
        
        share = await create_project_share(
            project_id=project_id,
            is_public=request.is_public,
            expires_at=request.expires_at
        )
        
        share_url = f"{settings.FRONTEND_URL}/shared/{share['share_token']}"
        
        return ShareResponse(
            id=share["id"],
            project_id=share["project_id"],
            share_token=share["share_token"],
            is_public=bool(share["is_public"]),
            expires_at=share.get("expires_at"),
            view_count=share.get("view_count", 0),
            created_at=share["created_at"],
            share_url=share_url
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/share")
async def get_share_info(
    project_id: str,
    current_user: dict = Depends(get_current_user_required)
):
    """Get share info for a project"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check ownership
        if project.get("user_id") and project["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        share = await get_project_share(project_id)
        if not share:
            return {"shared": False}
        
        share_url = f"{settings.FRONTEND_URL}/shared/{share['share_token']}"
        
        return {
            "shared": True,
            "share": ShareResponse(
                id=share["id"],
                project_id=share["project_id"],
                share_token=share["share_token"],
                is_public=bool(share["is_public"]),
                expires_at=share.get("expires_at"),
                view_count=share.get("view_count", 0),
                created_at=share["created_at"],
                share_url=share_url
            )
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}/share")
async def remove_share(
    project_id: str,
    current_user: dict = Depends(get_current_user_required)
):
    """Remove share link for a project"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check ownership
        if project.get("user_id") and project["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        await delete_project_share(project_id)
        return {"message": "Share removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shared/{share_token}")
async def get_shared_project(
    share_token: str,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """Access a shared project by token"""
    try:
        project = await get_project_by_share_token(share_token)
        if not project:
            raise HTTPException(status_code=404, detail="Shared project not found or expired")
        
        share_info = project.pop("share_info", {})
        
        # Check if login is required
        if not share_info.get("is_public") and not current_user:
            raise HTTPException(
                status_code=401,
                detail="Login required to view this shared project"
            )
        
        return {
            "project": ProjectResponse(**project),
            "share_info": {
                "is_public": bool(share_info.get("is_public")),
                "view_count": share_info.get("view_count", 0)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shared/{share_token}/files")
async def get_shared_project_files(
    share_token: str,
    limit: int = MAX_FILES,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """Get files of a shared project"""
    try:
        project = await get_project_by_share_token(share_token)
        if not project:
            raise HTTPException(status_code=404, detail="Shared project not found or expired")
        
        share_info = project.get("share_info", {})
        
        # Check if login is required
        if not share_info.get("is_public") and not current_user:
            raise HTTPException(
                status_code=401,
                detail="Login required to view this shared project"
            )
        
        # Reuse the get_project_files logic
        workspace_path = project.get("workspace_path")
        if not workspace_path or not Path(workspace_path).exists():
            return {"files": [], "total": 0, "truncated": False}
        
        files = []
        total_count = 0
        workspace = Path(workspace_path)
        
        import os
        for root, dirs, filenames in os.walk(workspace):
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.endswith(".egg-info")]
            
            root_path = Path(root)
            for filename in filenames:
                file_path = root_path / filename
                relative_path = file_path.relative_to(workspace)
                
                if str(relative_path).startswith("."):
                    continue
                
                total_count += 1
                
                if len(files) < limit:
                    files.append({
                        "name": filename,
                        "path": str(relative_path),
                        "size": 0,
                        "extension": file_path.suffix,
                    })
        
        return {
            "files": files,
            "total": total_count,
            "truncated": total_count > limit,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Tags API ====================


@router.get("/tags", response_model=TagListResponse)
async def list_user_tags(
    current_user: dict = Depends(get_current_user_required)
):
    """Get all tags for the current user"""
    try:
        tags = await get_tags_by_user(current_user["id"])
        return TagListResponse(tags=[TagResponse(**t) for t in tags])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tags", response_model=TagResponse, status_code=201)
async def create_new_tag(
    request: TagCreate,
    current_user: dict = Depends(get_current_user_required)
):
    """Create a new tag"""
    try:
        tag = await create_tag(
            user_id=current_user["id"],
            name=request.name,
            color=request.color
        )
        return TagResponse(**tag)
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=409, detail="Tag with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tags/{tag_id}", response_model=TagResponse)
async def update_existing_tag(
    tag_id: str,
    request: TagUpdate,
    current_user: dict = Depends(get_current_user_required)
):
    """Update a tag"""
    try:
        tag = await get_tag(tag_id)
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        if tag["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        updated = await update_tag(
            tag_id=tag_id,
            name=request.name,
            color=request.color
        )
        return TagResponse(**updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tags/{tag_id}")
async def delete_existing_tag(
    tag_id: str,
    current_user: dict = Depends(get_current_user_required)
):
    """Delete a tag"""
    try:
        tag = await get_tag(tag_id)
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        if tag["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        await delete_tag(tag_id)
        return {"message": "Tag deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/tags/{tag_id}")
async def add_tag_to_project_endpoint(
    project_id: str,
    tag_id: str,
    current_user: dict = Depends(get_current_user_required)
):
    """Add a tag to a project"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check ownership
        if project.get("user_id") and project["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        tag = await get_tag(tag_id)
        if not tag or tag["user_id"] != current_user["id"]:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        await add_tag_to_project(project_id, tag_id)
        return {"message": "Tag added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}/tags/{tag_id}")
async def remove_tag_from_project_endpoint(
    project_id: str,
    tag_id: str,
    current_user: dict = Depends(get_current_user_required)
):
    """Remove a tag from a project"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check ownership
        if project.get("user_id") and project["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        await remove_tag_from_project(project_id, tag_id)
        return {"message": "Tag removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/tags", response_model=TagListResponse)
async def get_project_tags_endpoint(project_id: str):
    """Get all tags for a project"""
    try:
        project = await get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        tags = await get_project_tags(project_id)
        return TagListResponse(tags=[TagResponse(**t) for t in tags])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

