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
        "type": "agent_message" | "status" | "error" | "complete",
        "agent": "ProductManager",  # for agent_message
        "content": "...",
        "project_id": "...",  # for status updates
        "timestamp": "..."
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
            elif msg_type == "continue_conversation":
                await handle_continue_conversation(client_id, message)
            elif msg_type == "regenerate_project":
                await handle_regenerate_project(client_id, message)
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
    
    # Callback function to send messages to client AND save to database
    async def message_callback(agent: str, content: str, msg_type: str = "agent_message"):
        # Save message to database
        await save_message(
            project_id=project_id,
            agent=agent,
            content=content,
            message_type=msg_type
        )
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
        
        # Initialize MetaGPT service and run
        service = MetaGPTService(message_callback=message_callback)
        workspace_path = await service.generate_project(requirement, name)
        
        # Update project with workspace path and completed status
        await update_project_workspace(project_id, str(workspace_path))
        await update_project_status(project_id, "completed")
        
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
        # Save and send error message
        await save_message(project_id, "System", error_msg, "error")
        await manager.send_message(client_id, {
            "type": "error",
            "content": error_msg,
            "project_id": project_id
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
            "project_id": project_id
        })
