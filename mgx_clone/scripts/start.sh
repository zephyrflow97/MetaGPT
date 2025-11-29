#!/bin/bash

# MGX Clone 启动脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$ROOT_DIR")"

# 默认配置
HOST="127.0.0.1"
BACKEND_PORT=8000
FRONTEND_PORT=3000
PUBLIC_MODE=false

# 解析命令行参数
show_help() {
    echo "MGX Clone 启动脚本"
    echo ""
    echo "用法: ./start.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --public           启用公网访问模式 (监听 0.0.0.0)"
    echo "  --host <IP>        指定监听地址 (默认: 127.0.0.1)"
    echo "  --backend-port <N> 后端端口 (默认: 8000)"
    echo "  --frontend-port <N> 前端端口 (默认: 3000)"
    echo "  -h, --help         显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./start.sh                    # 本地模式 (仅 localhost 可访问)"
    echo "  ./start.sh --public           # 公网模式 (所有 IP 可访问)"
    echo "  ./start.sh --host 192.168.1.100  # 指定 IP"
    echo ""
    echo "⚠️  公网模式安全提示:"
    echo "  1. 确保防火墙已开放 $BACKEND_PORT 和 $FRONTEND_PORT 端口"
    echo "  2. 如在云服务器，需配置安全组规则"
    echo "  3. 建议配置 HTTPS 和认证机制"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --public)
            PUBLIC_MODE=true
            HOST="0.0.0.0"
            shift
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

echo "🚀 Starting MGX Clone..."
echo ""

if [ "$PUBLIC_MODE" = true ]; then
    echo -e "${YELLOW}⚠️  公网访问模式已启用${NC}"
    echo -e "${YELLOW}   服务将监听所有网络接口 (0.0.0.0)${NC}"
    echo ""
fi

# 激活虚拟环境
echo -e "${BLUE}Activating virtual environment...${NC}"
source "$PROJECT_ROOT/.venv/bin/activate"

# 设置环境变量供前端使用
export BACKEND_HOST="$HOST"
export BACKEND_PORT="$BACKEND_PORT"

# 启动后端
echo -e "${BLUE}Starting backend server...${NC}"
cd "$ROOT_DIR/backend"

# 检查是否有已运行的后端进程
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Backend already running on port $BACKEND_PORT"
else
    python -m uvicorn main:app --host "$HOST" --port "$BACKEND_PORT" &
    BACKEND_PID=$!
    echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
fi

# 等待后端启动
sleep 2

# 启动前端
echo -e "${BLUE}Starting frontend server...${NC}"
cd "$ROOT_DIR/frontend"

# 检查是否有已运行的前端进程
if lsof -Pi :$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Frontend already running on port $FRONTEND_PORT"
else
    # 使用 --hostname 参数让 Next.js 监听指定地址
    pnpm dev --hostname "$HOST" --port "$FRONTEND_PORT" &
    FRONTEND_PID=$!
    echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MGX Clone is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ "$PUBLIC_MODE" = true ]; then
    # 获取本机 IP
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "YOUR_SERVER_IP")
    echo "本地访问:"
    echo "  Frontend: http://localhost:$FRONTEND_PORT"
    echo "  Backend:  http://localhost:$BACKEND_PORT"
    echo ""
    echo "公网/局域网访问:"
    echo "  Frontend: http://$LOCAL_IP:$FRONTEND_PORT"
    echo "  Backend:  http://$LOCAL_IP:$BACKEND_PORT"
else
    echo "Frontend: http://localhost:$FRONTEND_PORT"
    echo "Backend:  http://localhost:$BACKEND_PORT"
fi

echo "API Docs: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# 等待进程
wait
