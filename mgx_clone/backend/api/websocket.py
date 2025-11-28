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
    save_message,
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
