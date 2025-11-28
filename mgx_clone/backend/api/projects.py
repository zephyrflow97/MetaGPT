"""Project API endpoints."""

import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from mgx_clone.backend.models.schemas import (
    CreateProjectRequest,
    HistoryResponse,
    ProjectDetail,
    ProjectFile,
    ProjectInfo,
    ProjectStatus,
)
from mgx_clone.backend.storage.database import get_db
from mgx_clone.backend.storage.repository import ProjectRepository

router = APIRouter()


@router.post("", response_model=ProjectInfo)
async def create_project(request: CreateProjectRequest):
    """Create a new project (without starting generation)."""
    async with get_db() as db:
        repo = ProjectRepository(db)
        project = await repo.create_project(
            requirement=request.requirement,
            name=request.project_name,
        )
        return project


@router.get("", response_model=HistoryResponse)
async def list_projects(
    skip: int = 0,
    limit: int = 50,
    status: Optional[ProjectStatus] = None,
):
    """List all projects with optional filtering."""
    async with get_db() as db:
        repo = ProjectRepository(db)
        items, total = await repo.list_projects(skip=skip, limit=limit, status=status)
        return HistoryResponse(items=items, total=total)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: str):
    """Get project details including files."""
    async with get_db() as db:
        repo = ProjectRepository(db)
        project = await repo.get_project(project_id)
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Load files if workspace exists
        files = []
        if project.workspace_path and Path(project.workspace_path).exists():
            files = _load_project_files(Path(project.workspace_path))
        
        return ProjectDetail(
            **project.model_dump(),
            files=files,
        )


@router.get("/{project_id}/files/{file_path:path}")
async def get_project_file(project_id: str, file_path: str):
    """Get content of a specific file in the project."""
    async with get_db() as db:
        repo = ProjectRepository(db)
        project = await repo.get_project(project_id)
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        if not project.workspace_path:
            raise HTTPException(status_code=404, detail="Project has no workspace")
        
        full_path = Path(project.workspace_path) / file_path
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        if full_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is a directory")
        
        try:
            content = full_path.read_text(encoding="utf-8")
            return {"path": file_path, "content": content}
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File is not text")


@router.get("/{project_id}/download")
async def download_project(project_id: str):
    """Download project as a zip file."""
    async with get_db() as db:
        repo = ProjectRepository(db)
        project = await repo.get_project(project_id)
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        if not project.workspace_path or not Path(project.workspace_path).exists():
            raise HTTPException(status_code=404, detail="Project has no workspace")
        
        # Create zip file
        workspace_path = Path(project.workspace_path)
        zip_name = f"{project.name or project_id}"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
            zip_path = shutil.make_archive(
                tmp.name.replace(".zip", ""),
                "zip",
                workspace_path,
            )
            
            return FileResponse(
                zip_path,
                media_type="application/zip",
                filename=f"{zip_name}.zip",
            )


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    async with get_db() as db:
        repo = ProjectRepository(db)
        success = await repo.delete_project(project_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return {"message": "Project deleted"}


def _load_project_files(workspace_path: Path, max_depth: int = 5) -> list[ProjectFile]:
    """Load project files recursively."""
    files = []
    
    def _scan_dir(path: Path, depth: int = 0):
        if depth > max_depth:
            return
        
        try:
            for item in sorted(path.iterdir()):
                # Skip hidden files and common non-essential dirs
                if item.name.startswith(".") or item.name in ["node_modules", "__pycache__", ".git"]:
                    continue
                
                rel_path = str(item.relative_to(workspace_path))
                
                if item.is_dir():
                    files.append(ProjectFile(
                        path=rel_path,
                        name=item.name,
                        is_directory=True,
                    ))
                    _scan_dir(item, depth + 1)
                else:
                    files.append(ProjectFile(
                        path=rel_path,
                        name=item.name,
                        is_directory=False,
                    ))
        except PermissionError:
            pass
    
    _scan_dir(workspace_path)
    return files

