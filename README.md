# OpenClaw Mission Control

[![CI](https://github.com/abhi1693/openclaw-mission-control/actions/workflows/ci.yml/badge.svg)](https://github.com/abhi1693/openclaw-mission-control/actions/workflows/ci.yml)

OpenClaw Mission Control is the centralized operations and governance platform for running OpenClaw across teams and organizations, with unified visibility, approval controls, and gateway-aware orchestration.
It gives operators a single interface for work orchestration, agent and gateway management, approval-driven governance, and API-backed automation.

<img width="1896" height="869" alt="Mission Control dashboard" src="https://github.com/user-attachments/assets/49a3c823-6aaf-4c56-8328-fb1485ee940f" />
<img width="1896" height="858" alt="image" src="https://github.com/user-attachments/assets/2bfee13a-3dab-4f4a-9135-e47bb6949dcf" />
<img width="1890" height="865" alt="image" src="https://github.com/user-attachments/assets/84c2e867-5dc7-4a36-9290-e29179d2a659" />
<img width="1912" height="881" alt="image" src="https://github.com/user-attachments/assets/3bbd825c-9969-4bbf-bf31-987f9168f370" />
<img width="1902" height="878" alt="image" src="https://github.com/user-attachments/assets/eea09632-60e4-4d6d-9e6e-bdfa0ac97630" />

## 平台概述 / Platform Overview

Mission Control 是 OpenClaw 的日常运营操作界面。通过统一的工作台，团队可以完成规划、执行、审查和审计，无需在多个工具之间切换。

### 核心功能模块

#### 基础运营能力
- **工作编排**: 管理组织、看板组、看板、任务和标签
- **Agent 运维**: 统一界面中创建、检查和管理 Agent 生命周期
- **治理与审批**: 将敏感操作路由到明确的审批流程
- **网关管理**: 连接并操作分布式环境中的网关集成
- **活动可见性**: 审查系统操作时间线，快速调试和追责
- **API 优先**: 支持 Web 工作流和自动化客户端操作同一平台

#### v3.0 新增能力

| 模块 | 功能 | 说明 |
|------|------|------|
| **M2** | 网关自动注册 | 网关自动上线、心跳监控、健康状态追踪 |
| **M3** | H5 用户认证 | 独立 JWT 体系，支持移动端终端用户登录 |
| **M4** | WebSocket 中继 | H5 用户与 Agent 实时聊天消息路由 |
| **M5** | H5 聊天界面 | 集成于管理前端的移动端聊天 UI |
| **M6** | 管理扩展 | 网关健康监控 + H5 用户管理 |
| **M7** | 独立 H5 应用 | Vite + PWA 轻量移动端，115KB gzip |
| **M8** | AI 主动智能 | 事件驱动规则引擎，主动推送 AI 建议 |
| **M9** | 实时看板同步 | 多管理员协作，任务变更实时广播 |
| **M10** | 工作流引擎 | 可视化管道构建，5 种阶段类型 |
| **M11** | 共享日历 | 里程碑、任务排期、工作量可视化 |
| **M12** | 数字记忆中心 | 关键词+语义混合知识库检索 |
| **M13** | 团队 + 指挥中心 | Agent 团队管理 + D3.js 实时仪表板 |

## 使用场景

- **多团队 Agent 运营**: 从单一控制平面管理跨组织的多个看板和看板组
- **人工审批介入**: 敏感操作前强制审批，保留完整决策链
- **分布式运行时控制**: 连接网关，操作远程执行环境，不改变操作员工作流
- **审计与事件复盘**: 重建事件链，明确时间节点和操作人
- **API 自动化集成**: 连接内部流程工具和自动化客户端
- **H5 移动端对话**: 终端用户通过移动端直接与 Agent 实时聊天
- **主动 AI 建议**: AI 主动发现潜在问题并推送行动建议

## Mission Control 的差异化优势

- **运营优先设计**: 面向可靠执行 Agent 工作，而非仅创建任务
- **治理内置**: 审批、认证模式和明确控制边界是一等公民
- **网关感知编排**: 同时操作本地和远程运行时环境
- **统一 UI 和 API 模型**: 操作员和自动化系统操作相同的对象和生命周期
- **团队规模结构**: 组织/看板组/看板/任务/标签/用户纳入统一记录系统
- **AI 主动协作**: 事件驱动规则引擎，主动向管理员推送智能建议
- **实时协作**: WebSocket 多用户实时同步，告别页面刷新

## Who it is for

- Platform teams running OpenClaw in self-hosted or internal environments.
- Operations and engineering teams that need clear approval and auditability controls.
- Organizations that want API-accessible operations without losing a usable web UI.

## Get started in minutes

### Option A: One-command production-style bootstrap

If you haven't cloned the repo yet, you can run the installer in one line:

```bash
curl -fsSL https://raw.githubusercontent.com/abhi1693/openclaw-mission-control/master/install.sh | bash
```

If you already cloned the repo:

```bash
./install.sh
```

The installer is interactive and will:

- Ask for deployment mode (`docker` or `local`).
- Install missing system dependencies when possible.
- Generate and configure environment files.
- Bootstrap and start the selected deployment mode.

Installer support matrix: [`docs/installer-support.md`](./docs/installer-support.md)

### Option B: Manual setup

### Prerequisites

- Docker Engine
- Docker Compose v2 (`docker compose`)

### 1. Configure environment

```bash
cp .env.example .env
```

Before startup:

- Set `LOCAL_AUTH_TOKEN` to a non-placeholder value (minimum 50 characters) when `AUTH_MODE=local`.
- Ensure `NEXT_PUBLIC_API_URL` is reachable from your browser.

### 2. Start Mission Control

```bash
docker compose -f compose.yml --env-file .env up -d --build
```

### 3. Open the application

- Mission Control UI: http://localhost:3000
- Backend health: http://localhost:8000/healthz

### 4. Stop the stack

```bash
docker compose -f compose.yml --env-file .env down
```

## Authentication

Mission Control supports two authentication modes:

- `local`: shared bearer token mode (default for self-hosted use)
- `clerk`: Clerk JWT mode

Environment templates:

- Root: [`.env.example`](./.env.example)
- Backend: [`backend/.env.example`](./backend/.env.example)
- Frontend: [`frontend/.env.example`](./frontend/.env.example)

## 文档导航 / Documentation

完整的部署、API、验收报告和测试指南均在 [`/docs`](./docs/) 目录下。

| 文档 | 说明 |
|------|------|
| [部署指南](./docs/DEPLOYMENT_GUIDE.md) | 本地开发、Docker Compose、阿里云生产部署 |
| [API 概览](./docs/API_OVERVIEW.md) | 认证方式、REST/WebSocket/SSE 端点列表 |
| [验收报告](./docs/ACCEPTANCE_REPORT.md) | 13 模块功能验收、非功能验收、后续建议 |
| [开发进度](./docs/DEVELOPMENT_PROGRESS.md) | 各阶段开发记录，模块状态追踪 |
| [架构设计](./ARCHITECTURE.md) | 系统架构图、模块规格、技术决策 |
| [贡献指南](./CONTRIBUTING.md) | 如何参与贡献 |

### 系统架构概览

```
                    阿里云 (VPC)
+=================================================================+
|                                                                 |
|  SLB (Internet-facing, HTTPS/WSS 终止)                         |
|    |                                                            |
|    +-- api.xxx.com  --> ECS: FastAPI 服务器 × 2                |
|    |                      REST /api/v1/*                        |
|    |                      WebSocket /ws/h5/chat                 |
|    |                      WebSocket /ws/gateway/{id}/relay      |
|    |                      WebSocket /ws/board/{id}/sync         |
|    |                      SSE /api/v1/suggestions/stream        |
|    |                                                            |
|    +-- admin.xxx.com --> ECS: Next.js 管理前端 × 1             |
|    |                      (指挥中心/日历/工作流/知识库/团队)    |
|    |                                                            |
|    +-- h5.xxx.com  ---> ECS: H5 移动端应用 × 1 (Vite + PWA)  |
|                                                                 |
|  RDS PostgreSQL 16 (HA) + pgvector 扩展                        |
|  Redis 7 Cluster: DB0(RQ队列) DB1(WS中继) DB2(事件总线) DB3(看板同步)|
|  ECS: RQ Workers × 2 + Event Bus Consumer × 1                 |
|  ACR: 容器镜像仓库                                             |
|  OSS: 知识库文档存储                                           |
+=================================================================+
```

## Project status

Mission Control is under active development.

- Features and APIs may change between releases.
- Validate and harden your configuration before production use.

## Contributing

Issues and pull requests are welcome.

- [Contributing guide](./CONTRIBUTING.md)
- [Open issues](https://github.com/abhi1693/openclaw-mission-control/issues)

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=abhi1693/openclaw-mission-control&type=date&legend=top-left)](https://www.star-history.com/#abhi1693/openclaw-mission-control&type=date&legend=top-left)
