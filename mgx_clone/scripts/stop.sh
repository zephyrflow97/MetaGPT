#!/bin/bash

# MGX Clone 停止脚本

echo "🛑 Stopping MGX Clone..."

# 停止后端
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Stopping backend server..."
    kill $(lsof -Pi :8000 -sTCP:LISTEN -t) 2>/dev/null || true
    echo "✓ Backend stopped"
else
    echo "Backend not running"
fi

# 停止前端
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Stopping frontend server..."
    kill $(lsof -Pi :3000 -sTCP:LISTEN -t) 2>/dev/null || true
    echo "✓ Frontend stopped"
else
    echo "Frontend not running"
fi

echo ""
echo "All services stopped."

