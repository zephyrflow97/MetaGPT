"""Pydantic schemas for API requests and responses."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProjectStatus(str, Enum):
    """Project status enum."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class MessageType(str, Enum):
    """WebSocket message type enum."""
    USER_INPUT = "user_input"
    AGENT_MESSAGE = "agent_message"
    AGENT_STATUS = "agent_status"
    PROJECT_UPDATE = "project_update"
    ERROR = "error"
    COMPLETE = "complete"


# Request schemas
class CreateProjectRequest(BaseModel):
    """Request to create a new project."""
    requirement: str = Field(..., description="User's natural language requirement")
    project_name: Optional[str] = Field(None, description="Optional project name")


class ChatMessage(BaseModel):
    """Chat message from user via WebSocket."""
    type: MessageType = MessageType.USER_INPUT
    content: str
    project_id: Optional[str] = None


# Response schemas
class ProjectInfo(BaseModel):
    """Project information response."""
    id: str
    name: str
    requirement: str
    status: ProjectStatus
    workspace_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProjectFile(BaseModel):
    """A file in the project."""
    path: str
    name: str
    content: Optional[str] = None
    is_directory: bool = False


class ProjectDetail(ProjectInfo):
    """Detailed project information including files."""
    files: list[ProjectFile] = []
    total_cost: Optional[float] = None


class AgentMessage(BaseModel):
    """Message from an agent during project generation."""
    type: MessageType
    agent_name: str
    agent_profile: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    metadata: Optional[dict[str, Any]] = None


class WSMessage(BaseModel):
    """WebSocket message wrapper."""
    type: MessageType
    data: Any
    timestamp: datetime = Field(default_factory=datetime.now)


class HistoryItem(BaseModel):
    """History item for sidebar display."""
    id: str
    name: str
    requirement: str
    status: ProjectStatus
    created_at: datetime


class HistoryResponse(BaseModel):
    """Response for history endpoint."""
    items: list[HistoryItem]
    total: int

