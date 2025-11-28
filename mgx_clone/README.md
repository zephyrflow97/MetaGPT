# MGX Clone

基于 MetaGPT 的自然语言编程平台，复刻 MGX.dev 的核心功能。

## 功能特性

- 🤖 **多 Agent 协作**: 使用 MetaGPT 的 Team Leader、Product Manager、Architect、Engineer 等角色协同工作
- 💬 **聊天式交互**: 通过自然语言描述你的需求，AI 团队会自动为你生成代码
- 📡 **流式输出**: 实时查看 Agent 的工作进度和消息
- 📁 **代码预览**: 内置 Monaco Editor（VS Code 同款编辑器）查看生成的代码
- 📦 **项目下载**: 一键打包下载生成的项目
- 📜 **历史记录**: 保存所有项目记录，随时查看

## 技术栈

### 后端
- FastAPI - 高性能异步 Web 框架
- WebSocket - 实时双向通信
- SQLite - 轻量级数据库
- MetaGPT - 多 Agent 框架

### 前端
- Next.js 14 - React 框架
- TypeScript - 类型安全
- Tailwind CSS - 样式框架
- Monaco Editor - 代码编辑器

## 快速开始

### 前置条件

- Python 3.9+
- Node.js 18+
- pnpm (推荐) 或 npm
- 已配置好的 MetaGPT（需要有效的 LLM API Key）

### 1. 安装后端依赖

```bash
cd mgx_clone/backend
pip install -r requirements.txt
```

### 2. 安装前端依赖

```bash
cd mgx_clone/frontend
pnpm install
# 或使用 npm
npm install
```

### 3. 配置 MetaGPT

确保 MetaGPT 已正确配置，可以在 `~/.metagpt/config2.yaml` 中设置：

```yaml
llm:
  api_type: "openai"
  model: "gpt-4-turbo"
  base_url: "https://api.openai.com/v1"
  api_key: "YOUR_API_KEY"
```

### 4. 启动服务

**启动后端** (在项目根目录 `MetaGPT` 下运行):

```bash
cd /path/to/MetaGPT
python mgx_clone/run_backend.py
```

或者使用 uvicorn 直接运行：

```bash
cd /path/to/MetaGPT
python -m uvicorn mgx_clone.backend.main:app --reload --host 0.0.0.0 --port 8000
```

**启动前端** (在 `mgx_clone/frontend` 目录):

```bash
cd mgx_clone/frontend
pnpm dev
# 或使用 npm
npm run dev
```

### 5. 访问应用

打开浏览器访问 http://localhost:3000

## 项目结构

```
mgx_clone/
├── backend/
│   ├── api/
│   │   ├── routes.py        # REST API 路由
│   │   └── websocket.py     # WebSocket 处理
│   ├── services/
│   │   └── metagpt_service.py  # MetaGPT 封装
│   ├── storage/
│   │   └── database.py      # SQLite 数据库
│   ├── main.py              # FastAPI 入口
│   └── requirements.txt     # Python 依赖
│
├── frontend/
│   ├── app/
│   │   ├── globals.css      # 全局样式
│   │   ├── layout.tsx       # 根布局
│   │   └── page.tsx         # 主页面
│   ├── components/
│   │   ├── Sidebar.tsx      # 侧边栏
│   │   ├── ChatArea.tsx     # 聊天区域
│   │   └── CodePreview.tsx  # 代码预览
│   ├── lib/
│   │   ├── types.ts         # TypeScript 类型
│   │   └── utils.ts         # 工具函数
│   └── package.json         # Node.js 依赖
│
└── README.md
```

## API 端点

### REST API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/projects` | 创建新项目 |
| GET | `/api/projects` | 获取项目列表 |
| GET | `/api/projects/{id}` | 获取项目详情 |
| GET | `/api/projects/{id}/files` | 获取项目文件列表 |
| GET | `/api/projects/{id}/files/{path}` | 获取文件内容 |
| GET | `/api/projects/{id}/download` | 下载项目 |
| DELETE | `/api/projects/{id}` | 删除项目 |

### WebSocket

| 端点 | 说明 |
|------|------|
| `/ws/chat/{client_id}` | 聊天和项目生成 |

## 使用示例

1. 打开应用后，在输入框中输入你的需求，例如：
   - "创建一个 2048 游戏"
   - "开发一个 Todo List 应用"
   - "设计一个个人博客系统"

2. 点击发送，观察 AI 团队的工作过程

3. 项目生成完成后，可以：
   - 在右侧面板浏览代码文件
   - 使用 Monaco Editor 查看代码详情
   - 点击下载按钮获取完整项目

## 注意事项

- 项目生成需要消耗 LLM API 调用，请确保有足够的额度
- 复杂项目可能需要较长时间生成
- 生成的代码存储在 `workspace` 目录下

## License

MIT License

