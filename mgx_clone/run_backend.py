#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MGX Clone Backend Runner
Run this script from the MetaGPT project root directory.
"""
import sys
from pathlib import Path

# Ensure we're in the right directory
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

if __name__ == "__main__":
    import uvicorn
    
    print("Starting MGX Clone Backend...")
    print(f"Project root: {project_root}")
    print("Server will be available at: http://localhost:8000")
    print("API Docs: http://localhost:8000/docs")
    print("-" * 50)
    
    uvicorn.run(
        "mgx_clone.backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(project_root / "mgx_clone")],
    )

