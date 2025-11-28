"""Repository for database operations."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from mgx_clone.backend.models.schemas import (
    HistoryItem,
    ProjectInfo,
    ProjectStatus,
)
from mgx_clone.backend.storage.database import MessageModel, ProjectModel


class ProjectRepository:
    """Repository for project operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_project(
        self,
        requirement: str,
        name: Optional[str] = None,
    ) -> ProjectInfo:
        """Create a new project."""
        project_id = str(uuid.uuid4())
        
        # Generate name if not provided
        if not name:
            name = requirement[:50] + "..." if len(requirement) > 50 else requirement
        
        project = ProjectModel(
            id=project_id,
            name=name,
            requirement=requirement,
            status=ProjectStatus.PENDING.value,
        )
        
        self.session.add(project)
        await self.session.flush()
        
        return ProjectInfo(
            id=project.id,
            name=project.name,
            requirement=project.requirement,
            status=ProjectStatus(project.status),
            workspace_path=project.workspace_path,
            created_at=project.created_at or datetime.now(),
            updated_at=project.updated_at or datetime.now(),
        )
    
    async def get_project(self, project_id: str) -> Optional[ProjectInfo]:
        """Get a project by ID."""
        result = await self.session.execute(
            select(ProjectModel).where(ProjectModel.id == project_id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return None
        
        return ProjectInfo(
            id=project.id,
            name=project.name,
            requirement=project.requirement,
            status=ProjectStatus(project.status),
            workspace_path=project.workspace_path,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
    
    async def update_project(
        self,
        project_id: str,
        status: Optional[ProjectStatus] = None,
        workspace_path: Optional[str] = None,
        total_cost: Optional[float] = None,
    ) -> Optional[ProjectInfo]:
        """Update project fields."""
        result = await self.session.execute(
            select(ProjectModel).where(ProjectModel.id == project_id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return None
        
        if status:
            project.status = status.value
        if workspace_path:
            project.workspace_path = workspace_path
        if total_cost is not None:
            project.total_cost = total_cost
        
        project.updated_at = datetime.now()
        await self.session.flush()
        
        return await self.get_project(project_id)
    
    async def update_project_status(
        self,
        project_id: str,
        status: ProjectStatus,
    ) -> bool:
        """Update project status."""
        result = await self.session.execute(
            select(ProjectModel).where(ProjectModel.id == project_id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return False
        
        project.status = status.value
        project.updated_at = datetime.now()
        await self.session.flush()
        return True
    
    async def list_projects(
        self,
        skip: int = 0,
        limit: int = 50,
        status: Optional[ProjectStatus] = None,
    ) -> tuple[list[HistoryItem], int]:
        """List projects with pagination."""
        query = select(ProjectModel).order_by(ProjectModel.created_at.desc())
        count_query = select(func.count(ProjectModel.id))
        
        if status:
            query = query.where(ProjectModel.status == status.value)
            count_query = count_query.where(ProjectModel.status == status.value)
        
        # Get total count
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Get paginated results
        query = query.offset(skip).limit(limit)
        result = await self.session.execute(query)
        projects = result.scalars().all()
        
        items = [
            HistoryItem(
                id=p.id,
                name=p.name,
                requirement=p.requirement,
                status=ProjectStatus(p.status),
                created_at=p.created_at,
            )
            for p in projects
        ]
        
        return items, total
    
    async def delete_project(self, project_id: str) -> bool:
        """Delete a project."""
        result = await self.session.execute(
            select(ProjectModel).where(ProjectModel.id == project_id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            return False
        
        await self.session.delete(project)
        await self.session.flush()
        return True
    
    async def save_message(
        self,
        project_id: str,
        agent_name: str,
        agent_profile: str,
        content: str,
        message_type: str,
    ) -> None:
        """Save a message to history."""
        message = MessageModel(
            id=str(uuid.uuid4()),
            project_id=project_id,
            agent_name=agent_name,
            agent_profile=agent_profile,
            content=content,
            message_type=message_type,
        )
        self.session.add(message)
        await self.session.flush()

