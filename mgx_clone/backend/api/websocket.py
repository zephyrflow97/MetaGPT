#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
WebSocket Handler for MGX Clone
Handles real-time communication for project generation
"""
import asyncio
import json
import logging
import traceback
import uuid
from typing import Optional, Callable

logger = logging.getLogger(__name__)

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from mgx_clone.backend.core.security import get_user_id_from_token
from mgx_clone.backend.services.metagpt_service import MetaGPTService
from mgx_clone.backend.services.templates import generate_prompt_from_template, get_template
from mgx_clone.backend.storage.database import (
    create_project,
    get_latest_conversation_round,
    get_project,
    get_project_messages,
    get_user_by_id,
    save_message,
    save_user_message,
    update_project_status,
    update_project_workspace,
)

router = APIRouter()


class PendingQuestionManager:
    """Manages pending questions waiting for user responses"""
    
    def __init__(self):
        # question_id -> {event, project_id, client_id, content}
        self._pending: dict[str, dict] = {}
        # question_id -> response
        self._responses: dict[str, str] = {}
    
    def create_question(
        self, 
        project_id: str, 
        client_id: str, 
        content: str,
        question_type: str = "inline",
        options: Optional[list[str]] = None
    ) -> tuple[str, asyncio.Event]:
        """Create a new pending question and return its ID and event"""
        question_id = f"q-{uuid.uuid4().hex[:12]}"
        event = asyncio.Event()
        self._pending[question_id] = {
            "event": event,
            "project_id": project_id,
            "client_id": client_id,
            "content": content,
            "question_type": question_type,
            "options": options,
        }
        return question_id, event
    
    def has_question(self, question_id: str) -> bool:
        """Check if a question is pending"""
        return question_id in self._pending
    
    def get_question(self, question_id: str) -> Optional[dict]:
        """Get pending question info"""
        return self._pending.get(question_id)
    
    def resolve_question(self, question_id: str, response: str) -> bool:
        """Resolve a pending question with user's response"""
        if question_id not in self._pending:
            return False
        
        self._responses[question_id] = response
        self._pending[question_id]["event"].set()
        return True
    
    def get_response(self, question_id: str) -> Optional[str]:
        """Get and remove the response for a question"""
        return self._responses.pop(question_id, None)
    
    def cleanup_question(self, question_id: str):
        """Remove a question from pending (after timeout or response)"""
        self._pending.pop(question_id, None)
        self._responses.pop(question_id, None)
    
    def get_pending_for_client(self, client_id: str) -> Optional[dict]:
        """Get any pending question for a client"""
        for q_id, info in self._pending.items():
            if info["client_id"] == client_id:
                return {"question_id": q_id, **info}
        return None


# Global pending question manager
pending_questions = PendingQuestionManager()

# Agent 列表用于进度追踪
# 注意：MetaGPT 的角色名称可能因配置而异，这里列出常见的角色名称变体
# display 使用实际角色名（与对话中显示的名称一致）
AGENT_WORKFLOW = [
    {"name": "Mike", "aliases": ["TeamLeader", "Team Leader"], "display": "Mike", "role": "Team Leader", "description": "Analyzing requirements and coordinating"},
    {"name": "Mia", "aliases": ["ProductManager", "Product Manager"], "display": "Mia", "role": "Product Manager", "description": "Creating product specification"},
    {"name": "Alex", "aliases": ["Engineer", "Engineer2"], "display": "Alex", "role": "Engineer", "description": "Implementing code"},
    {"name": "Archer", "aliases": ["Architect"], "display": "Archer", "role": "Architect", "description": "Designing system architecture"},
    {"name": "Dino", "aliases": ["DataAnalyst", "Data Analyst"], "display": "Dino", "role": "Data Analyst", "description": "Analyzing data requirements"},
]

# 创建 agent 名称到索引的映射（包括别名）
AGENT_NAME_MAP = {}
for idx, agent in enumerate(AGENT_WORKFLOW):
    AGENT_NAME_MAP[agent["name"]] = idx
    AGENT_NAME_MAP[agent["display"]] = idx
    AGENT_NAME_MAP[agent["role"]] = idx
    for alias in agent.get("aliases", []):
        AGENT_NAME_MAP[alias] = idx


class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.user_ids: dict[str, Optional[str]] = {}  # client_id -> user_id
    
    async def connect(self, websocket: WebSocket, client_id: str, user_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.user_ids[client_id] = user_id
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.user_ids:
            del self.user_ids[client_id]
    
    def get_user_id(self, client_id: str) -> Optional[str]:
        return self.user_ids.get(client_id)
    
    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception:
                self.disconnect(client_id)
    
    async def send_clarification(
        self,
        client_id: str,
        question_id: str,
        agent: str,
        content: str,
        project_id: str,
        question_type: str = "inline",
        options: Optional[list[str]] = None,
    ):
        """Send a clarification request to the client"""
        message = {
            "type": "clarification",
            "agent": agent,
            "content": content,
            "project_id": project_id,
            "question_id": question_id,
            "question_type": question_type,
        }
        if options:
            message["options"] = options
        await self.send_message(client_id, message)
    
    async def broadcast(self, message: dict):
        disconnected = []
        for client_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(client_id)
        
        for client_id in disconnected:
            self.disconnect(client_id)


manager = ConnectionManager()


@router.websocket("/ws/chat/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str,
    token: Optional[str] = Query(default=None)
):
    """
    WebSocket endpoint for chat-based project generation
    
    Query parameters:
    - token: Optional JWT token for authentication
    
    Message format (client -> server):
    {
        "type": "create_project",
        "name": "project_name",
        "requirement": "Create a 2048 game"
    }
    
    Message format (server -> client):
    {
        "type": "agent_message" | "status" | "error" | "complete" | "progress" | "agent_status",
        "agent": "ProductManager",  # for agent_message
        "content": "...",
        "project_id": "...",  # for status updates
        "timestamp": "...",
        "progress": { "current": 2, "total": 5, "percentage": 40 },  # for progress
        "agent_states": [...]  # for agent_status
    }
    """
    # Authenticate user if token provided
    user_id = None
    if token:
        user_id = get_user_id_from_token(token)
        if user_id:
            # Verify user exists and is active
            user = await get_user_by_id(user_id)
            if not user or not user.get("is_active"):
                user_id = None
    
    await manager.connect(websocket, client_id, user_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            
            if msg_type == "create_project":
                # Run in background task to avoid blocking message loop
                # This allows user_response messages to be processed while project is generating
                asyncio.create_task(handle_create_project(client_id, message))
            elif msg_type == "create_from_template":
                asyncio.create_task(handle_create_from_template(client_id, message))
            elif msg_type == "continue_conversation":
                asyncio.create_task(handle_continue_conversation(client_id, message))
            elif msg_type == "regenerate_project":
                asyncio.create_task(handle_regenerate_project(client_id, message))
            elif msg_type == "retry_project":
                asyncio.create_task(handle_retry_project(client_id, message))
            elif msg_type == "user_response":
                # Handle immediately - unblocks waiting ask_human calls
                await handle_user_response(client_id, message)
            elif msg_type == "skip_question":
                await handle_skip_question(client_id, message)
            elif msg_type == "ping":
                await manager.send_message(client_id, {"type": "pong"})
            else:
                await manager.send_message(client_id, {
                    "type": "error",
                    "content": f"Unknown message type: {msg_type}"
                })
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        await manager.send_message(client_id, {
            "type": "error",
            "content": str(e)
        })
        manager.disconnect(client_id)


async def handle_create_project(client_id: str, message: dict):
    """Handle project creation request (requires authentication)"""
    name = message.get("name", "Untitled Project")
    requirement = message.get("requirement", "")
    
    if not requirement:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Requirement is required"
        })
        return
    
    # Get user_id from connection manager - authentication required
    user_id = manager.get_user_id(client_id)
    if not user_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Authentication required. Please log in to create projects.",
            "auth_required": True
        })
        return
    
    # Create project record with user_id
    project = await create_project(name, requirement, user_id=user_id)
    project_id = project["id"]
    
    # Save and send initial status message
    await save_message(project_id, "System", "Project created, starting generation...", "status")
    await manager.send_message(client_id, {
        "type": "status",
        "content": "Project created, starting generation...",
        "project_id": project_id,
        "status": "created"
    })
    
    # Track current agent for progress - 使用任务中的 assignee 来追踪
    agent_progress = {
        "current_idx": 0, 
        "agents_seen": set(),
        "current_assignee": "",  # 当前任务分配的 agent
        "tasks_seen": set(),  # 已处理的任务 ID
    }
    
    # Task callback 函数 - 处理 TaskReporter 发送的任务状态更新
    async def task_callback(tasks: list, current_task_id: str, current_assignee: str, instruction: str):
        """处理来自 MetaGPT Plan 的任务状态更新"""
        nonlocal agent_progress
        
        # 更新当前 assignee
        agent_progress["current_assignee"] = current_assignee
        
        # 如果这是新任务，更新进度
        if current_task_id and current_task_id not in agent_progress["tasks_seen"]:
            agent_progress["tasks_seen"].add(current_task_id)
            agent_progress["agents_seen"].add(current_assignee)
            
            # 查找 agent 索引
            if current_assignee in AGENT_NAME_MAP:
                agent_progress["current_idx"] = AGENT_NAME_MAP[current_assignee] + 1
            
            # 构建 agent 状态
            total = len(AGENT_WORKFLOW)
            current = agent_progress["current_idx"]
            percentage = int((current / total) * 100)
            
            agent_states = []
            for idx, a in enumerate(AGENT_WORKFLOW):
                is_seen = (
                    a["name"] in agent_progress["agents_seen"] or 
                    a["display"] in agent_progress["agents_seen"] or 
                    any(alias in agent_progress["agents_seen"] for alias in a.get("aliases", []))
                )
                if is_seen:
                    state = "completed" if idx < agent_progress["current_idx"] - 1 else "active"
                else:
                    state = "pending"
                agent_states.append({
                    "name": a["display"],
                    "state": state,
                    "description": a["description"],
                })
            
            # 发送任务更新到前端
            await manager.send_message(client_id, {
                "type": "task_update",
                "project_id": project_id,
                "current_task_id": current_task_id,
                "current_assignee": current_assignee,
                "instruction": instruction[:200] if instruction else "",  # 截断过长的指令
                "progress": {
                    "current": current,
                    "total": total,
                    "percentage": percentage,
                    "current_agent": current_assignee,
                },
                "agent_states": agent_states,
            })
            
            logger.info(f"Task update: {current_assignee} working on task {current_task_id}")
    
    # Callback function to send messages to client AND save to database
    async def message_callback(agent: str, content: str, msg_type: str = "agent_message"):
        # Save message to database
        await save_message(
            project_id=project_id,
            agent=agent,
            content=content,
            message_type=msg_type
        )
        
        # 获取当前 assignee（从 task_callback 更新）
        # 如果有任务 assignee，优先使用它；否则使用消息中的 agent
        current_agent = agent_progress.get("current_assignee") or agent
        
        # Update progress tracking (for agent_message and reply_to_human messages)
        if msg_type in ("agent_message", "reply_to_human") and agent not in agent_progress["agents_seen"]:
            agent_progress["agents_seen"].add(agent)
            # Find agent index using name map (includes aliases)
            if agent in AGENT_NAME_MAP:
                agent_progress["current_idx"] = AGENT_NAME_MAP[agent] + 1
            
            # Send progress update
            total = len(AGENT_WORKFLOW)
            current = agent_progress["current_idx"]
            percentage = int((current / total) * 100)
            
            # Build agent states - check if any agent name or alias is in seen set
            agent_states = []
            for idx, a in enumerate(AGENT_WORKFLOW):
                # Check if this agent has been seen (by name, display name, or alias)
                is_seen = (
                    a["name"] in agent_progress["agents_seen"] or 
                    a["display"] in agent_progress["agents_seen"] or 
                    any(alias in agent_progress["agents_seen"] for alias in a.get("aliases", []))
                )
                if is_seen:
                    state = "completed" if idx < agent_progress["current_idx"] - 1 else "active"
                else:
                    state = "pending"
                agent_states.append({
                    "name": a["display"],
                    "state": state,
                    "description": a["description"],
                })
            
            await manager.send_message(client_id, {
                "type": "progress",
                "project_id": project_id,
                "progress": {
                    "current": current,
                    "total": total,
                    "percentage": percentage,
                    "current_agent": current_agent,
                },
                "agent_states": agent_states,
            })
        
        # Send message to client
        await manager.send_message(client_id, {
            "type": msg_type,
            "agent": agent,
            "content": content,
            "project_id": project_id
        })
    
    try:
        # Update status to running
        await update_project_status(project_id, "running")
        
        # Send initial agent states
        initial_states = [
            {"name": a["display"], "state": "pending", "description": a["description"]}
            for a in AGENT_WORKFLOW
        ]
        await manager.send_message(client_id, {
            "type": "agent_status",
            "project_id": project_id,
            "agent_states": initial_states,
        })
        
        # Create ask_human callback for this project
        ask_human_cb = create_ask_human_callback(
            client_id=client_id,
            project_id=project_id,
            timeout=300.0  # 5 minutes timeout
        )
        
        # Initialize MetaGPT service and run (with task callback for progress tracking)
        service = MetaGPTService(
            message_callback=message_callback,
            ask_human_callback=ask_human_cb,
            task_callback=task_callback,
        )
        workspace_path = await service.generate_project(requirement, name)
        
        # Update project with workspace path and completed status
        await update_project_workspace(project_id, str(workspace_path))
        await update_project_status(project_id, "completed")
        
        # Send final progress
        final_states = [
            {"name": a["display"], "state": "completed", "description": a["description"]}
            for a in AGENT_WORKFLOW
        ]
        await manager.send_message(client_id, {
            "type": "progress",
            "project_id": project_id,
            "progress": {"current": len(AGENT_WORKFLOW), "total": len(AGENT_WORKFLOW), "percentage": 100},
            "agent_states": final_states,
        })
        
        # Save and send completion message
        await save_message(project_id, "System", "Project generation completed!", "complete")
        await manager.send_message(client_id, {
            "type": "complete",
            "content": "Project generation completed!",
            "project_id": project_id,
            "workspace_path": str(workspace_path)
        })
    
    except Exception as e:
        error_msg = f"Error generating project: {str(e)}\n{traceback.format_exc()}"
        await update_project_status(project_id, "failed")
        # Save and send error message with retry info
        await save_message(project_id, "System", error_msg, "error")
        await manager.send_message(client_id, {
            "type": "error",
            "content": error_msg,
            "project_id": project_id,
            "can_retry": True,  # Indicate that retry is available
        })


async def handle_continue_conversation(client_id: str, message: dict):
    """Handle continuing conversation on an existing project"""
    project_id = message.get("project_id")
    user_message = message.get("message", "")
    
    if not project_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Project ID is required for continuing conversation"
        })
        return
    
    if not user_message:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Message is required"
        })
        return
    
    # Get existing project
    project = await get_project(project_id)
    if not project:
        await manager.send_message(client_id, {
            "type": "error",
            "content": f"Project not found: {project_id}"
        })
        return
    
    # Get the next conversation round
    current_round = await get_latest_conversation_round(project_id)
    new_round = current_round + 1
    
    # Save user message
    await save_user_message(project_id, user_message, new_round)
    
    # Send acknowledgment
    await manager.send_message(client_id, {
        "type": "status",
        "content": f"Continuing conversation (Round {new_round})...",
        "project_id": project_id,
        "status": "continuing",
        "conversation_round": new_round
    })
    
    # Track current agent for progress
    agent_progress = {
        "current_idx": 0, 
        "agents_seen": set(),
        "current_assignee": "",
        "tasks_seen": set(),
    }
    
    # Task callback 函数 - 处理任务状态更新
    async def task_callback(tasks: list, current_task_id: str, current_assignee: str, instruction: str):
        nonlocal agent_progress
        agent_progress["current_assignee"] = current_assignee
        
        if current_task_id and current_task_id not in agent_progress["tasks_seen"]:
            agent_progress["tasks_seen"].add(current_task_id)
            agent_progress["agents_seen"].add(current_assignee)
            
            if current_assignee in AGENT_NAME_MAP:
                agent_progress["current_idx"] = AGENT_NAME_MAP[current_assignee] + 1
            
            total = len(AGENT_WORKFLOW)
            current = agent_progress["current_idx"]
            percentage = int((current / total) * 100)
            
            agent_states = []
            for idx, a in enumerate(AGENT_WORKFLOW):
                is_seen = (
                    a["name"] in agent_progress["agents_seen"] or 
                    a["display"] in agent_progress["agents_seen"] or 
                    any(alias in agent_progress["agents_seen"] for alias in a.get("aliases", []))
                )
                state = "completed" if is_seen and idx < agent_progress["current_idx"] - 1 else ("active" if is_seen else "pending")
                agent_states.append({"name": a["display"], "state": state, "description": a["description"]})
            
            await manager.send_message(client_id, {
                "type": "task_update",
                "project_id": project_id,
                "current_task_id": current_task_id,
                "current_assignee": current_assignee,
                "instruction": instruction[:200] if instruction else "",
                "progress": {"current": current, "total": total, "percentage": percentage, "current_agent": current_assignee},
                "agent_states": agent_states,
                "conversation_round": new_round,
            })
    
    # Callback function to send messages to client AND save to database
    async def message_callback(agent: str, content: str, msg_type: str = "agent_message"):
        await save_message(
            project_id=project_id,
            agent=agent,
            content=content,
            message_type=msg_type,
            conversation_round=new_round
        )
        await manager.send_message(client_id, {
            "type": msg_type,
            "agent": agent,
            "content": content,
            "project_id": project_id,
            "conversation_round": new_round
        })
    
    try:
        # Update status to running
        await update_project_status(project_id, "running")
        
        # Build context from previous messages and new request
        original_requirement = project.get("requirement", "")
        workspace_path = project.get("workspace_path", "")
        
        # Get all previous user messages to build conversation history
        # Exclude current round (already saved above) to avoid duplication
        all_messages = await get_project_messages(project_id)
        previous_user_messages = [
            m for m in all_messages 
            if m.get("message_type") == "user" and m.get("conversation_round", 1) < new_round
        ]
        
        # Build conversation history string (only previous rounds)
        conversation_history = ""
        if previous_user_messages:
            history_parts = []
            for msg in previous_user_messages:
                round_num = msg.get("conversation_round", 1)
                content = msg.get("content", "")
                history_parts.append(f"  - Round {round_num}: {content}")
            conversation_history = "\n".join(history_parts)
        
        # Create enhanced prompt with full conversation context
        context_prompt = f"""You are continuing work on an existing project.

=== ORIGINAL REQUIREMENT ===
{original_requirement}

=== PREVIOUS MODIFICATION REQUESTS ===
{conversation_history if conversation_history else "(This is the first modification request)"}

=== CURRENT REQUEST (Round {new_round}) ===
{user_message}

=== EXISTING PROJECT ===
Location: {workspace_path}

=== INSTRUCTIONS ===
1. Analyze the existing codebase at the project location
2. Consider ALL previous modification requests in your implementation
3. Implement the CURRENT REQUEST while maintaining consistency with previous changes
4. Modify existing files when appropriate rather than creating entirely new ones
5. Maintain consistency with the existing coding style and architecture
"""
        
        # Create ask_human callback for this project
        ask_human_cb = create_ask_human_callback(
            client_id=client_id,
            project_id=project_id,
            timeout=300.0
        )
        
        # Initialize MetaGPT service and run with context (with task callback)
        service = MetaGPTService(
            message_callback=message_callback,
            ask_human_callback=ask_human_cb,
            task_callback=task_callback,
        )
        workspace_path = await service.continue_project(
            project_id=project_id,
            existing_workspace=workspace_path,
            new_requirement=context_prompt,
            project_name=project.get("name", "")
        )
        
        # Update project workspace if changed
        if workspace_path:
            await update_project_workspace(project_id, str(workspace_path))
        await update_project_status(project_id, "completed")
        
        # Save and send completion message
        await save_message(project_id, "System", "Conversation round completed!", "complete", new_round)
        await manager.send_message(client_id, {
            "type": "complete",
            "content": "Changes applied successfully!",
            "project_id": project_id,
            "workspace_path": str(workspace_path) if workspace_path else "",
            "conversation_round": new_round
        })
    
    except Exception as e:
        error_msg = f"Error during conversation: {str(e)}\n{traceback.format_exc()}"
        await update_project_status(project_id, "failed")
        await save_message(project_id, "System", error_msg, "error", new_round)
        await manager.send_message(client_id, {
            "type": "error",
            "content": error_msg,
            "project_id": project_id
        })


async def handle_regenerate_project(client_id: str, message: dict):
    """Handle regenerating an existing project"""
    project_id = message.get("project_id")
    
    if not project_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Project ID is required for regeneration"
        })
        return
    
    # Get existing project
    project = await get_project(project_id)
    if not project:
        await manager.send_message(client_id, {
            "type": "error",
            "content": f"Project not found: {project_id}"
        })
        return
    
    # Get the next conversation round
    current_round = await get_latest_conversation_round(project_id)
    new_round = current_round + 1
    
    # Save regeneration request
    await save_message(project_id, "User", "Regenerate project", "user", new_round)
    
    # Send acknowledgment
    await manager.send_message(client_id, {
        "type": "status",
        "content": "Regenerating project...",
        "project_id": project_id,
        "status": "regenerating",
        "conversation_round": new_round
    })
    
    # Track current agent for progress
    agent_progress = {"current_idx": 0, "agents_seen": set(), "current_assignee": "", "tasks_seen": set()}
    
    async def task_callback(tasks: list, current_task_id: str, current_assignee: str, instruction: str):
        nonlocal agent_progress
        agent_progress["current_assignee"] = current_assignee
        if current_task_id and current_task_id not in agent_progress["tasks_seen"]:
            agent_progress["tasks_seen"].add(current_task_id)
            agent_progress["agents_seen"].add(current_assignee)
            if current_assignee in AGENT_NAME_MAP:
                agent_progress["current_idx"] = AGENT_NAME_MAP[current_assignee] + 1
            total, current = len(AGENT_WORKFLOW), agent_progress["current_idx"]
            agent_states = [{"name": a["display"], "state": "completed" if (a["name"] in agent_progress["agents_seen"] or a["display"] in agent_progress["agents_seen"]) and idx < current - 1 else ("active" if (a["name"] in agent_progress["agents_seen"] or a["display"] in agent_progress["agents_seen"]) else "pending"), "description": a["description"]} for idx, a in enumerate(AGENT_WORKFLOW)]
            await manager.send_message(client_id, {"type": "task_update", "project_id": project_id, "current_assignee": current_assignee, "progress": {"current": current, "total": total, "percentage": int((current / total) * 100), "current_agent": current_assignee}, "agent_states": agent_states, "conversation_round": new_round})
    
    # Callback function
    async def message_callback(agent: str, content: str, msg_type: str = "agent_message"):
        await save_message(
            project_id=project_id,
            agent=agent,
            content=content,
            message_type=msg_type,
            conversation_round=new_round
        )
        await manager.send_message(client_id, {
            "type": msg_type,
            "agent": agent,
            "content": content,
            "project_id": project_id,
            "conversation_round": new_round
        })
    
    try:
        await update_project_status(project_id, "running")
        
        # Create ask_human callback for this project
        ask_human_cb = create_ask_human_callback(
            client_id=client_id,
            project_id=project_id,
            timeout=300.0
        )
        
        # Re-run generation with original requirement (with task callback)
        service = MetaGPTService(
            message_callback=message_callback,
            ask_human_callback=ask_human_cb,
            task_callback=task_callback,
        )
        workspace_path = await service.generate_project(
            requirement=project.get("requirement", ""),
            project_name=project.get("name", "")
        )
        
        await update_project_workspace(project_id, str(workspace_path))
        await update_project_status(project_id, "completed")
        
        await save_message(project_id, "System", "Project regenerated!", "complete", new_round)
        await manager.send_message(client_id, {
            "type": "complete",
            "content": "Project regenerated successfully!",
            "project_id": project_id,
            "workspace_path": str(workspace_path),
            "conversation_round": new_round
        })
    
    except Exception as e:
        error_msg = f"Error regenerating project: {str(e)}\n{traceback.format_exc()}"
        await update_project_status(project_id, "failed")
        await save_message(project_id, "System", error_msg, "error", new_round)
        await manager.send_message(client_id, {
            "type": "error",
            "content": error_msg,
            "project_id": project_id,
            "can_retry": True,
        })


async def handle_create_from_template(client_id: str, message: dict):
    """Handle project creation from a template (requires authentication)"""
    # Check authentication first
    user_id = manager.get_user_id(client_id)
    if not user_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Authentication required. Please log in to create projects.",
            "auth_required": True
        })
        return
    
    template_id = message.get("template_id")
    project_name = message.get("name", "My Project")
    selected_features = message.get("features", [])
    custom_requirements = message.get("custom_requirements", "")
    
    if not template_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Template ID is required"
        })
        return
    
    # Get template
    template = get_template(template_id)
    if not template:
        await manager.send_message(client_id, {
            "type": "error",
            "content": f"Template not found: {template_id}"
        })
        return
    
    # Generate prompt from template
    requirement = generate_prompt_from_template(
        template_id=template_id,
        project_name=project_name,
        selected_features=selected_features if selected_features else None,
        custom_requirements=custom_requirements if custom_requirements else None,
    )
    
    # Create project with generated prompt
    await handle_create_project(client_id, {
        "name": f"{project_name} ({template['name']})",
        "requirement": requirement,
    })


async def handle_retry_project(client_id: str, message: dict):
    """Handle retrying a failed project"""
    project_id = message.get("project_id")
    
    if not project_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Project ID is required for retry"
        })
        return
    
    # Get existing project
    project = await get_project(project_id)
    if not project:
        await manager.send_message(client_id, {
            "type": "error",
            "content": f"Project not found: {project_id}"
        })
        return
    
    # Only allow retry for failed projects
    if project.get("status") != "failed":
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Only failed projects can be retried"
        })
        return
    
    # Get the next conversation round
    current_round = await get_latest_conversation_round(project_id)
    new_round = current_round + 1
    
    # Save retry request
    await save_message(project_id, "User", "Retry project generation", "user", new_round)
    
    # Send acknowledgment
    await manager.send_message(client_id, {
        "type": "status",
        "content": "Retrying project generation...",
        "project_id": project_id,
        "status": "retrying",
        "conversation_round": new_round
    })
    
    # Track progress - 增加任务追踪
    agent_progress = {"current_idx": 0, "agents_seen": set(), "current_assignee": "", "tasks_seen": set()}
    
    # Task callback 函数
    async def task_callback(tasks: list, current_task_id: str, current_assignee: str, instruction: str):
        nonlocal agent_progress
        agent_progress["current_assignee"] = current_assignee
        if current_task_id and current_task_id not in agent_progress["tasks_seen"]:
            agent_progress["tasks_seen"].add(current_task_id)
            agent_progress["agents_seen"].add(current_assignee)
            if current_assignee in AGENT_NAME_MAP:
                agent_progress["current_idx"] = AGENT_NAME_MAP[current_assignee] + 1
            total, current = len(AGENT_WORKFLOW), agent_progress["current_idx"]
            agent_states = [{"name": a["display"], "state": "completed" if (a["name"] in agent_progress["agents_seen"] or a["display"] in agent_progress["agents_seen"]) and idx < current - 1 else ("active" if (a["name"] in agent_progress["agents_seen"] or a["display"] in agent_progress["agents_seen"]) else "pending"), "description": a["description"]} for idx, a in enumerate(AGENT_WORKFLOW)]
            await manager.send_message(client_id, {"type": "task_update", "project_id": project_id, "current_assignee": current_assignee, "progress": {"current": current, "total": total, "percentage": int((current / total) * 100), "current_agent": current_assignee}, "agent_states": agent_states, "conversation_round": new_round})
    
    # Callback function with progress tracking
    async def message_callback(agent: str, content: str, msg_type: str = "agent_message"):
        await save_message(
            project_id=project_id,
            agent=agent,
            content=content,
            message_type=msg_type,
            conversation_round=new_round
        )
        
        # Update progress tracking
        if msg_type == "agent_message" and agent not in agent_progress["agents_seen"]:
            agent_progress["agents_seen"].add(agent)
            # Find agent index using name map (includes aliases)
            if agent in AGENT_NAME_MAP:
                agent_progress["current_idx"] = AGENT_NAME_MAP[agent] + 1
            
            total = len(AGENT_WORKFLOW)
            current = agent_progress["current_idx"]
            percentage = int((current / total) * 100)
            
            # Build agent states - check if any agent name or alias is in seen set
            agent_states = []
            for idx, a in enumerate(AGENT_WORKFLOW):
                # Check if this agent has been seen (by name, display name, or alias)
                is_seen = (
                    a["name"] in agent_progress["agents_seen"] or 
                    a["display"] in agent_progress["agents_seen"] or 
                    any(alias in agent_progress["agents_seen"] for alias in a.get("aliases", []))
                )
                if is_seen:
                    state = "completed" if idx < agent_progress["current_idx"] - 1 else "active"
                else:
                    state = "pending"
                agent_states.append({
                    "name": a["display"],
                    "state": state,
                    "description": a["description"],
                })
            
            await manager.send_message(client_id, {
                "type": "progress",
                "project_id": project_id,
                "progress": {
                    "current": current,
                    "total": total,
                    "percentage": percentage,
                    "current_agent": agent,
                },
                "agent_states": agent_states,
                "conversation_round": new_round,
            })
        
        await manager.send_message(client_id, {
            "type": msg_type,
            "agent": agent,
            "content": content,
            "project_id": project_id,
            "conversation_round": new_round
        })
    
    try:
        await update_project_status(project_id, "running")
        
        # Send initial agent states
        initial_states = [
            {"name": a["display"], "state": "pending", "description": a["description"]}
            for a in AGENT_WORKFLOW
        ]
        await manager.send_message(client_id, {
            "type": "agent_status",
            "project_id": project_id,
            "agent_states": initial_states,
        })
        
        # Create ask_human callback for this project
        ask_human_cb = create_ask_human_callback(
            client_id=client_id,
            project_id=project_id,
            timeout=300.0
        )
        
        # Re-run generation with original requirement (with task callback)
        service = MetaGPTService(
            message_callback=message_callback,
            ask_human_callback=ask_human_cb,
            task_callback=task_callback,
        )
        workspace_path = await service.generate_project(
            requirement=project.get("requirement", ""),
            project_name=project.get("name", "")
        )
        
        await update_project_workspace(project_id, str(workspace_path))
        await update_project_status(project_id, "completed")
        
        # Send final progress
        final_states = [
            {"name": a["display"], "state": "completed", "description": a["description"]}
            for a in AGENT_WORKFLOW
        ]
        await manager.send_message(client_id, {
            "type": "progress",
            "project_id": project_id,
            "progress": {"current": len(AGENT_WORKFLOW), "total": len(AGENT_WORKFLOW), "percentage": 100},
            "agent_states": final_states,
        })
        
        await save_message(project_id, "System", "Project retry succeeded!", "complete", new_round)
        await manager.send_message(client_id, {
            "type": "complete",
            "content": "Project generated successfully!",
            "project_id": project_id,
            "workspace_path": str(workspace_path),
            "conversation_round": new_round
        })
    
    except Exception as e:
        error_msg = f"Error retrying project: {str(e)}\n{traceback.format_exc()}"
        await update_project_status(project_id, "failed")
        await save_message(project_id, "System", error_msg, "error", new_round)
        await manager.send_message(client_id, {
            "type": "error",
            "content": error_msg,
            "project_id": project_id,
            "can_retry": True,
        })


async def handle_user_response(client_id: str, message: dict):
    """Handle user response to an Agent's clarification question"""
    question_id = message.get("question_id")
    response = message.get("response", "")
    project_id = message.get("project_id")
    
    logger.info(f"[user_response] Received: question_id={question_id}, response={response[:50] if response else 'empty'}...")
    logger.info(f"[user_response] Pending questions: {list(pending_questions._pending.keys())}")
    
    if not question_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "question_id is required for user_response"
        })
        return
    
    # Validate the question exists and belongs to this client
    question_info = pending_questions.get_question(question_id)
    logger.info(f"[user_response] question_info: {question_info}")
    if not question_info:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Question not found or already answered",
            "question_id": question_id
        })
        return
    
    if question_info["client_id"] != client_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "This question does not belong to your session"
        })
        return
    
    if project_id and question_info["project_id"] != project_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Project ID mismatch"
        })
        return
    
    # Save user response to database
    await save_message(
        project_id=question_info["project_id"],
        agent="User",
        content=response,
        message_type="user_response"
    )
    
    # Resolve the pending question - this will unblock the waiting Agent
    pending_questions.resolve_question(question_id, response)
    
    # Acknowledge the response
    await manager.send_message(client_id, {
        "type": "response_received",
        "question_id": question_id,
        "project_id": question_info["project_id"]
    })


async def handle_skip_question(client_id: str, message: dict):
    """Handle user skipping a clarification question (use default)"""
    question_id = message.get("question_id")
    
    if not question_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "question_id is required"
        })
        return
    
    question_info = pending_questions.get_question(question_id)
    if not question_info:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Question not found or already answered"
        })
        return
    
    if question_info["client_id"] != client_id:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "This question does not belong to your session"
        })
        return
    
    # Use a default response indicating skip
    default_response = "[SKIPPED - Use default behavior]"
    
    # Save skip action to database
    await save_message(
        project_id=question_info["project_id"],
        agent="User",
        content="[Skipped question - using default]",
        message_type="user_response"
    )
    
    # Resolve with default
    pending_questions.resolve_question(question_id, default_response)
    
    await manager.send_message(client_id, {
        "type": "response_received",
        "question_id": question_id,
        "project_id": question_info["project_id"],
        "skipped": True
    })


def create_ask_human_callback(
    client_id: str,
    project_id: str,
    timeout: float = 300.0
) -> Callable:
    """
    Create a callback function for ask_human that sends questions via WebSocket
    and waits for user responses.
    
    This function is used by MetaGPTService to enable Agent-user interaction.
    """
    async def ask_human_callback(
        agent: str,
        question: str,
        question_type: str = "inline",
        options: Optional[list[str]] = None
    ) -> str:
        """
        Send a question to the user and wait for their response.
        
        Args:
            agent: Name of the agent asking the question
            question: The question content
            question_type: "inline" for chat display, "modal" for popup dialog
            options: Optional list of predefined answer options
            
        Returns:
            User's response string
            
        Raises:
            asyncio.TimeoutError: If user doesn't respond within timeout
        """
        # Create pending question
        question_id, event = pending_questions.create_question(
            project_id=project_id,
            client_id=client_id,
            content=question,
            question_type=question_type,
            options=options
        )
        logger.info(f"[ask_human] Created question: {question_id} for client: {client_id}")
        
        # Save clarification to database
        await save_message(
            project_id=project_id,
            agent=agent,
            content=question,
            message_type="clarification"
        )
        
        # Send question to client
        await manager.send_clarification(
            client_id=client_id,
            question_id=question_id,
            agent=agent,
            content=question,
            project_id=project_id,
            question_type=question_type,
            options=options
        )
        
        try:
            # Wait for user response with timeout
            logger.info(f"[ask_human] Waiting for response to question: {question_id}, timeout: {timeout}s")
            await asyncio.wait_for(event.wait(), timeout=timeout)
            response = pending_questions.get_response(question_id)
            logger.info(f"[ask_human] Got response for {question_id}: {response[:50] if response else 'empty'}...")
            return response or ""
        except asyncio.TimeoutError:
            # Cleanup on timeout
            logger.warning(f"[ask_human] Question {question_id} timed out after {timeout}s")
            pending_questions.cleanup_question(question_id)
            await manager.send_message(client_id, {
                "type": "question_timeout",
                "question_id": question_id,
                "project_id": project_id,
                "content": "Question timed out, using default behavior"
            })
            return "[TIMEOUT - Use default behavior]"
        finally:
            pending_questions.cleanup_question(question_id)
    
    return ask_human_callback
