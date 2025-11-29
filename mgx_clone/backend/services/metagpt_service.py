#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MetaGPT Service - Wraps MetaGPT functionality for web usage

Note: MetaGPT imports are done lazily to avoid config validation on startup.
"""
import asyncio
import logging
from pathlib import Path
from typing import Callable, Optional, TYPE_CHECKING

# Create logger for this module
logger = logging.getLogger(__name__)

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
                    
                    # Run callback in event loop - use proper async handling
                    try:
                        loop = asyncio.get_running_loop()
                        # Schedule the callback and ensure it runs
                        future = asyncio.ensure_future(
                            self._message_callback(agent_name, content, "agent_message")
                        )
                        # Add error handler to log any exceptions
                        future.add_done_callback(
                            lambda f: logger.warning(f"Callback error: {f.exception()}") if f.exception() else None
                        )
                    except RuntimeError:
                        # No running loop, create a new one
                        asyncio.run(
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
        
        # Get project path from context - use attribute access, not dict get
        project_path = None
        
        # Method 1: Try to get from ctx.kwargs (set by PrepareDocuments action)
        if hasattr(ctx.kwargs, 'project_path') and ctx.kwargs.project_path:
            project_path = Path(ctx.kwargs.project_path)
            logger.info(f"Got project_path from ctx.kwargs: {project_path}")
        
        # Method 2: Try to get from config
        if not project_path or not project_path.exists():
            try:
                if config.project_path:
                    project_path = Path(config.project_path)
                    logger.info(f"Got project_path from config: {project_path}")
            except Exception as e:
                logger.warning(f"Failed to get project_path from config: {e}")
        
        # Method 3: Scan workspace for most recently created project
        if not project_path or not project_path.exists():
            try:
                from metagpt.const import DEFAULT_WORKSPACE_ROOT
                workspace_root = DEFAULT_WORKSPACE_ROOT
                if workspace_root.exists():
                    # Find the most recently modified directory
                    project_dirs = [d for d in workspace_root.iterdir() if d.is_dir() and not d.name.startswith('.')]
                    if project_dirs:
                        # Sort by modification time, get the newest
                        project_path = max(project_dirs, key=lambda x: x.stat().st_mtime)
                        logger.info(f"Got project_path from workspace scan: {project_path}")
            except Exception as e:
                logger.warning(f"Failed to scan workspace: {e}")
        
        # Method 4: Fallback to MetaGPT project root workspace
        if not project_path or not project_path.exists():
            metagpt_root = Path(__file__).parent.parent.parent.parent
            workspace_root = metagpt_root / "workspace"
            if workspace_root.exists():
                project_dirs = [d for d in workspace_root.iterdir() if d.is_dir() and not d.name.startswith('.')]
                if project_dirs:
                    project_path = max(project_dirs, key=lambda x: x.stat().st_mtime)
                    logger.info(f"Got project_path from fallback workspace: {project_path}")
            else:
                project_path = workspace_root / (project_name or "project")
                logger.warning(f"Using fallback project_path: {project_path}")
        
        if self.message_callback:
            await self.message_callback(
                "System",
                f"Project generated at: {project_path}",
                "complete"
            )
        
        return project_path
    
    async def continue_project(
        self,
        project_id: str,
        existing_workspace: str,
        new_requirement: str,
        project_name: str = "",
    ) -> Path:
        """
        Continue working on an existing project with new requirements.
        
        Args:
            project_id: The existing project ID
            existing_workspace: Path to the existing project workspace
            new_requirement: The new requirement or modification request
            project_name: Project name
            
        Returns:
            Path to the project workspace
        """
        from metagpt.config2 import config
        from metagpt.context import Context
        from metagpt.roles import Architect, ProductManager
        from metagpt.roles.di.data_analyst import DataAnalyst
        from metagpt.roles.di.engineer2 import Engineer2
        from metagpt.roles.di.team_leader import TeamLeader
        from metagpt.team import Team
        
        if self.message_callback:
            await self.message_callback(
                "System",
                f"Continuing project: {project_name or 'Existing Project'}",
                "status"
            )
        
        # Read existing code context if workspace exists
        existing_code_context = ""
        workspace_path = Path(existing_workspace) if existing_workspace else None
        
        if workspace_path and workspace_path.exists():
            if self.message_callback:
                await self.message_callback(
                    "System",
                    f"Analyzing existing codebase at: {workspace_path}",
                    "status"
                )
            existing_code_context = await self._read_existing_code(workspace_path)
        
        # Build enhanced requirement with existing code context
        enhanced_requirement = new_requirement
        if existing_code_context:
            enhanced_requirement = f"""{new_requirement}

---
EXISTING CODEBASE CONTEXT:
{existing_code_context}
---

IMPORTANT: When making changes, consider the existing code structure above.
Modify existing files when appropriate rather than creating entirely new ones.
Maintain consistency with the existing coding style and architecture.
"""
        
        # Configure context - use incremental mode if workspace exists
        config.update_via_cli(
            project_path=str(workspace_path) if workspace_path else "",
            project_name=project_name,
            inc=bool(workspace_path and workspace_path.exists()),
            reqa_file="",
            max_auto_summarize_code=0
        )
        ctx = Context(config=config)
        
        # Create environment with callback
        env = create_web_mgx_env(context=ctx, message_callback=self.message_callback)
        
        # Create team
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
            await self.message_callback(
                "System",
                "Team ready to process your request...",
                "status"
            )
        
        company.invest(self.investment)
        
        # Run with enhanced requirement
        await company.run(n_round=self.n_round, idea=enhanced_requirement)
        
        # Get updated project path
        final_path = self._get_project_path(ctx, config, workspace_path)
        
        if self.message_callback:
            await self.message_callback(
                "System",
                f"Changes completed at: {final_path}",
                "complete"
            )
        
        return final_path
    
    async def _read_existing_code(self, workspace_path: Path) -> str:
        """Read and summarize existing code from workspace"""
        code_summary = []
        max_files = 10  # Limit number of files to include
        max_content_per_file = 500  # Max characters per file
        
        # File extensions to include
        code_extensions = {'.py', '.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.json', '.yaml', '.yml', '.md'}
        
        try:
            files_processed = 0
            for file_path in workspace_path.rglob("*"):
                if files_processed >= max_files:
                    break
                    
                if file_path.is_file() and file_path.suffix.lower() in code_extensions:
                    # Skip node_modules, __pycache__, etc.
                    if any(skip in str(file_path) for skip in ['node_modules', '__pycache__', '.git', 'dist', 'build']):
                        continue
                    
                    try:
                        relative_path = file_path.relative_to(workspace_path)
                        content = file_path.read_text(encoding='utf-8', errors='ignore')
                        
                        # Truncate content if too long
                        if len(content) > max_content_per_file:
                            content = content[:max_content_per_file] + "\n... (truncated)"
                        
                        code_summary.append(f"File: {relative_path}\n```\n{content}\n```\n")
                        files_processed += 1
                    except Exception:
                        continue
        except Exception as e:
            logger.warning(f"Error reading existing code: {e}")
        
        return "\n".join(code_summary) if code_summary else ""
    
    def _get_project_path(self, ctx, config, fallback_path: Path = None) -> Path:
        """Get project path from various sources"""
        project_path = None
        
        # Method 1: Try ctx.kwargs
        if hasattr(ctx.kwargs, 'project_path') and ctx.kwargs.project_path:
            project_path = Path(ctx.kwargs.project_path)
            if project_path.exists():
                return project_path
        
        # Method 2: Try config
        try:
            if config.project_path:
                project_path = Path(config.project_path)
                if project_path.exists():
                    return project_path
        except Exception:
            pass
        
        # Method 3: Scan workspace
        try:
            from metagpt.const import DEFAULT_WORKSPACE_ROOT
            workspace_root = DEFAULT_WORKSPACE_ROOT
            if workspace_root.exists():
                project_dirs = [d for d in workspace_root.iterdir() if d.is_dir() and not d.name.startswith('.')]
                if project_dirs:
                    return max(project_dirs, key=lambda x: x.stat().st_mtime)
        except Exception:
            pass
        
        # Method 4: Fallback
        if fallback_path and fallback_path.exists():
            return fallback_path
        
        # Final fallback
        metagpt_root = Path(__file__).parent.parent.parent.parent
        return metagpt_root / "workspace"


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

