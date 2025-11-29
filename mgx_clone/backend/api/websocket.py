#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
WebSocket Handler for MGX Clone
Handles real-time communication for project generation
"""
import asyncio
import json
import traceback
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from mgx_clone.backend.services.metagpt_service import MetaGPTService
from mgx_clone.backend.services.templates import generate_prompt_from_template, get_template
from mgx_clone.backend.storage.database import (
    create_project,
    get_latest_conversation_round,
    get_project,
    get_project_messages,
    save_message,
    save_user_message,
    update_project_status,
    update_project_workspace,
)

router = APIRouter()

# Agent 列表用于进度追踪
AGENT_WORKFLOW = [
    {"name": "TeamLeader", "display": "Team Leader", "description": "Analyzing requirements"},
    {"name": "ProductManager", "display": "Product Manager", "description": "Creating product specification"},
    {"name": "Architect", "display": "Architect", "description": "Designing system architecture"},
    {"name": "Engineer2", "display": "Engineer", "description": "Implementing code"},
    {"name": "DataAnalyst", "display": "Data Analyst", "description": "Analyzing data requirements"},
]


class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
    
    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception:
                self.disconnect(client_id)
    
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
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for chat-based project generation
    
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
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            
            if msg_type == "create_project":
                await handle_create_project(client_id, message)
            elif msg_type == "create_from_template":
                await handle_create_from_template(client_id, message)
            elif msg_type == "continue_conversation":
                await handle_continue_conversation(client_id, message)
            elif msg_type == "regenerate_project":
                await handle_regenerate_project(client_id, message)
            elif msg_type == "retry_project":
                await handle_retry_project(client_id, message)
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
    """Handle project creation request"""
    name = message.get("name", "Untitled Project")
    requirement = message.get("requirement", "")
    
    if not requirement:
        await manager.send_message(client_id, {
            "type": "error",
            "content": "Requirement is required"
        })
        return
    
    # Create project record
    project = await create_project(name, requirement)
    project_id = project["id"]
    
    # Save and send initial status message
    await save_message(project_id, "System", "Project created, starting generation...", "status")
    await manager.send_message(client_id, {
        "type": "status",
        "content": "Project created, starting generation...",
        "project_id": project_id,
        "status": "created"
    })
    
    # Track current agent for progress
    agent_progress = {"current_idx": 0, "agents_seen": set()}
    
    # Callback function to send messages to client AND save to database
    async def message_callback(agent: str, content: str, msg_type: str = "agent_message"):
        # Save message to database
        await save_message(
            project_id=project_id,
            agent=agent,
            content=content,
            message_type=msg_type
        )
        
        # Update progress tracking
        if msg_type == "agent_message" and agent not in agent_progress["agents_seen"]:
            agent_progress["agents_seen"].add(agent)
            # Find agent index
            for idx, a in enumerate(AGENT_WORKFLOW):
                if a["name"] == agent or a["display"] == agent:
                    agent_progress["current_idx"] = idx + 1
                    break
            
            # Send progress update
            total = len(AGENT_WORKFLOW)
            current = agent_progress["current_idx"]
            percentage = int((current / total) * 100)
            
            # Build agent states
            agent_states = []
            for idx, a in enumerate(AGENT_WORKFLOW):
                if a["name"] in agent_progress["agents_seen"] or a["display"] in agent_progress["agents_seen"]:
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
        
        # Initialize MetaGPT service and run
        service = MetaGPTService(message_callback=message_callback)
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
        
        # Initialize MetaGPT service and run with context
        service = MetaGPTService(message_callback=message_callback)
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
        
        # Re-run generation with original requirement
        service = MetaGPTService(message_callback=message_callback)
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
    """Handle project creation from a template"""
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
    
    # Track progress
    agent_progress = {"current_idx": 0, "agents_seen": set()}
    
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
            for idx, a in enumerate(AGENT_WORKFLOW):
                if a["name"] == agent or a["display"] == agent:
                    agent_progress["current_idx"] = idx + 1
                    break
            
            total = len(AGENT_WORKFLOW)
            current = agent_progress["current_idx"]
            percentage = int((current / total) * 100)
            
            agent_states = []
            for idx, a in enumerate(AGENT_WORKFLOW):
                if a["name"] in agent_progress["agents_seen"] or a["display"] in agent_progress["agents_seen"]:
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
        
        # Re-run generation with original requirement
        service = MetaGPTService(message_callback=message_callback)
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
