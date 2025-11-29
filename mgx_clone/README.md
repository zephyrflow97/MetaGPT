# MGX Clone

基于 MetaGPT 的自然语言编程平台，复刻 MGX.dev 的核心功能。

> 📋 **开发规则**: 稳定的开发规范和约束请参考 `.cursor/rules/projectrule.mdc`

---

## 项目概述

MGX Clone 是一个 Web 应用，允许用户通过自然语言描述需求，由 AI Agent 团队自动生成完整的代码项目。它使用 MetaGPT 作为多 Agent 协作引擎，提供流式输出、代码预览和项目管理功能。

---

## 功能特性

### 已实现 ✅

- 🤖 **多 Agent 协作**: 使用 MetaGPT 的 Team Leader、Product Manager、Architect、Engineer 等角色协同工作
- 💬 **聊天式交互**: 通过自然语言描述你的需求，AI 团队会自动为你生成代码
- 📡 **WebSocket 流式输出**: 实时查看 Agent 的工作进度和消息
- 📁 **代码预览**: 浏览生成的代码文件
- 🎨 **项目预览**: 在 iframe 中预览生成的 Web 项目
- 📦 **项目下载**: 一键打包下载生成的项目（ZIP 格式）
- 📜 **历史记录**: 保存所有项目记录和对话历史
- 💾 **消息持久化**: 项目生成过程中的所有消息保存到数据库
- 🔄 **实时项目列表**: 创建项目后立即在侧边栏显示
- ✏️ **Monaco Editor**: VS Code 同款代码编辑器，支持语法高亮
- 📝 **代码在线编辑**: 直接在浏览器中编辑生成的代码并保存
- 🔁 **多轮对话**: 支持追加需求修改已生成的项目（包含完整历史上下文）
- 🔄 **项目重新生成**: 一键重新生成项目
- 📋 **项目模板**: 预设常用项目模板（React App、Vue App、API 服务、游戏等），快速开始
- 📊 **生成进度条**: 实时显示项目生成的整体进度和百分比
- 👥 **Agent 状态可视化**: 显示各 Agent（Team Leader、Product Manager 等）的当前工作状态
- 🔄 **错误重试**: 生成失败时支持一键重试

---

## 技术栈

### 后端
| 技术 | 用途 |
|------|------|
| FastAPI | 高性能异步 Web 框架 |
| WebSocket | 实时双向通信 |
| SQLite + aiosqlite | 异步轻量级数据库 |
| MetaGPT | 多 Agent 协作框架 |
| Pydantic | 数据验证和序列化 |

### 前端
| 技术 | 用途 |
|------|------|
| Next.js 14 | React 框架（App Router） |
| TypeScript | 类型安全 |
| Tailwind CSS | 原子化 CSS 样式 |
| Lucide React | 图标库 |

---

## 快速开始

### 前置条件

- Python 3.9+
- Node.js 18+
- pnpm (推荐) 或 npm
- uv (Python 包管理工具)
- 已配置好的 MetaGPT（需要有效的 LLM API Key）

### ⚠️ 重要：虚拟环境说明

本项目从 MetaGPT 二次开发而来，使用 `uv` 管理虚拟环境。

**虚拟环境位于项目根目录**，不是 `mgx_clone/` 目录：

```
/Users/suifeng/Project/MetaGPT/
├── .venv/                      # ← 虚拟环境在这里！
├── mgx_clone/                  # MGX Clone 源代码
├── metagpt/                    # MetaGPT 源代码
├── config/                     # 配置文件
└── workspace/                  # 生成的项目存储
```

### 1. 配置 MetaGPT

确保 `config/config2.yaml` 已正确配置：

```yaml
llm:
  api_type: "openai"
  model: "gpt-4-turbo"
  base_url: "https://api.openai.com/v1"
  api_key: "YOUR_API_KEY"
```

### 2. 激活虚拟环境并安装后端依赖

```bash
# 进入项目根目录
cd /Users/suifeng/Project/MetaGPT

# 激活虚拟环境
source .venv/bin/activate

# 安装后端依赖
uv pip install -r mgx_clone/backend/requirements.txt
```

### 3. 安装前端依赖

```bash
cd mgx_clone/frontend
pnpm install
```

### 4. 启动服务

**方式一：使用启动脚本**

```bash
cd mgx_clone/scripts
./start.sh
```

**方式二：分别启动**

启动后端：
```bash
# 确保在项目根目录并激活虚拟环境
cd /Users/suifeng/Project/MetaGPT
source .venv/bin/activate
cd mgx_clone/backend
python -m uvicorn main:app --reload --port 8000
```

启动前端：
```bash
cd /Users/suifeng/Project/MetaGPT/mgx_clone/frontend
pnpm dev
```

### 5. 访问应用

打开浏览器访问 http://localhost:3000

---

## 项目结构

```
mgx_clone/
├── backend/                    # 后端服务
│   ├── api/
│   │   ├── routes.py           # REST API 路由
│   │   └── websocket.py        # WebSocket 处理
│   ├── services/
│   │   ├── metagpt_service.py  # MetaGPT 服务封装
│   │   └── templates.py        # 项目模板定义 (v0.2.1 新增)
│   ├── storage/
│   │   └── database.py         # SQLite 数据库操作
│   ├── main.py                 # FastAPI 入口
│   └── requirements.txt        # Python 依赖
│
├── frontend/                   # 前端应用
│   ├── app/
│   │   ├── globals.css         # 全局样式（自定义主题）
│   │   ├── layout.tsx          # 根布局
│   │   └── page.tsx            # 主页面组件
│   ├── components/
│   │   ├── Sidebar.tsx         # 侧边栏（项目列表）
│   │   ├── ChatArea.tsx        # 聊天区域
│   │   ├── CodePreview.tsx     # 代码/预览面板
│   │   ├── TemplateSelector.tsx # 模板选择器 (v0.2.1 新增)
│   │   ├── ProgressBar.tsx     # 进度条组件 (v0.2.1 新增)
│   │   ├── AgentStatusPanel.tsx # Agent 状态面板 (v0.2.1 新增)
│   │   └── index.ts            # 组件导出
│   ├── lib/
│   │   ├── types.ts            # TypeScript 类型定义
│   │   └── utils.ts            # 工具函数
│   └── package.json
│
├── data/
│   └── mgx_clone.db            # SQLite 数据库文件
│
├── scripts/
│   ├── start.sh                # 启动脚本
│   └── stop.sh                 # 停止脚本
│
└── README.md
```

---

## 架构设计

```
┌─────────────┐     WebSocket      ┌─────────────┐     MetaGPT     ┌─────────────┐
│   前端      │ ◄────────────────► │   后端      │ ◄─────────────► │   LLM API   │
│  (Next.js)  │                    │  (FastAPI)  │                 │  (OpenAI)   │
└─────────────┘                    └─────────────┘                 └─────────────┘
      │                                   │
      │        REST API                   │
      │ ◄───────────────────────────────► │
      │                                   │
      │                            ┌──────┴──────┐
      │                            │   SQLite    │
      │                            │  Database   │
      └────────────────────────────┴─────────────┘
```

---

## 数据库规范

### 表结构

**projects 表**
| 字段           | 类型 | 说明                                              |
|----------------|------|---------------------------------------------------|
| id             | TEXT | 主键 (UUID)                                       |
| name           | TEXT | 项目名称                                          |
| requirement    | TEXT | 用户需求                                          |
| status         | TEXT | 状态 (pending/running/completed/failed/deleted)   |
| workspace_path | TEXT | 工作目录路径                                      |
| created_at     | TEXT | 创建时间 (ISO 8601)                               |
| updated_at     | TEXT | 更新时间 (ISO 8601)                               |

**messages 表**
| 字段               | 类型    | 说明                                               |
|--------------------|---------|---------------------------------------------------|
| id                 | TEXT    | 主键 (UUID)                                       |
| project_id         | TEXT    | 项目 ID (外键)                                    |
| agent              | TEXT    | Agent 名称                                        |
| content            | TEXT    | 消息内容                                          |
| message_type       | TEXT    | 类型 (user/agent_message/status/complete/error)   |
| conversation_round | INTEGER | 对话轮次 (v0.2.0 新增，默认 1)                     |
| created_at         | TEXT    | 创建时间 (ISO 8601)                               |

### 项目状态枚举
| 状态 | 说明 |
|------|------|
| `pending` | 等待处理 |
| `running` | 正在生成 |
| `completed` | 完成 |
| `failed` | 失败 |
| `deleted` | 软删除 |

---

## 版本历史

### v0.2.1 (当前版本)

#### 新增功能
- ✅ **项目模板系统**: 预设 8 种常用项目模板（React App、Vue App、REST API、游戏、Dashboard、Landing Page、Portfolio、E-Commerce）
- ✅ **模板选择器**: 精美的模板选择弹窗，支持分类筛选和功能自定义
- ✅ **生成进度条**: 实时显示项目生成进度百分比和当前 Agent
- ✅ **Agent 状态可视化**: 右侧面板显示所有 Agent 的工作状态（待命/工作中/已完成）
- ✅ **错误重试功能**: 生成失败时在错误消息下方显示重试按钮

#### 性能优化
- ✅ **文件列表 API 优化**: 排除 `node_modules`、`__pycache__` 等大型目录，限制返回文件数量（默认 500）
- ✅ **移除 stat 调用**: 不再获取文件大小信息，大幅提升文件列表加载速度
- ✅ **非阻塞加载**: 项目切换时优先加载消息历史，文件列表在后台加载
- ✅ **useMemo 缓存**: 文件树结构使用 useMemo 缓存，避免重复构建
- ✅ **文件截断提示**: 当文件数量超过限制时显示提示

#### API 更新
- ✅ 新增 REST API: `GET /api/templates` (获取所有模板)
- ✅ 新增 REST API: `GET /api/templates/categories` (获取模板分类)
- ✅ 新增 REST API: `GET /api/templates/{id}` (获取模板详情)
- ✅ 新增 REST API: `POST /api/templates/generate-prompt` (从模板生成 prompt)
- ✅ 新增 WebSocket 消息类型: `create_from_template` (从模板创建项目)
- ✅ 新增 WebSocket 消息类型: `retry_project` (重试失败项目)
- ✅ 新增 WebSocket 消息类型: `progress` (进度更新)
- ✅ 新增 WebSocket 消息类型: `agent_status` (Agent 状态更新)
- ✅ 更新 REST API: `GET /api/projects/{id}/files` 新增 `limit` 参数，返回 `total` 和 `truncated` 字段

#### 前端更新
- ✅ 新增 TemplateSelector 组件
- ✅ 新增 ProgressBar 组件
- ✅ 新增 AgentStatusPanel 组件
- ✅ Sidebar 新增模板按钮
- ✅ ChatArea 错误消息支持重试按钮
- ✅ CodePreview 组件支持加载状态和文件截断提示

---

### v0.2.0

#### 新增功能
- ✅ **Monaco Editor 集成**: VS Code 同款代码编辑器，支持语法高亮
- ✅ **代码在线编辑**: 直接编辑生成的代码并保存到文件
- ✅ **多轮对话支持**: 在已完成项目上继续对话，追加需求修改
- ✅ **完整对话历史**: 多轮对话时包含所有历史修改请求作为上下文
- ✅ **项目重新生成**: 一键使用原始需求重新生成项目
- ✅ **对话轮次追踪**: 数据库记录每条消息的对话轮次
- ✅ **对话模式指示器**: 前端显示当前是新建项目还是继续对话模式

#### API 更新
- ✅ 新增 WebSocket 消息类型: `continue_conversation`
- ✅ 新增 WebSocket 消息类型: `regenerate_project`
- ✅ 新增 REST API: `PUT /api/projects/{id}/files/{path}` (保存文件)

#### 数据库更新
- ✅ messages 表新增 `conversation_round` 字段

---

### v0.1.0

#### 核心功能
- ✅ 项目创建和生成
- ✅ WebSocket 实时通信
- ✅ Agent 消息流式展示
- ✅ 项目文件浏览
- ✅ 代码内容查看
- ✅ 项目预览 (iframe)
- ✅ 项目下载 (ZIP)
- ✅ 历史记录管理

#### 数据持久化
- ✅ 项目信息存储
- ✅ 消息历史保存
- ✅ 工作空间路径管理

#### 用户体验
- ✅ 实时项目列表更新
- ✅ 项目独立的消息历史
- ✅ React Strict Mode 兼容
- ✅ 唯一消息 ID 生成

#### Bug 修复
- ✅ 修复 WebSocket 双重连接问题
- ✅ 修复消息 key 重复警告
- ✅ 修复项目路径获取逻辑
- ✅ 修复消息历史共享问题
- ✅ 修复 logger 未定义错误

---

## 开发计划

### v0.2.1 - 中优先级功能 ✅ 已完成

- [x] **项目模板**: 预设常用项目模板（React App、Vue App、API 服务等）
- [x] **生成进度条**: 显示项目生成的整体进度
- [x] **Agent 状态可视化**: 显示各 Agent 的当前状态
- [x] **错误重试**: 生成失败时支持重试

### v0.2.0 - 用户体验优化 ✅ 已完成

- [x] **Monaco Editor 集成**: 使用 VS Code 同款编辑器查看代码，支持语法高亮
- [x] **代码编辑功能**: 允许用户在线编辑生成的代码
- [x] **项目重新生成**: 支持基于反馈重新生成项目部分内容
- [x] **多轮对话**: 支持追加需求修改已生成的项目（包含完整历史上下文）

### v0.3.0 - 功能扩展

#### 高优先级
- [ ] **用户认证**: 添加登录/注册功能
- [ ] **项目分享**: 生成分享链接
- [ ] **一键部署**: 支持部署到 Vercel/Netlify 等平台

#### 中优先级
- [ ] **项目搜索**: 按名称/需求搜索项目
- [ ] **项目标签**: 为项目添加标签分类
- [ ] **导出配置**: 导出项目的 MetaGPT 配置
- [ ] **批量操作**: 批量删除/下载项目

### v0.4.0 - 高级功能

- [ ] **多模型支持**: 支持切换不同的 LLM 模型
- [ ] **自定义 Agent**: 允许用户配置 Agent 角色
- [ ] **插件系统**: 支持扩展功能插件
- [ ] **API 限流**: 添加请求速率限制
- [ ] **使用统计**: Token 消耗统计和分析
- [ ] **多语言 UI**: 国际化支持

### v1.0.0 - 生产就绪

- [ ] **PostgreSQL 支持**: 生产环境数据库
- [ ] **Redis 缓存**: 会话和缓存管理
- [ ] **Docker 部署**: 容器化部署方案
- [ ] **Kubernetes 支持**: 集群部署配置
- [ ] **监控告警**: 日志和性能监控
- [ ] **CI/CD**: 自动化测试和部署

---

## 注意事项

1. **虚拟环境**: 使用项目根目录的 `.venv`，通过 `uv` 管理
2. **API 消耗**: 项目生成需要消耗 LLM API 调用，请确保有足够的额度
3. **生成时间**: 复杂项目可能需要 5-10 分钟生成
4. **工作目录**: 生成的代码存储在 `workspace` 目录下
5. **数据备份**: 定期备份 `data/mgx_clone.db` 数据库文件

---

## API 文档

### REST API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/projects` | 创建新项目 |
| GET | `/api/projects` | 获取项目列表（分页） |
| GET | `/api/projects/{id}` | 获取项目详情 |
| GET | `/api/projects/{id}/files` | 获取项目文件列表 |
| GET | `/api/projects/{id}/files/{path}` | 获取文件内容 |
| PUT | `/api/projects/{id}/files/{path}` | 保存文件内容 (v0.2.0) |
| GET | `/api/projects/{id}/messages` | 获取项目消息历史 |
| GET | `/api/projects/{id}/download` | 下载项目（ZIP） |
| DELETE | `/api/projects/{id}` | 删除项目（软删除） |
| GET | `/preview/{id}/{path}` | 预览项目静态文件 |
| GET | `/api/templates` | **获取所有模板** (v0.2.1 新增) |
| GET | `/api/templates/categories` | **获取模板分类** (v0.2.1 新增) |
| GET | `/api/templates/{id}` | **获取模板详情** (v0.2.1 新增) |
| POST | `/api/templates/generate-prompt` | **从模板生成 prompt** (v0.2.1 新增) |

### WebSocket 端点

| 端点 | 说明 |
|------|------|
| `/ws/chat/{client_id}` | 聊天和项目生成 |

### WebSocket 消息类型

**客户端 → 服务端**

| type | 说明 | 参数 |
|------|------|------|
| `create_project` | 创建新项目 | `name`, `requirement` |
| `create_from_template` | **从模板创建** (v0.2.1) | `template_id`, `name`, `features`, `custom_requirements` |
| `continue_conversation` | 多轮对话 (v0.2.0) | `project_id`, `message` |
| `regenerate_project` | 重新生成 (v0.2.0) | `project_id` |
| `retry_project` | **重试失败项目** (v0.2.1) | `project_id` |
| `ping` | 心跳检测 | - |

**服务端 → 客户端**

| type | 说明 |
|------|------|
| `agent_message` | Agent 消息 |
| `status` | 状态更新 |
| `complete` | 生成完成 |
| `error` | 错误消息（含 `can_retry` 字段） |
| `progress` | **进度更新** (v0.2.1) - 含 `progress` 和 `agent_states` |
| `agent_status` | **Agent 状态更新** (v0.2.1) - 含 `agent_states` |
| `pong` | 心跳响应 |

---

## License

MIT License

---

## 贡献者

欢迎贡献代码！请先阅读 `.cursor/rules/projectrule.mdc` 中的开发规范，然后提交 Pull Request。
