# OpenClaw Mission Control — API 概览

> **版本**: v3.0 | **更新日期**: 2026-02-23
> **基础 URL**: `https://api.xxx.com`
> **API 文档 (交互式)**: `https://api.xxx.com/docs` (Swagger UI)

---

## 一、认证方式

Mission Control 支持三种认证体系，适用于不同调用场景。

### 1.1 管理员 JWT (Admin JWT)

**适用**: 管理后台 (`admin.xxx.com`) 的所有管理 API 操作

**认证方式**:
- `AUTH_MODE=local`: 请求头 `Authorization: Bearer <LOCAL_AUTH_TOKEN>`
- `AUTH_MODE=clerk`: Clerk 签发的 JWT，通过标准 Bearer Token 携带

**获取方式**: 通过登录接口 `POST /api/v1/auth/login` 或由 Clerk 颁发

**有效期**: 依认证模式而定 (local 模式为固定 token，clerk 模式为短期 JWT)

### 1.2 H5 用户 JWT (H5 JWT)

**适用**: H5 移动端用户 (`h5.xxx.com`) 的聊天和用户中心操作

**认证方式**: 请求头 `Authorization: Bearer <H5_ACCESS_TOKEN>`

**获取方式**: 通过 H5 登录接口 `POST /api/v1/h5/auth/login`

**令牌结构**:
```json
{
  "sub": "<h5_user_id>",
  "org": "<organization_id>",
  "type": "h5",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**有效期**: 访问令牌 15 分钟，刷新令牌 30 天

> ⚠️ H5 JWT 签名密钥 (`H5_JWT_SECRET`) 与管理员 JWT 完全独立，不得共享。

### 1.3 Agent Token (X-Agent-Token)

**适用**: OpenClaw Agent 通过网关调用 `agent.*` 系列端点

**认证方式**: 请求头 `X-Agent-Token: <agent_token>`

**获取方式**: 由管理员在管理后台为 Agent 生成

**权限边界**: Agent Token 仅允许访问 `/api/v1/agent/*` 命名空间下的端点，且受 board 访问策略约束

---

## 二、REST API 端点列表

### 通用响应格式

**成功响应**:
```json
{
  "id": "<uuid>",
  "...": "资源字段"
}
```

**分页列表响应**:
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "size": 20
}
```

**错误响应**:
```json
{
  "detail": "错误描述"
}
```

---

### M1 — 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 存活探针 (Liveness) |
| `GET` | `/healthz` | 平台兼容别名探针 |
| `GET` | `/readyz` | 就绪探针 (Readiness) |

---

### M2 — 网关自动注册

**认证**: 管理员 JWT

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/gateway-registry/register` | 网关注册 |
| `POST` | `/api/v1/gateway-registry/heartbeat` | 网关心跳上报 |
| `DELETE` | `/api/v1/gateway-registry/deregister` | 网关注销 |

**`POST /api/v1/gateway-registry/register`**:
```json
// 请求体
{
  "organization_id": "<uuid>",
  "registration_token": "gw_reg_...",
  "name": "office-gateway-shenzhen-01",
  "url": "wss://gateway-sz.internal",
  "workspace_root": "/opt/openclaw/workspace",
  "version": "1.2.0",
  "capabilities": ["chat", "code_review"]
}

// 响应
{
  "gateway_id": "<uuid>",
  "relay_ws_url": "wss://api.xxx.com/ws/gateway/<id>/relay",
  "relay_token": "relay_...",
  "heartbeat_interval_seconds": 30
}
```

---

### M3 — H5 用户认证

**认证**: 无 (公开端点) / H5 JWT (需认证端点)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/h5/auth/register` | H5 用户注册 |
| `POST` | `/api/v1/h5/auth/login` | H5 用户登录 |
| `POST` | `/api/v1/h5/auth/refresh` | 刷新访问令牌 |
| `GET` | `/api/v1/h5/auth/me` | 获取当前 H5 用户信息 |
| `PATCH` | `/api/v1/h5/auth/me` | 更新 H5 用户资料 |

**管理员端点** (需管理员 JWT):

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/h5/users` | 列出 H5 用户 (分页) |
| `GET` | `/api/v1/h5/users/{id}` | H5 用户详情 + 分配信息 |
| `POST` | `/api/v1/h5/users/{id}/assign` | 将用户分配给 Agent |
| `DELETE` | `/api/v1/h5/users/{id}/assign/{agent_id}` | 取消 Agent 分配 |

---

### 基础资源管理 (原有模块)

**认证**: 管理员 JWT

#### 组织管理
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/organizations` | 列出组织 |
| `POST` | `/api/v1/organizations` | 创建组织 |
| `GET` | `/api/v1/organizations/{id}` | 获取组织详情 |
| `PATCH` | `/api/v1/organizations/{id}` | 更新组织 |
| `DELETE` | `/api/v1/organizations/{id}` | 删除组织 |

#### Agent 管理
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/agents` | 列出所有 Agent |
| `POST` | `/api/v1/agents` | 创建 Agent |
| `GET` | `/api/v1/agents/{id}` | Agent 详情 |
| `PATCH` | `/api/v1/agents/{id}` | 更新 Agent |
| `DELETE` | `/api/v1/agents/{id}` | 删除 Agent |
| `GET` | `/api/v1/agents/{id}/capabilities` | Agent 能力列表 |
| `POST` | `/api/v1/agents/{id}/capabilities` | 添加 Agent 能力 |
| `DELETE` | `/api/v1/agents/{id}/capabilities/{cap}` | 删除 Agent 能力 |

#### 网关管理
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/gateways` | 列出网关 |
| `POST` | `/api/v1/gateways` | 创建网关 |
| `GET` | `/api/v1/gateways/{id}` | 网关详情 |
| `PATCH` | `/api/v1/gateways/{id}` | 更新网关 |
| `DELETE` | `/api/v1/gateways/{id}` | 删除网关 |
| `GET` | `/api/v1/gateways/{id}/connections` | 网关实时连接列表 |
| `GET` | `/api/v1/gateways/{id}/metrics` | 网关健康指标 |

#### 看板组 & 看板
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/board-groups` | 列出看板组 |
| `POST` | `/api/v1/board-groups` | 创建看板组 |
| `GET` | `/api/v1/board-groups/{id}` | 看板组详情 |
| `GET` | `/api/v1/boards` | 列出看板 |
| `POST` | `/api/v1/boards` | 创建看板 |
| `GET` | `/api/v1/boards/{id}` | 看板详情 |
| `PATCH` | `/api/v1/boards/{id}` | 更新看板 |
| `DELETE` | `/api/v1/boards/{id}` | 删除看板 |

#### 任务管理
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/tasks` | 列出任务 |
| `POST` | `/api/v1/tasks` | 创建任务 |
| `GET` | `/api/v1/tasks/{id}` | 任务详情 |
| `PATCH` | `/api/v1/tasks/{id}` | 更新任务 |
| `DELETE` | `/api/v1/tasks/{id}` | 删除任务 |

#### 审批流程
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/approvals` | 列出审批请求 |
| `POST` | `/api/v1/approvals` | 创建审批请求 |
| `GET` | `/api/v1/approvals/{id}` | 审批详情 |
| `POST` | `/api/v1/approvals/{id}/approve` | 批准 |
| `POST` | `/api/v1/approvals/{id}/reject` | 拒绝 |

---

### M8 — AI 主动智能引擎

**认证**: 管理员 JWT

#### AI 建议 (Suggestions)
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/suggestions` | 列出 AI 建议 (支持过滤) |
| `GET` | `/api/v1/suggestions/{id}` | 获取建议详情 |
| `POST` | `/api/v1/suggestions/{id}/accept` | 采纳建议 |
| `POST` | `/api/v1/suggestions/{id}/dismiss` | 忽略建议 |

**查询参数** (`GET /api/v1/suggestions`):
- `status`: `pending`/`accepted`/`dismissed`/`expired`/`executed`
- `board_id`: 按看板过滤
- `priority`: `low`/`medium`/`high`/`critical`
- `limit`, `offset`: 分页

#### 主动规则 (Proactive Rules)
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/proactive-rules` | 列出规则 |
| `POST` | `/api/v1/proactive-rules` | 创建规则 |
| `PATCH` | `/api/v1/proactive-rules/{id}` | 更新规则 |
| `DELETE` | `/api/v1/proactive-rules/{id}` | 删除规则 |
| `POST` | `/api/v1/proactive-rules/{id}/toggle` | 启用/禁用规则 |

#### Agent 事件 (面向 Agent)
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/agent/suggestions` | Agent 上报建议 |
| `POST` | `/api/v1/agent/events` | Agent 上报系统事件 |

---

### M10 — 通用工作流引擎

**认证**: 管理员 JWT

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/pipelines` | 列出工作流管道 |
| `POST` | `/api/v1/pipelines` | 创建管道 |
| `GET` | `/api/v1/pipelines/{id}` | 管道详情 |
| `PATCH` | `/api/v1/pipelines/{id}` | 更新管道定义 |
| `DELETE` | `/api/v1/pipelines/{id}` | 删除管道 |
| `POST` | `/api/v1/pipelines/{id}/run` | 触发管道运行 |
| `GET` | `/api/v1/pipelines/{id}/runs` | 列出管道运行记录 |
| `GET` | `/api/v1/pipeline-runs/{run_id}` | 运行详情 + 阶段结果 |
| `POST` | `/api/v1/pipeline-runs/{run_id}/cancel` | 取消运行 |
| `GET` | `/api/v1/pipeline-templates` | 列出内置管道模板 |

---

### M11 — 共享日历系统

**认证**: 管理员 JWT

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/calendar/events` | 列出日历事件 |
| `POST` | `/api/v1/calendar/events` | 创建日历事件 |
| `PATCH` | `/api/v1/calendar/events/{id}` | 更新事件 |
| `DELETE` | `/api/v1/calendar/events/{id}` | 删除事件 |
| `GET` | `/api/v1/calendar/schedules` | 列出任务排期 |
| `POST` | `/api/v1/calendar/schedules` | 创建任务排期 |
| `DELETE` | `/api/v1/calendar/schedules/{id}` | 删除排期 |
| `GET` | `/api/v1/calendar/workload` | 获取 Agent 工作量 |
| `POST` | `/api/v1/calendar/suggest-slot` | 获取最优时间建议 |

**查询参数** (`GET /api/v1/calendar/events`):
- `start_date`, `end_date`: 时间范围 (ISO 8601)
- `board_id`, `agent_id`, `event_type`: 过滤条件

---

### M12 — 数字记忆中心 (知识库)

**认证**: 管理员 JWT

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/knowledge` | 列出知识条目 |
| `POST` | `/api/v1/knowledge` | 创建知识条目 |
| `GET` | `/api/v1/knowledge/{id}` | 知识条目详情 |
| `PATCH` | `/api/v1/knowledge/{id}` | 更新知识条目 |
| `DELETE` | `/api/v1/knowledge/{id}` | 删除知识条目 |
| `POST` | `/api/v1/knowledge/{id}/pin` | 置顶/取消置顶 |
| `POST` | `/api/v1/knowledge/search` | 混合搜索知识库 |
| `POST` | `/api/v1/knowledge/{id}/documents` | 上传附件文档 |
| `DELETE` | `/api/v1/knowledge/documents/{doc_id}` | 删除附件 |
| `POST` | `/api/v1/agent/knowledge` | Agent 保存知识 |

**搜索请求体** (`POST /api/v1/knowledge/search`):
```json
{
  "query": "搜索关键词",
  "mode": "hybrid",
  "board_id": "<uuid>",
  "category": "技术文档",
  "limit": 20
}
```

搜索模式:
- `keyword` — PostgreSQL tsvector 全文检索
- `semantic` — pgvector 余弦相似度语义检索
- `hybrid` — 混合检索 (0.3 关键词权重 + 0.7 语义权重)

---

### M13 — 团队架构 + 指挥中心

**认证**: 管理员 JWT

#### 团队管理
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/agent-teams` | 列出 Agent 团队 |
| `POST` | `/api/v1/agent-teams` | 创建团队 |
| `GET` | `/api/v1/agent-teams/{id}` | 团队详情 |
| `PATCH` | `/api/v1/agent-teams/{id}` | 更新团队 |
| `DELETE` | `/api/v1/agent-teams/{id}` | 删除团队 |
| `POST` | `/api/v1/agent-teams/{id}/members` | 添加成员 |
| `DELETE` | `/api/v1/agent-teams/{id}/members/{agent_id}` | 移除成员 |
| `GET` | `/api/v1/agent-capabilities/search` | 按能力搜索 Agent |

#### 指挥中心仪表板
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/command-center/overview` | KPI 概览 (活跃 Agent 数、今日任务数等) |
| `GET` | `/api/v1/command-center/agent-status` | Agent 实时状态列表 |
| `GET` | `/api/v1/command-center/communication-graph` | Agent 通信关系图谱 |
| `GET` | `/api/v1/command-center/resource-allocation` | 资源分配详情 |
| `GET` | `/api/v1/command-center/live-activity` | 实时活动事件流 |

---

### 其他现有模块

**认证**: 管理员 JWT

| 模块 | 端点前缀 | 说明 |
|------|---------|------|
| 活动记录 | `/api/v1/activity` | 操作审计时间线 |
| 指标统计 | `/api/v1/metrics` | 看板和运营统计数据 |
| 技能市场 | `/api/v1/skills-marketplace` | Agent 技能安装/卸载 |
| Souls 目录 | `/api/v1/souls-directory` | Agent 灵魂模板目录 |
| 看板内存 | `/api/v1/boards/{id}/memory` | 看板级别持久化内存 |
| 看板组内存 | `/api/v1/board-groups/{id}/memory` | 看板组级别持久化内存 |
| 看板 Webhook | `/api/v1/boards/{id}/webhooks` | 看板 Webhook 管理 |
| 自定义字段 | `/api/v1/task-custom-fields` | 任务自定义字段定义 |
| 标签 | `/api/v1/tags` | 标签目录和任务标签关联 |
| 用户 | `/api/v1/users` | 用户资料读写 |

---

## 三、WebSocket 端点

### 3.1 H5 聊天 WebSocket

**端点**: `WSS /ws/h5/chat`

**用途**: H5 移动端用户与 Agent 的实时聊天通信

**认证握手** (连接后第一条消息):
```json
{ "type": "auth", "payload": { "token": "<h5-jwt>" } }
```

**响应**:
```json
{ "type": "auth_ok", "payload": { "user_id": "...", "assignments": [...] } }
// 或
{ "type": "auth_error", "payload": { "reason": "invalid_token" } }
```

**消息格式** (客户端 → 服务端):
```json
{
  "type": "chat",
  "id": "<uuid>",
  "payload": {
    "agent_id": "<uuid>",
    "content": "你好！",
    "session_id": "<uuid>"
  }
}
```

**消息格式** (服务端 → 客户端):
```json
{
  "type": "chat",
  "id": "<uuid>",
  "payload": {
    "agent_id": "<uuid>",
    "content": "你好！有什么可以帮您？",
    "session_id": "<uuid>",
    "role": "agent"
  }
}
```

**系统消息**:
```json
{ "type": "heartbeat", "id": "<uuid>" }
{ "type": "system", "payload": { "event": "agent_offline", "agent_id": "..." } }
{ "type": "error", "payload": { "code": "AGENT_UNAVAILABLE", "message": "..." } }
```

---

### 3.2 网关中继 WebSocket

**端点**: `WSS /ws/gateway/{gateway_id}/relay`

**用途**: OpenClaw 网关与 API 服务器之间的持久化中继连接

**认证握手**:
```json
{ "type": "auth", "payload": { "relay_token": "..." } }
// 响应
{ "type": "auth_ok", "payload": { "gateway_id": "...", "config": {...} } }
```

---

### 3.3 看板实时同步 WebSocket

**端点**: `WSS /ws/board/{board_id}/sync`

**用途**: 管理后台多用户协作时的看板实时同步

**认证**: Bearer Token (管理员 JWT)

**服务端推送消息类型**:
```json
{ "type": "task.updated", "task_id": "...", "changes": {}, "updated_by": {"type": "user", "id": "..."}, "timestamp": "..." }
{ "type": "task.created", "task": {...}, "timestamp": "..." }
{ "type": "task.deleted", "task_id": "...", "timestamp": "..." }
{ "type": "suggestion.new", "suggestion": {...} }
{ "type": "board.state", "tasks": [...], "timestamp": "..." }
```

**客户端发送消息类型**:
```json
{ "type": "task.move", "task_id": "...", "status": "in_progress" }
{ "type": "task.create", "title": "...", "status": "todo", "assignee_id": "..." }
```

---

## 四、SSE 端点

### 4.1 AI 建议实时推送

**端点**: `GET /api/v1/suggestions/stream`

**认证**: 管理员 JWT

**请求头**: `Accept: text/event-stream`

**事件格式**:
```
data: {"type": "suggestion.new", "suggestion": {"id": "...", "title": "...", ...}}

data: {"type": "keepalive"}
```

**用途**: 管理后台右上角 `SuggestionBell` 通知铃铛实时接收新 AI 建议推送

---

## 五、错误码说明

### HTTP 状态码

| 状态码 | 含义 | 常见场景 |
|--------|------|---------|
| `200` | 成功 | 通用成功响应 |
| `201` | 资源已创建 | POST 创建资源成功 |
| `204` | 无内容 | DELETE 成功 |
| `400` | 请求验证失败 | 请求体格式错误 |
| `401` | 未认证 | Token 缺失或无效 |
| `403` | 权限不足 | 无权访问该资源 |
| `404` | 资源不存在 | ID 对应资源未找到 |
| `409` | 冲突 | 重复创建或状态冲突 |
| `422` | 字段验证失败 | 字段类型/格式错误 |
| `429` | 请求频率超限 | 触发限流 |
| `500` | 服务器内部错误 | 服务器异常 |

### 业务错误码 (WebSocket)

| 错误码 | 含义 |
|--------|------|
| `AGENT_UNAVAILABLE` | 目标 Agent 当前不可用 |
| `GATEWAY_OFFLINE` | 网关已离线 |
| `SESSION_NOT_FOUND` | 聊天会话不存在 |
| `ASSIGNMENT_NOT_FOUND` | H5 用户与 Agent 未建立分配关系 |
| `AUTH_REQUIRED` | 需要认证但未提供 Token |
| `INVALID_TOKEN` | Token 无效或已过期 |

---

## 六、分页与过滤

### 分页参数

所有列表端点支持以下标准分页参数:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | integer | 20 | 每页返回数量 (最大 100) |
| `offset` | integer | 0 | 偏移量 |

响应头包含:
- `X-Total-Count`: 总记录数
- `X-Limit`: 当前 limit 值
- `X-Offset`: 当前 offset 值

### 排序参数 (部分端点支持)

| 参数 | 示例值 | 说明 |
|------|--------|------|
| `sort` | `created_at` | 排序字段 |
| `order` | `asc`/`desc` | 排序方向 |

---

*完整的交互式 API 文档请访问运行中的服务: `http://localhost:8000/docs`*
