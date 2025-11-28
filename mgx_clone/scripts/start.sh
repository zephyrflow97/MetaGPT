#!/bin/bash

# MGX Clone 启动脚本

set -e

echo "🚀 Starting MGX Clone..."

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 启动后端
echo -e "${BLUE}Starting backend server...${NC}"
cd "$ROOT_DIR/backend"

# 检查是否有已运行的后端进程
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Backend already running on port 8000"
else
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
fi

# 等待后端启动
sleep 2

# 启动前端
echo -e "${BLUE}Starting frontend server...${NC}"
cd "$ROOT_DIR/frontend"

# 检查是否有已运行的前端进程
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Frontend already running on port 3000"
else
    pnpm dev &
    FRONTEND_PID=$!
    echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MGX Clone is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# 等待进程
wait

