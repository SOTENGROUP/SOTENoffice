# OpenClaw Mission Control — 部署指南

> **版本**: v3.0 | **更新日期**: 2026-02-23
> **适用范围**: 本地开发环境、Docker Compose 部署、阿里云生产环境

---

## 一、前提条件

### 1.1 本地开发环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Python | 3.12+ | 后端运行时 |
| Node.js | 20+ | 前端构建工具 |
| Docker Engine | 24+ | 容器运行时 |
| Docker Compose | v2.20+ | 编排工具 (`docker compose` v2) |
| uv | 0.5+ | Python 依赖管理器 |
| PostgreSQL 客户端 | 16 | 数据库迁移工具 |
| Redis CLI | 7+ | 缓存调试工具 |

### 1.2 阿里云生产环境要求

| 服务 | 规格 | 用途 |
|------|------|------|
| ECS × 2 | 4C8G / Ubuntu 22.04 | API 服务器 (负载均衡) |
| ECS × 1 | 2C4G | Next.js 管理前端 |
| ECS × 2 | 2C4G | RQ Worker 节点 |
| ECS × 1 | 2C4G | Event Bus Consumer |
| ECS × 1 | 2C4G | H5 移动端应用 (可选) |
| RDS PostgreSQL 16 | 2C4G HA / 100GB | 主数据库 + pgvector 扩展 |
| Redis 7 | 4GB Cluster | 缓存 + Pub/Sub + 任务队列 (4个DB) |
| SLB (Internet-facing) | Standard | HTTPS/WSS 负载均衡 |
| ACR (Container Registry) | Standard | Docker 镜像仓库 |
| OSS | Standard | 知识文档文件存储 |
| SSL 证书 | 免费 DV (ACM) | HTTPS/WSS 终止 |
| VPC + 安全组 | — | 网络隔离 |

### 1.3 网络端口要求

| 端口 | 协议 | 用途 |
|------|------|------|
| 80/443 | HTTP/HTTPS | SLB 公网入口 |
| 8000 | HTTP/WS | API 服务器内网端口 |
| 3000 | HTTP | 管理前端内网端口 |
| 5432 | TCP | PostgreSQL 内网端口 |
| 6379 | TCP | Redis 内网端口 |

---

## 二、本地开发环境搭建

### 2.1 克隆仓库

```bash
git clone https://github.com/SOTENGROUP/SOTENoffice.git
cd openclaw-mission-control
```

### 2.2 配置环境变量

```bash
# 复制根目录环境变量模板
cp .env.example .env

# 复制后端环境变量模板
cp backend/.env.example backend/.env

# 复制前端环境变量模板
cp frontend/.env.example frontend/.env
```

编辑 `.env` 文件，至少设置以下变量:

```bash
# 认证模式: local 或 clerk
AUTH_MODE=local
LOCAL_AUTH_TOKEN=<至少50字符的随机字符串>

# 数据库 (本地使用默认 Docker 配置)
DATABASE_URL=postgresql+psycopg://mission_control:mission_control@localhost:5432/mission_control

# 前端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2.3 安装依赖

```bash
# 安装所有依赖 (后端 + 前端)
make setup
```

或分别安装:

```bash
# 后端依赖
cd backend && uv sync

# 前端依赖
cd frontend && npm install

# H5 移动端 (可选)
cd h5-app && npm install
```

### 2.4 启动数据库服务

```bash
# 仅启动数据库
docker compose -f compose.yml --env-file .env up -d db redis
```

### 2.5 运行数据库迁移

```bash
cd backend
uv run alembic upgrade head
```

### 2.6 启动开发服务器

```bash
# 快速本地开发循环 (推荐)
# 终端 1: 启动后端 (热重载)
cd backend && uv run uvicorn app.main:app --reload --port 8000

# 终端 2: 启动前端 (热重载)
cd frontend && npm run dev

# 终端 3 (可选): 启动 H5 移动端
cd h5-app && npm run dev
```

### 2.7 验证服务

| 服务 | URL |
|------|-----|
| 管理后台 | http://localhost:3000 |
| 后端 API | http://localhost:8000 |
| 健康检查 | http://localhost:8000/healthz |
| API 文档 (Swagger) | http://localhost:8000/docs |

---

## 三、Docker Compose 本地部署

### 3.1 完整栈启动

```bash
# 启动全栈服务
docker compose -f compose.yml --env-file .env up -d --build
```

服务组成:
- `api` — FastAPI 后端 (端口 8000)
- `frontend` — Next.js 管理前端 (端口 3000)
- `db` — PostgreSQL 16 数据库
- `redis` — Redis 7 缓存

### 3.2 查看服务状态

```bash
docker compose -f compose.yml ps
docker compose -f compose.yml logs -f api
```

### 3.3 停止服务

```bash
docker compose -f compose.yml --env-file .env down
```

### 3.4 完整重置

```bash
# 停止服务并删除数据卷 (⚠️ 会清空数据库)
docker compose -f compose.yml --env-file .env down -v
```

---

## 四、阿里云生产环境部署

### 4.1 容器镜像构建与推送

```bash
# 设置 ACR 仓库地址
export ACR_REGISTRY=registry.cn-shenzhen.aliyuncs.com/<namespace>
export TAG=$(git rev-parse --short HEAD)

# 登录 ACR
docker login $ACR_REGISTRY

# 构建并推送后端镜像
docker build -f Dockerfile.backend.prod -t $ACR_REGISTRY/mc-backend:$TAG .
docker push $ACR_REGISTRY/mc-backend:$TAG

# 构建并推送前端镜像
docker build -f Dockerfile.frontend.prod -t $ACR_REGISTRY/mc-frontend:$TAG .
docker push $ACR_REGISTRY/mc-frontend:$TAG
```

### 4.2 初始化数据库

在 RDS PostgreSQL 实例上执行初始化脚本:

```bash
# 安装必要扩展
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# 运行 Alembic 迁移
cd backend && uv run alembic upgrade head
```

### 4.3 配置 SLB

SLB 需要以下特殊配置以支持 WebSocket 和 SSE:

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 连接超时 | 300 秒 | 支持长连接 WS/SSE |
| WebSocket 升级 | 开启 | 启用协议升级 |
| 健康检查路径 | `GET /healthz` | 每 10s 检查一次 |
| 健康检查阈值 | 连续 2 次失败 | 摘除节点条件 |
| 会话保持 | 源 IP | WebSocket 连接粘性 |

### 4.4 生产环境 Docker Compose 部署

```bash
# 复制并编辑生产环境变量
cp deploy/aliyun/env/.env.production.example deploy/aliyun/env/.env.production

# 使用生产 compose 文件部署
docker compose -f deploy/aliyun/docker-compose.prod.yml \
  --env-file deploy/aliyun/env/.env.production \
  up -d
```

生产服务组成:
- `api-server × 2` — FastAPI API 服务器 (4 workers)
- `event-bus-consumer × 1` — AI 主动智能规则引擎进程
- `rq-worker × 2` — 任务队列 Worker (webhook/pipeline)
- `frontend × 1` — Next.js 管理后台

### 4.5 CI/CD 自动部署

项目已配置 GitHub Actions CI/CD 流水线 (`.github/workflows/deploy-aliyun.yml`)。

**触发条件**: 推送 `master` 分支或创建版本标签

**流水线步骤**:
1. 代码检查 (Lint + 类型检查)
2. 运行测试 (单元测试 + 集成测试)
3. 构建 Docker 镜像
4. 推送到 ACR
5. SSH 登录 ECS 执行滚动更新

**配置 GitHub Secrets**:
```
ACR_REGISTRY=registry.cn-shenzhen.aliyuncs.com/<namespace>
ACR_USERNAME=<aliyun-access-key-id>
ACR_PASSWORD=<aliyun-access-key-secret>
ECS_HOST=<ecs-public-ip>
ECS_USER=ubuntu
ECS_SSH_KEY=<private-ssh-key>
```

---

## 五、数据库迁移说明

### 5.1 生成新的迁移文件

```bash
cd backend
uv run alembic revision --autogenerate -m "描述此迁移的内容"
```

### 5.2 应用迁移

```bash
# 应用所有未执行的迁移
uv run alembic upgrade head

# 应用到指定版本
uv run alembic upgrade <revision_id>

# 回退最近一次迁移
uv run alembic downgrade -1
```

### 5.3 查看迁移历史

```bash
uv run alembic history --verbose
uv run alembic current
```

### 5.4 重要迁移说明

| 迁移 | 模块 | 说明 |
|------|------|------|
| 添加 `h5_users` 系列表 | M3 | H5 用户认证系统 |
| 添加 `h5_chat_sessions` | M4 | WebSocket 会话追踪 |
| 添加网关注册字段 | M2 | 网关自动注册协议 |
| 添加 `agent_suggestions` 系列表 | M8 | AI 主动智能引擎 |
| 添加 `pipelines` 系列表 | M10 | 工作流引擎 |
| 添加 `calendar_events` 系列表 | M11 | 共享日历系统 |
| 添加 `knowledge_entries` + pgvector | M12 | 数字记忆中心 |
| 添加 `agent_teams` 系列表 | M13 | 团队架构 |

> ⚠️ **注意**: 合并分支时需按依赖顺序执行迁移。请参考 `ARCHITECTURE.md` 第 3 节依赖图。

---

## 六、环境变量完整说明

### 6.1 基础配置

| 变量名 | 必填 | 示例值 | 说明 |
|--------|------|--------|------|
| `AUTH_MODE` | 是 | `local` | 认证模式: `local` 或 `clerk` |
| `LOCAL_AUTH_TOKEN` | 是* | `<50+字符随机串>` | local 模式下的共享 Bearer Token |
| `DATABASE_URL` | 是 | `postgresql+psycopg://...` | PostgreSQL 连接字符串 |
| `REDIS_URL` | 是 | `redis://localhost:6379/0` | Redis 基础连接 (DB0) |
| `CORS_ORIGINS` | 否 | `https://admin.xxx.com` | 允许的 CORS 来源 (逗号分隔) |
| `ENVIRONMENT` | 否 | `production` | 运行环境标识 |
| `DB_AUTO_MIGRATE` | 否 | `false` | 启动时自动执行 Alembic 迁移 |

### 6.2 M2 — 网关自动注册

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `GATEWAY_REGISTRATION_ENABLED` | `true` | 是否启用网关自动注册 |
| `GATEWAY_HEARTBEAT_INTERVAL_SECONDS` | `30` | 心跳上报间隔 (秒) |
| `GATEWAY_OFFLINE_THRESHOLD_SECONDS` | `90` | 超过此时间无心跳则标记离线 |

### 6.3 M3 — H5 用户认证

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `H5_JWT_SECRET` | 是 | H5 用户 JWT 签名密钥 (独立于管理员 JWT) |
| `H5_JWT_ACCESS_TTL_MINUTES` | 否 (默认 15) | 访问令牌有效期 (分钟) |
| `H5_JWT_REFRESH_TTL_DAYS` | 否 (默认 30) | 刷新令牌有效期 (天) |

### 6.4 M4 — WebSocket 中继服务

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `WS_REDIS_PUBSUB_URL` | `redis://.../1` | Redis DB1 用于 WS Pub/Sub 跨实例路由 |
| `WS_HEARTBEAT_INTERVAL_SECONDS` | `30` | WS 心跳间隔 |
| `WS_HEARTBEAT_TIMEOUT_SECONDS` | `90` | WS 连接心跳超时 |
| `WS_MAX_CONNECTIONS_PER_INSTANCE` | `10000` | 每实例最大 WS 连接数 |

### 6.5 M8 — AI 主动智能引擎

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PROACTIVITY_REDIS_URL` | `redis://.../2` | Redis DB2 用于事件总线 |
| `PROACTIVITY_EVENT_TTL_DAYS` | `90` | 事件日志保留天数 |
| `PROACTIVITY_SUGGESTION_EXPIRY_HOURS` | `168` | 建议自动过期时间 (7天) |
| `PROACTIVITY_RULE_COOLDOWN_SECONDS` | `3600` | 同一规则最小触发间隔 |

### 6.6 M9 — 看板实时同步

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `BOARD_SYNC_REDIS_URL` | `redis://.../3` | Redis DB3 用于看板同步 Pub/Sub |

### 6.7 M10 — 工作流引擎

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PIPELINE_DEFAULT_STAGE_TIMEOUT_HOURS` | `24` | 阶段执行默认超时时间 |
| `PIPELINE_MAX_CONCURRENT_RUNS` | `10` | 最大并发管道运行数 |

### 6.8 M12 — 数字记忆中心 (知识库)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `KNOWLEDGE_SEARCH_LANGUAGE` | `english` | 全文检索语言 |
| `KNOWLEDGE_MAX_DOCUMENT_SIZE_MB` | `50` | 上传文档最大体积 (MB) |
| `EMBEDDING_PROVIDER` | `openai` | 向量嵌入供应商: `openai`/`tongyi`/`local` |
| `EMBEDDING_API_KEY` | — | 嵌入 API 密钥 |
| `EMBEDDING_MODEL` | `text-embedding-ada-002` | 嵌入模型名称 |

### 6.9 阿里云核心配置

| 变量名 | 说明 |
|--------|------|
| `ACR_REGISTRY` | ACR 仓库地址 (如 `registry.cn-shenzhen.aliyuncs.com/<ns>`) |
| `RDS_HOST` | RDS 内网域名/IP |
| `RDS_DB` | 数据库名称 (默认 `mission_control`) |
| `RDS_USER` | 数据库用户名 |
| `RDS_PASS` | 数据库密码 |
| `REDIS_HOST` | Redis 内网域名/IP |

### 6.10 阿里云 OSS (M12 文档存储)

| 变量名 | 说明 |
|--------|------|
| `OSS_ENDPOINT` | OSS Endpoint (如 `https://oss-cn-shenzhen.aliyuncs.com`) |
| `OSS_BUCKET` | OSS Bucket 名称 |
| `OSS_ACCESS_KEY` | 阿里云 AccessKey ID |
| `OSS_SECRET_KEY` | 阿里云 AccessKey Secret |

---

## 七、监控和运维

### 7.1 健康检查端点

| 端点 | 用途 |
|------|------|
| `GET /health` | 存活探针 (Liveness) |
| `GET /healthz` | 平台兼容性别名探针 |
| `GET /readyz` | 就绪探针 (Readiness) |

### 7.2 日志查看

```bash
# 生产环境查看 API 服务日志
docker logs mc-api-server -f --tail=100

# 查看 Event Bus Consumer 日志
docker logs mc-event-bus-consumer -f --tail=100

# 查看 RQ Worker 日志
docker logs mc-rq-worker -f --tail=100
```

### 7.3 数据库备份

```bash
# 手动备份
bash deploy/aliyun/scripts/backup.sh

# 备份文件存储位置 (默认 OSS)
# mc-backups/db/mission_control_YYYYMMDD_HHMMSS.sql.gz
```

### 7.4 Redis 状态监控

```bash
# 检查各 DB 使用情况
redis-cli -h $REDIS_HOST info keyspace

# 查看 WS Pub/Sub 订阅数 (DB1)
redis-cli -h $REDIS_HOST -n 1 pubsub channels '*'

# 查看 RQ 任务队列状态
redis-cli -h $REDIS_HOST -n 0 llen rq:queue:default
```

### 7.5 滚动更新 (零停机)

```bash
# 构建新镜像
export TAG=$(git rev-parse --short HEAD)
docker build -f Dockerfile.backend.prod -t $ACR_REGISTRY/mc-backend:$TAG .
docker push $ACR_REGISTRY/mc-backend:$TAG

# 滚动更新 (逐个替换实例)
docker service update --image $ACR_REGISTRY/mc-backend:$TAG mc_api-server
```

---

## 八、常见问题排查

### 8.1 数据库连接失败

**症状**: 启动时报 `could not connect to server`

**检查步骤**:
1. 确认 PostgreSQL 服务正在运行: `docker compose ps db`
2. 确认 `DATABASE_URL` 格式正确: `postgresql+psycopg://user:pass@host:5432/dbname`
3. 检查防火墙/安全组是否允许 5432 端口
4. 确认数据库用户权限: `psql $DATABASE_URL -c "\l"`

### 8.2 WebSocket 连接被断开

**症状**: H5 聊天或看板实时同步频繁断连

**检查步骤**:
1. 确认 SLB 连接超时设置 ≥ 300 秒
2. 确认 SLB 已开启 WebSocket 升级支持
3. 确认 Nginx 配置了 `proxy_read_timeout 300s` 和 `proxy_http_version 1.1`
4. 检查 Redis DB1/DB3 连接是否正常: `redis-cli -n 1 ping`

### 8.3 pgvector 扩展未安装

**症状**: 知识库语义搜索报 `type "vector" does not exist`

**修复**:
```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
uv run alembic upgrade head
```

> 注意: RDS 阿里云版需要在 RDS 控制台先启用 pgvector 插件。

### 8.4 SSE 连接无法保持

**症状**: AI 建议推送 (`/api/v1/suggestions/stream`) 立即断开

**检查步骤**:
1. 确认请求头包含 `Accept: text/event-stream`
2. 确认 Nginx 禁用了响应缓冲: `proxy_buffering off`
3. 检查是否有中间代理层限制了响应流

### 8.5 迁移冲突

**症状**: `alembic upgrade head` 报 `Multiple head revisions present`

**修复**:
```bash
# 查看所有分支头
uv run alembic heads

# 合并迁移分支
uv run alembic merge heads -m "merge_all_heads"
uv run alembic upgrade head
```

### 8.6 前端 API 客户端过时

**症状**: 前端调用新 API 端点报 404 或类型错误

**修复**:
```bash
# 确保后端运行在 localhost:8000
make api-gen
```

---

*如需更多帮助，请查阅 [docs/README.md](./README.md) 或提交 [GitHub Issue](https://github.com/SOTENGROUP/SOTENoffice/issues)。*
