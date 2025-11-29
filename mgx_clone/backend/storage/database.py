#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
SQLite Database for MGX Clone
Stores project metadata and history
"""
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiosqlite

# Database path
DB_PATH = Path(__file__).parent.parent.parent / "data" / "mgx_clone.db"


async def init_db():
    """Initialize database and create tables"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                requirement TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                workspace_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                agent TEXT NOT NULL,
                content TEXT NOT NULL,
                message_type TEXT DEFAULT 'agent_message',
                conversation_round INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_projects_created_at 
            ON projects(created_at DESC)
        """)
        
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_project_id 
            ON messages(project_id)
        """)
        
        # Add conversation_round column if not exists (migration)
        try:
            await db.execute("ALTER TABLE messages ADD COLUMN conversation_round INTEGER DEFAULT 1")
        except Exception:
            pass  # Column already exists
        
        await db.commit()


async def create_project(name: str, requirement: str) -> dict:
    """Create a new project record"""
    project_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO projects (id, name, requirement, status, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?)
            """,
            (project_id, name, requirement, now, now)
        )
        await db.commit()
    
    return {
        "id": project_id,
        "name": name,
        "requirement": requirement,
        "status": "pending",
        "workspace_path": None,
        "created_at": now,
        "updated_at": now
    }


async def get_project(project_id: str) -> Optional[dict]:
    """Get project by ID"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM projects WHERE id = ?",
            (project_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def get_all_projects(skip: int = 0, limit: int = 20) -> list[dict]:
    """Get all projects with pagination"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT * FROM projects 
            WHERE status != 'deleted'
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
            """,
            (limit, skip)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def update_project_status(project_id: str, status: str):
    """Update project status"""
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE projects SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, project_id)
        )
        await db.commit()


async def update_project_workspace(project_id: str, workspace_path: str):
    """Update project workspace path"""
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE projects SET workspace_path = ?, updated_at = ? WHERE id = ?",
            (workspace_path, now, project_id)
        )
        await db.commit()


async def save_message(
    project_id: str,
    agent: str,
    content: str,
    message_type: str = "agent_message",
    conversation_round: int = 1
) -> dict:
    """Save a message to database"""
    message_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO messages (id, project_id, agent, content, message_type, conversation_round, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (message_id, project_id, agent, content, message_type, conversation_round, now)
        )
        await db.commit()
    
    return {
        "id": message_id,
        "project_id": project_id,
        "agent": agent,
        "content": content,
        "message_type": message_type,
        "conversation_round": conversation_round,
        "created_at": now
    }


async def get_latest_conversation_round(project_id: str) -> int:
    """Get the latest conversation round for a project"""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT MAX(conversation_round) FROM messages WHERE project_id = ?",
            (project_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row and row[0] else 0


async def save_user_message(
    project_id: str,
    content: str,
    conversation_round: int = 1
) -> dict:
    """Save a user message to database"""
    return await save_message(
        project_id=project_id,
        agent="User",
        content=content,
        message_type="user",
        conversation_round=conversation_round
    )


async def get_project_messages(project_id: str) -> list[dict]:
    """Get all messages for a project"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT * FROM messages 
            WHERE project_id = ? 
            ORDER BY conversation_round ASC, created_at ASC
            """,
            (project_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_conversation_history(project_id: str) -> list[dict]:
    """Get conversation history grouped by rounds for a project"""
    messages = await get_project_messages(project_id)
    
    # Group by conversation round
    rounds: dict[int, list[dict]] = {}
    for msg in messages:
        round_num = msg.get("conversation_round", 1)
        if round_num not in rounds:
            rounds[round_num] = []
        rounds[round_num].append(msg)
    
    return [
        {"round": round_num, "messages": round_messages}
        for round_num, round_messages in sorted(rounds.items())
    ]
