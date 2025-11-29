#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
SQLite Database for MGX Clone
Stores project metadata, users, and history
"""
import secrets
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import aiosqlite

# Database path
DB_PATH = Path(__file__).parent.parent.parent / "data" / "mgx_clone.db"


async def init_db():
    """Initialize database and create tables"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                display_name TEXT,
                avatar_url TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # Password reset tokens table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Projects table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                requirement TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                workspace_path TEXT,
                user_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Messages table
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
        
        # Project shares table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS project_shares (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                share_token TEXT UNIQUE NOT NULL,
                is_public INTEGER DEFAULT 1,
                expires_at TEXT,
                view_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        
        # Tags table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#3B82F6',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, name)
            )
        """)
        
        # Project-tags association table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS project_tags (
                project_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (project_id, tag_id),
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (tag_id) REFERENCES tags(id)
            )
        """)
        
        # Migration: Add user_id column to projects if not exists (must run before indexes)
        try:
            await db.execute("ALTER TABLE projects ADD COLUMN user_id TEXT REFERENCES users(id)")
        except Exception:
            pass  # Column already exists
        
        # Migration: Add conversation_round column if not exists
        try:
            await db.execute("ALTER TABLE messages ADD COLUMN conversation_round INTEGER DEFAULT 1")
        except Exception:
            pass  # Column already exists
        
        # Indexes (run after migrations)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_projects_created_at 
            ON projects(created_at DESC)
        """)
        
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_projects_user_id 
            ON projects(user_id)
        """)
        
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_project_id 
            ON messages(project_id)
        """)
        
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email 
            ON users(email)
        """)
        
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_username 
            ON users(username)
        """)
        
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_project_shares_token 
            ON project_shares(share_token)
        """)
        
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_tags_user_id 
            ON tags(user_id)
        """)
        
        await db.commit()


# ==================== User Functions ====================


async def create_user(
    email: str,
    username: str,
    hashed_password: str,
    display_name: Optional[str] = None
) -> dict:
    """Create a new user"""
    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO users (id, email, username, hashed_password, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, email.lower(), username, hashed_password, display_name or username, now, now)
        )
        await db.commit()
    
    return {
        "id": user_id,
        "email": email.lower(),
        "username": username,
        "display_name": display_name or username,
        "avatar_url": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get user by ID"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.lower(),)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def get_user_by_username(username: str) -> Optional[dict]:
    """Get user by username"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def update_user_profile(
    user_id: str,
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> Optional[dict]:
    """Update user profile"""
    now = datetime.utcnow().isoformat()
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Build update query dynamically
        updates = ["updated_at = ?"]
        params = [now]
        
        if display_name is not None:
            updates.append("display_name = ?")
            params.append(display_name)
        
        if avatar_url is not None:
            updates.append("avatar_url = ?")
            params.append(avatar_url)
        
        params.append(user_id)
        
        await db.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
            params
        )
        await db.commit()
    
    return await get_user_by_id(user_id)


async def update_user_password(user_id: str, hashed_password: str):
    """Update user password"""
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET hashed_password = ?, updated_at = ? WHERE id = ?",
            (hashed_password, now, user_id)
        )
        await db.commit()


# ==================== Password Reset Functions ====================


async def create_password_reset_token(user_id: str) -> str:
    """Create a password reset token"""
    token_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    expires_at = (now + timedelta(hours=1)).isoformat()
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Invalidate any existing tokens for this user
        await db.execute(
            "UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0",
            (user_id,)
        )
        
        await db.execute(
            """
            INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (token_id, user_id, token, expires_at, now.isoformat())
        )
        await db.commit()
    
    return token


async def get_password_reset_token(token: str) -> Optional[dict]:
    """Get password reset token info"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT * FROM password_reset_tokens 
            WHERE token = ? AND used = 0 AND expires_at > ?
            """,
            (token, datetime.utcnow().isoformat())
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def use_password_reset_token(token: str):
    """Mark password reset token as used"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE password_reset_tokens SET used = 1 WHERE token = ?",
            (token,)
        )
        await db.commit()


async def create_project(name: str, requirement: str, user_id: Optional[str] = None) -> dict:
    """Create a new project record"""
    project_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO projects (id, name, requirement, status, user_id, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?, ?)
            """,
            (project_id, name, requirement, user_id, now, now)
        )
        await db.commit()
    
    return {
        "id": project_id,
        "name": name,
        "requirement": requirement,
        "status": "pending",
        "workspace_path": None,
        "user_id": user_id,
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


async def get_all_projects(
    skip: int = 0,
    limit: int = 20,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    tag_id: Optional[str] = None
) -> list[dict]:
    """Get all projects with pagination, optional user filter, search, and tag filter
    
    - If user_id is provided: return only that user's projects
    - If user_id is None: return only anonymous projects (user_id IS NULL)
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        
        # Build query dynamically
        conditions = ["status != 'deleted'"]
        params = []
        
        # User filter: logged-in users see their projects, anonymous see anonymous projects
        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        else:
            # Anonymous users only see anonymous projects
            conditions.append("user_id IS NULL")
        
        if search:
            conditions.append("(name LIKE ? OR requirement LIKE ?)")
            search_term = f"%{search}%"
            params.extend([search_term, search_term])
        
        if tag_id:
            conditions.append("id IN (SELECT project_id FROM project_tags WHERE tag_id = ?)")
            params.append(tag_id)
        
        params.extend([limit, skip])
        
        query = f"""
            SELECT * FROM projects 
            WHERE {' AND '.join(conditions)}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        """
        
        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def count_projects(
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    tag_id: Optional[str] = None
) -> int:
    """Count projects with optional filters
    
    - If user_id is provided: count only that user's projects
    - If user_id is None: count only anonymous projects (user_id IS NULL)
    """
    async with aiosqlite.connect(DB_PATH) as db:
        conditions = ["status != 'deleted'"]
        params = []
        
        # User filter: logged-in users see their projects, anonymous see anonymous projects
        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        else:
            conditions.append("user_id IS NULL")
        
        if search:
            conditions.append("(name LIKE ? OR requirement LIKE ?)")
            search_term = f"%{search}%"
            params.extend([search_term, search_term])
        
        if tag_id:
            conditions.append("id IN (SELECT project_id FROM project_tags WHERE tag_id = ?)")
            params.append(tag_id)
        
        query = f"SELECT COUNT(*) FROM projects WHERE {' AND '.join(conditions)}"
        
        async with db.execute(query, params) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0


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


# ==================== Project Share Functions ====================


async def create_project_share(
    project_id: str,
    is_public: bool = True,
    expires_at: Optional[str] = None
) -> dict:
    """Create or update a share link for a project"""
    share_id = str(uuid.uuid4())
    share_token = secrets.token_urlsafe(16)
    now = datetime.utcnow().isoformat()
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Check if share already exists
        async with db.execute(
            "SELECT * FROM project_shares WHERE project_id = ?",
            (project_id,)
        ) as cursor:
            existing = await cursor.fetchone()
        
        if existing:
            # Update existing share
            await db.execute(
                """
                UPDATE project_shares 
                SET is_public = ?, expires_at = ?
                WHERE project_id = ?
                """,
                (1 if is_public else 0, expires_at, project_id)
            )
            share_token = existing[2]  # Keep existing token
            share_id = existing[0]
        else:
            # Create new share
            await db.execute(
                """
                INSERT INTO project_shares (id, project_id, share_token, is_public, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (share_id, project_id, share_token, 1 if is_public else 0, expires_at, now)
            )
        
        await db.commit()
    
    return {
        "id": share_id,
        "project_id": project_id,
        "share_token": share_token,
        "is_public": is_public,
        "expires_at": expires_at,
        "view_count": 0,
        "created_at": now
    }


async def get_project_share(project_id: str) -> Optional[dict]:
    """Get share info for a project"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM project_shares WHERE project_id = ?",
            (project_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def get_project_by_share_token(share_token: str) -> Optional[dict]:
    """Get project by share token"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        
        # Get share info
        async with db.execute(
            "SELECT * FROM project_shares WHERE share_token = ?",
            (share_token,)
        ) as cursor:
            share = await cursor.fetchone()
        
        if not share:
            return None
        
        share_dict = dict(share)
        
        # Check if expired
        if share_dict.get("expires_at"):
            if datetime.fromisoformat(share_dict["expires_at"]) < datetime.utcnow():
                return None
        
        # Increment view count
        await db.execute(
            "UPDATE project_shares SET view_count = view_count + 1 WHERE share_token = ?",
            (share_token,)
        )
        await db.commit()
        
        # Get project
        async with db.execute(
            "SELECT * FROM projects WHERE id = ?",
            (share_dict["project_id"],)
        ) as cursor:
            project = await cursor.fetchone()
            if project:
                result = dict(project)
                result["share_info"] = share_dict
                return result
    
    return None


async def delete_project_share(project_id: str):
    """Delete share link for a project"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM project_shares WHERE project_id = ?",
            (project_id,)
        )
        await db.commit()


# ==================== Tag Functions ====================


async def create_tag(user_id: str, name: str, color: str = "#3B82F6") -> dict:
    """Create a new tag"""
    tag_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO tags (id, user_id, name, color, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (tag_id, user_id, name, color, now)
        )
        await db.commit()
    
    return {
        "id": tag_id,
        "user_id": user_id,
        "name": name,
        "color": color,
        "created_at": now
    }


async def get_tags_by_user(user_id: str) -> list[dict]:
    """Get all tags for a user"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tags WHERE user_id = ? ORDER BY name",
            (user_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_tag(tag_id: str) -> Optional[dict]:
    """Get tag by ID"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tags WHERE id = ?",
            (tag_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def update_tag(tag_id: str, name: Optional[str] = None, color: Optional[str] = None) -> Optional[dict]:
    """Update a tag"""
    async with aiosqlite.connect(DB_PATH) as db:
        updates = []
        params = []
        
        if name is not None:
            updates.append("name = ?")
            params.append(name)
        
        if color is not None:
            updates.append("color = ?")
            params.append(color)
        
        if not updates:
            return await get_tag(tag_id)
        
        params.append(tag_id)
        
        await db.execute(
            f"UPDATE tags SET {', '.join(updates)} WHERE id = ?",
            params
        )
        await db.commit()
    
    return await get_tag(tag_id)


async def delete_tag(tag_id: str):
    """Delete a tag and its associations"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM project_tags WHERE tag_id = ?", (tag_id,))
        await db.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
        await db.commit()


async def add_tag_to_project(project_id: str, tag_id: str):
    """Add a tag to a project"""
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                "INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)",
                (project_id, tag_id)
            )
            await db.commit()
        except Exception:
            pass  # Already exists


async def remove_tag_from_project(project_id: str, tag_id: str):
    """Remove a tag from a project"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM project_tags WHERE project_id = ? AND tag_id = ?",
            (project_id, tag_id)
        )
        await db.commit()


async def get_project_tags(project_id: str) -> list[dict]:
    """Get all tags for a project"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT t.* FROM tags t
            JOIN project_tags pt ON t.id = pt.tag_id
            WHERE pt.project_id = ?
            ORDER BY t.name
            """,
            (project_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
