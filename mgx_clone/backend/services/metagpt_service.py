#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MetaGPT Service - Wraps MetaGPT functionality for web usage

Note: MetaGPT imports are done lazily to avoid config validation on startup.
"""
import asyncio
from pathlib import Path
from typing import Callable, Optional, TYPE_CHECKING

# Lazy imports to avoid config validation on module load
if TYPE_CHECKING:
    from metagpt.config2 import Config
    from metagpt.context import Context
    from metagpt.environment.mgx.mgx_env import MGXEnv
    from metagpt.schema import Message
    from metagpt.team import Team


def create_web_mgx_env(context, message_callback: Optional[Callable] = None):
    """
    Factory function to create a WebMGXEnv with message callback support.
    Uses lazy import to avoid config validation on module load.
    """
    from metagpt.environment.mgx.mgx_env import MGXEnv
    from metagpt.logs import logger
    
    class WebMGXEnv(MGXEnv):
        """
        Extended MGXEnv with message callback support for web applications.
        Sends real-time updates to the frontend via callback function.
        """
        
        _message_callback: Optional[Callable] = None
        
        def __init__(self, msg_callback: Optional[Callable] = None, **kwargs):
            super().__init__(**kwargs)
            self._message_callback = msg_callback
        
        def _publish_message(self, message, peekable: bool = True) -> bool:
            """Override to add callback notification"""
            result = super()._publish_message(message, peekable)
            
            # Send message to callback if available
            if self._message_callback and message.content:
                try:
                    # Extract agent name from message
                    agent_name = message.sent_from or "System"
                    content = message.content
                    
                    # Run callback in event loop
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.create_task(
                            self._message_callback(agent_name, content, "agent_message")
                        )
                    else:
                        loop.run_until_complete(
                            self._message_callback(agent_name, content, "agent_message")
                        )
                except Exception as e:
                    logger.warning(f"Failed to send message callback: {e}")
            
            return result
        
        async def run(self, k=1):
            """Override run to add status updates"""
            if self._message_callback:
                await self._message_callback("System", "Environment running...", "status")
            
            await super().run(k)
            
            if self._message_callback:
                await self._message_callback("System", "Environment cycle completed", "status")
    
    return WebMGXEnv(context=context, msg_callback=message_callback)


class MetaGPTService:
    """
    Service class to manage MetaGPT project generation.
    Provides a clean interface for the web API to interact with MetaGPT.
    """
    
    def __init__(
        self,
        message_callback: Optional[Callable] = None,
        investment: float = 3.0,
        n_round: int = 5,
    ):
        self.message_callback = message_callback
        self.investment = investment
        self.n_round = n_round
    
    async def generate_project(
        self,
        requirement: str,
        project_name: str = "",
    ) -> Path:
        """
        Generate a project based on natural language requirement.
        
        Args:
            requirement: Natural language description of the project
            project_name: Optional project name
            
        Returns:
            Path to the generated project workspace
        """
        # Lazy imports to avoid config validation on module load
        from metagpt.config2 import config
        from metagpt.context import Context
        from metagpt.roles import Architect, ProductManager
        from metagpt.roles.di.data_analyst import DataAnalyst
        from metagpt.roles.di.engineer2 import Engineer2
        from metagpt.roles.di.team_leader import TeamLeader
        from metagpt.team import Team
        
        # Notify start
        if self.message_callback:
            await self.message_callback(
                "System", 
                f"Starting project generation: {project_name or 'New Project'}", 
                "status"
            )
        
        # Configure context
        config.update_via_cli(
            project_path="",
            project_name=project_name,
            inc=False,
            reqa_file="",
            max_auto_summarize_code=0
        )
        ctx = Context(config=config)
        
        # Create environment with callback
        env = create_web_mgx_env(context=ctx, message_callback=self.message_callback)
        
        # Create team with the web environment
        company = Team(context=ctx, use_mgx=False)
        company.env = env
        env.context = ctx
        
        # Hire roles
        roles = [
            TeamLeader(),
            ProductManager(),
            Architect(),
            Engineer2(),
            DataAnalyst(),
        ]
        company.hire(roles)
        
        if self.message_callback:
            role_names = [r.profile for r in roles]
            await self.message_callback(
                "System",
                f"Team assembled: {', '.join(role_names)}",
                "status"
            )
        
        # Set investment
        company.invest(self.investment)
        
        # Run project
        if self.message_callback:
            await self.message_callback(
                "System",
                f"Processing requirement: {requirement[:100]}...",
                "status"
            )
        
        await company.run(n_round=self.n_round, idea=requirement)
        
        # Get project path from context
        project_path = ctx.kwargs.get("project_path")
        if project_path:
            project_path = Path(project_path)
        else:
            # Try to get from config
            try:
                config_project_path = config.project_path
                if config_project_path:
                    project_path = Path(config_project_path)
                else:
                    # Use MetaGPT's default workspace
                    from metagpt.const import DEFAULT_WORKSPACE_ROOT
                    project_path = DEFAULT_WORKSPACE_ROOT / (project_name or "project")
            except Exception:
                # Fallback to MetaGPT project root workspace
                metagpt_root = Path(__file__).parent.parent.parent.parent
                project_path = metagpt_root / "workspace" / (project_name or "project")
        
        if self.message_callback:
            await self.message_callback(
                "System",
                f"Project generated at: {project_path}",
                "complete"
            )
        
        return project_path


class SimpleMetaGPTService:
    """
    Simplified service for quick project generation without full MGX features.
    Uses the basic software company flow.
    """
    
    def __init__(
        self,
        message_callback: Optional[Callable] = None,
        investment: float = 3.0,
        n_round: int = 5,
    ):
        self.message_callback = message_callback
        self.investment = investment
        self.n_round = n_round
    
    async def generate_project(
        self,
        requirement: str,
        project_name: str = "",
    ) -> Path:
        """
        Generate a project using simplified flow.
        """
        from metagpt.software_company import generate_repo
        
        if self.message_callback:
            await self.message_callback(
                "System",
                f"Starting simplified generation for: {requirement[:50]}...",
                "status"
            )
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        project_path = await loop.run_in_executor(
            None,
            lambda: generate_repo(
                idea=requirement,
                investment=self.investment,
                n_round=self.n_round,
                project_name=project_name,
            )
        )
        
        if self.message_callback:
            await self.message_callback(
                "System",
                f"Project completed at: {project_path}",
                "complete"
            )
        
        return Path(project_path) if project_path else Path.cwd() / "workspace"

