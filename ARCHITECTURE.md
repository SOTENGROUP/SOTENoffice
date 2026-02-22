# OpenClaw AI Task Control Center - Architecture Plan

> **Version**: 3.0 | **Date**: 2026-02-22
> **Purpose**: Unified architecture plan — AI Task Control Center with 13 development modules
> **Vision**: Transform AI from passive tool to active partner through real-time collaboration,
> proactive intelligence, workflow automation, and knowledge management

---

## 1. Real-Time Technology Analysis

Three options were evaluated for the real-time sync layer.

### Option A: PostgreSQL + WebSocket + Redis Pub/Sub (RECOMMENDED)

**How**: FastAPI WebSocket endpoints + Redis pub/sub for cross-instance message routing.

**Scale**: Proven pattern used by Discord, Slack, and GitHub. Redis handles millions of pub/sub
messages per second. SLB source-IP sticky sessions keep WebSocket connections to one instance.

**Pros**:
- Zero migration cost — leverages existing PostgreSQL + Redis stack
- Well-understood failure modes and operational tooling
- Full control over protocol and message schema

**Cons**:
- Manual conflict resolution required for concurrent edits on the same resource
- More custom code compared to managed real-time platforms

**Scale ceiling**: ~50K concurrent WebSocket connections per ECS instance, horizontal scaling via
Redis pub/sub. Add instances behind SLB as needed.

**Key design decision**: Implement a `RealtimeBroadcaster` interface abstraction so the backing
pub/sub transport can be swapped later without changing business logic.

### Option B: Convex as Real-Time Layer (Dual-Write)

**How**: Keep PostgreSQL for core data, add Convex as a real-time state layer.

**Scale**: Convex handles real-time natively with ACID transactions and reactive queries.

**Pros**: Best real-time UX — automatic UI updates, optimistic mutations, offline support.

**Cons**: Dual-write complexity creates data consistency challenges. Adds vendor dependency and
extra monthly cost. Operationally harder to debug.

**When to consider**: If real-time requirements grow beyond what Redis pub/sub can address cleanly.

### Option C: Full Convex Migration

Requires rewriting all 25+ API routers, 28+ models, and gateway RPC layer. Risk is too high for
the current stage. Consider only for a future greenfield rewrite.

**Recommendation**: Start with Option A. Migration path to Convex is documented in M4.

---

## 2. System Architecture Diagram

```
                        ALIBABA CLOUD (VPC)
 +==========================================================================+
 |                                                                          |
 |   SLB (Internet-facing, HTTPS/WSS termination)                          |
 |     |                                                                    |
 |     +-- api.xxx.com ------> ECS: API Server (FastAPI) x2               |
 |     |                         Port 8000: REST  /api/v1/*               |
 |     |                         Port 8000: WS    /ws/h5/chat             |
 |     |                         Port 8000: WS    /ws/gateway/{id}/relay  |
 |     |                         Port 8000: WS    /ws/board/{id}/sync     |
 |     |                         Port 8000: SSE   /api/v1/suggestions/stream |
 |     |                              |                                     |
 |     +-- admin.xxx.com ----> ECS: Next.js Admin Frontend x1             |
 |     |                         Port 3000 (Command Center, Calendar,      |
 |     |                          Pipelines, Knowledge Hub, Teams)         |
 |     +-- h5.xxx.com -------> ECS: H5 Mobile Web App x1 (M7)            |
 |                                                                          |
 |   ApsaraDB RDS PostgreSQL 16 (HA) + pgvector extension                 |
 |   ApsaraDB Redis 7 (Cluster):                                           |
 |     DB0: RQ job queue                                                   |
 |     DB1: WS relay pub/sub                                               |
 |     DB2: Proactivity event bus                                          |
 |     DB3: Board sync pub/sub                                             |
 |   ECS: RQ Workers x2 (webhook + pipeline + proactivity rules)          |
 |   ECS: Event Bus Consumer x1 (rule engine process)                     |
 |   ACR: Container Registry                                               |
 |                                                                          |
 +==========================================================================+
        ^                ^  (WSS persistent)           ^  (WSS persistent)
        |                |                             |
   Admin Users      Gateway-SZ-01               Gateway-BJ-01
   H5 Clients       (Shenzhen Office)           (Beijing Office)
   (Mobile Web)     Agents 1..N                 Agents 1..N
```

### H5 Chat Message Flow

```
H5 Client (browser)
    |
    | WSS connect: wss://api.xxx.com/ws/h5/chat
    | Auth: { "type": "auth", "payload": { "token": "<h5-jwt>" } }
    |
    v
API Server (WS Relay)
    |
    | Lookup: h5_user -> agent assignment -> gateway_id
    | Forward via persistent WSS to target gateway
    |
    v
Gateway (OpenClaw runtime)
    |
    | RPC: chat.send({ sessionKey, message, metadata })
    |
    v
Agent (processes and responds)
    |
    | Response flows back: Agent -> Gateway -> API Server -> H5 Client
```

### Proactivity Engine Flow

```
Existing Handler -> event_publisher.publish() -> Redis Event Bus (DB2)
     -> Rule Engine Consumer -> Evaluate Rules against agent_events
     -> Create AgentSuggestion (PostgreSQL) -> SSE Stream -> Frontend SuggestionBell
     -> User Accept/Dismiss -> Execute Action or Log Resolution
```

---

## 3. Module Breakdown

| Priority | Module | Name | Depends On | Complexity | Est. Time |
|----------|--------|------|------------|------------|-----------|
| Tier 1 | M1 | Cloud Infrastructure & Deployment | None | Medium | 1 week |
| Tier 1 | M3 | H5 User Authentication System | None | Medium | 1 week |
| Tier 1 | M8 | AI Proactivity Engine | None | High | 1.5 weeks |
| Tier 1 | M2 | Gateway Auto-Registration | M1 | High | 1.5 weeks |
| Tier 2 | M4 | WebSocket Relay Service | M2, M3 | Very High | 2 weeks |
| Tier 2 | M9 | Enhanced TaskBoard + Real-time Sync | M4, M8 | Medium-High | 1 week |
| Tier 3 | M12 | Digital Memory Hub (Hybrid Search) | M8 | High | 1.5 weeks |
| Tier 3 | M10 | General Workflow Engine | M8, M9 | High | 2 weeks |
| Tier 3 | M11 | Shared Calendar System | M8 | Medium | 1 week |
| Tier 4 | M13 | Team Architecture + Command Center | M2, M8 | High | 2 weeks |
| Tier 4 | M5 | H5 Chat UI (Integrated) | M3, M4 | Medium-High | 1.5 weeks |
| Tier 4 | M6 | Admin Gateway & H5 Management | M2, M3, M13 | Medium | 1 week |
| Tier 4 | M7 | Independent H5 Mobile App | M5 | Medium | 1 week |

### Dependency Graph

```
M1 (Infrastructure) --------+
                              |
M3 (H5 Auth) ---------------+----> M4 (WS Relay) ----> M5 (H5 Chat) ----> M7 (H5 App)
                              |         ^
M2 (Gateway AutoReg) -------+         |
                                        |
M8 (Proactivity) ----> M9 (Realtime Board)
       |                     |
       |                     +----> M10 (Workflow Engine)
       +----> M11 (Calendar)
       +----> M12 (Knowledge Hub)
       +----> M13 (Teams + Command Center) ----> M6 (Admin Extensions)
```

---

## 4. Development Phases (11 Weeks)

| Phase | Week | Sessions | Modules | Milestone |
|-------|------|----------|---------|-----------|
| 1 | 1 | A+B+C (parallel) | M1 + M3 + M8-core | Cloud deploy + H5 auth + Event bus |
| 2 | 2 | D+E (parallel) | M2 + M8-integration | Gateway auto-reg + Events wired |
| 3 | 3 | F (focused) | M4 | WebSocket relay E2E working |
| 4 | 4 | G+H (parallel) | M9 + M12 | Real-time board + Knowledge hub |
| 5 | 5 | I+J (parallel) | M10 + M11 | Workflow engine + Calendar |
| 6 | 6 | K+L (parallel) | M13 + M5 | Teams/Command center + H5 Chat |
| 7 | 7 | M+N (parallel) | M6 + M7 | Admin extensions + H5 app |
| 8 | 8-9 | O+P | Integration testing | Full flow testing across all modules |
| 9 | 10-11 | Q | Production hardening | Security audit, load testing, cutover |

---

## 5. Module Details

---

### M1: Cloud Infrastructure & Deployment

**Directory**: `deploy/aliyun/`

**Scope**: Alibaba Cloud deployment configuration, production Docker images, CI/CD pipeline.
Includes pgvector extension setup and Event Bus Consumer service.

**Files to create**:
```
deploy/
  aliyun/
    docker-compose.prod.yml      # Production compose (API x2, Frontend, Workers, Event Bus)
    nginx/
      api.conf                   # Reverse proxy for API + WebSocket + SSE
      admin.conf                 # Frontend proxy
      h5.conf                    # H5 app proxy (M7)
    scripts/
      deploy.sh                  # Deployment automation script
      init-rds.sh                # Initial RDS setup + pgvector extension
      backup.sh                  # Database backup script
    env/
      .env.production.example    # Production env template (all vars)
    README.md                    # Deployment guide
  Dockerfile.backend.prod        # Optimized multi-stage backend image
  Dockerfile.frontend.prod       # Optimized frontend image
.github/
  workflows/
    deploy-aliyun.yml            # CI/CD deploy pipeline
```

**Alibaba Cloud Resources**:

| Service | Spec | Purpose |
|---------|------|---------|
| ECS x2 | 4C8G Ubuntu 22.04 | API Server (load balanced) |
| ECS x1 | 2C4G | Next.js Admin Frontend |
| ECS x2 | 2C4G | RQ Workers (webhooks + pipelines) |
| ECS x1 | 2C4G | Event Bus Consumer (rule engine) |
| RDS PostgreSQL 16 | 2C4G 100GB HA | Primary database + pgvector |
| Redis 7 | 4GB Cluster | Cache + Pub/Sub + Queue (4 DBs) |
| SLB | Internet-facing | HTTPS/WSS load balancing |
| ACR | Standard | Docker image registry |
| OSS | Standard | Knowledge document file storage |
| SSL Certificate | Free DV via ACM | HTTPS/WSS termination |

**Production Docker Compose** (`docker-compose.prod.yml`):
```yaml
services:
  api-server:
    image: ${ACR_REGISTRY}/mc-backend:${TAG}
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
    environment:
      DATABASE_URL: postgresql+psycopg://${RDS_USER}:${RDS_PASS}@${RDS_HOST}/${RDS_DB}
      RQ_REDIS_URL: redis://${REDIS_HOST}:6379/0
      WS_REDIS_PUBSUB_URL: redis://${REDIS_HOST}:6379/1
      PROACTIVITY_REDIS_URL: redis://${REDIS_HOST}:6379/2
      BOARD_SYNC_REDIS_URL: redis://${REDIS_HOST}:6379/3
      CORS_ORIGINS: https://admin.xxx.com,https://h5.xxx.com
    deploy:
      replicas: 2

  event-bus-consumer:
    image: ${ACR_REGISTRY}/mc-backend:${TAG}
    command: python -m app.services.proactivity.rule_engine
    environment:
      DATABASE_URL: postgresql+psycopg://${RDS_USER}:${RDS_PASS}@${RDS_HOST}/${RDS_DB}
      PROACTIVITY_REDIS_URL: redis://${REDIS_HOST}:6379/2
    deploy:
      replicas: 1

  rq-worker:
    image: ${ACR_REGISTRY}/mc-backend:${TAG}
    command: python -m app.services.queue_worker
    deploy:
      replicas: 2

  frontend:
    image: ${ACR_REGISTRY}/mc-frontend:${TAG}
    environment:
      NEXT_PUBLIC_API_URL: https://api.xxx.com
```

**SLB Configuration** (WebSocket + SSE support):
- Connection timeout: 300 seconds (required for long-lived WS + SSE connections)
- WebSocket upgrade: enabled
- Health check: `GET /healthz` every 10s, threshold 2 consecutive failures
- Session persistence: source IP (for WebSocket stickiness across replicas)

**pgvector Setup** (`init-rds.sh`):
```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

**Claude Session A Instructions**:
> Create all files under `deploy/aliyun/`, production Dockerfiles, and CI/CD workflow.
> Update `init-rds.sh` to install the `vector` extension before running Alembic migrations.
> Add the `event-bus-consumer` service to docker-compose alongside existing services.
> Test by deploying to a single ECS instance, verify `/healthz`, then enable multi-instance.
> Ensure SLB correctly upgrades both WebSocket (`Upgrade: websocket`) and SSE (`text/event-stream`) connections.

---

### M2: Gateway Auto-Registration Protocol

**Directory**: Backend extensions

**Scope**: Allow gateways to self-register on startup, maintain persistent WebSocket relay
connections, and report health metrics automatically.

**Files to create/modify**:
```
backend/app/
  api/
    gateway_registration.py      # NEW: Registration REST endpoints
  models/
    gateway_connections.py       # NEW: WS connection tracking model
  schemas/
    gateway_registration.py      # NEW: Registration schemas
  services/
    gateway_registry.py          # NEW: Registration + health logic
    gateway_ws_manager.py        # NEW: Persistent WS connection pool
  core/
    config.py                    # MODIFY: Add gateway registration settings
backend/migrations/versions/
  xxxx_add_gateway_registration_fields.py  # NEW: Alembic migration
```

**Gateway Model Extensions** (migration SQL):
```sql
-- 扩展 gateways 表以支持自动注册和健康监控
ALTER TABLE gateways ADD COLUMN registration_token_hash VARCHAR(255);
ALTER TABLE gateways ADD COLUMN status VARCHAR(32) DEFAULT 'pending';
  -- 状态值: pending, online, offline, error
ALTER TABLE gateways ADD COLUMN last_heartbeat_at TIMESTAMP;
ALTER TABLE gateways ADD COLUMN connection_info JSONB;
  -- { "ip": "...", "version": "...", "capabilities": [...], "metrics": {...} }
ALTER TABLE gateways ADD COLUMN auto_registered BOOLEAN DEFAULT FALSE;
CREATE INDEX ix_gateways_status ON gateways(status);
```

**REST API Endpoints**:
```
POST   /api/v1/gateway-registry/register
  Body: { organization_id, registration_token, name, url, workspace_root, version, capabilities }
  Response: { gateway_id, relay_ws_url, relay_token, heartbeat_interval_seconds }

POST   /api/v1/gateway-registry/heartbeat
  Body: { gateway_id, relay_token, status, metrics: { active_sessions, memory_mb, cpu_pct, agent_count } }
  Response: { ok, config_update? }

DELETE /api/v1/gateway-registry/deregister
  Body: { gateway_id, relay_token }
  Response: { ok }
```

**WebSocket Relay Endpoint**:
```
WS /ws/gateway/{gateway_id}/relay
  Auth handshake: { "type": "auth", "payload": { "relay_token": "..." } }
  Response: { "type": "auth_ok", "payload": { "gateway_id": "...", "config": {...} } }
  Bidirectional message forwarding after auth
```

**Gateway Config File** (`gateway-config.yaml`):
```yaml
mission_control:
  api_server: "https://api.xxx.com"
  organization_id: "550e8400-e29b-41d4-a716-446655440000"
  registration_token: "gw_reg_abc123..."

gateway:
  name: "office-gateway-shenzhen-01"
  workspace_root: "/opt/openclaw/workspace"
  reconnect_max_retries: -1          # -1 = unlimited retries
  reconnect_base_interval_seconds: 1
  reconnect_max_interval_seconds: 10
  heartbeat_interval_seconds: 30
```

**Health Monitoring Logic**:
- Gateway sends heartbeat every 30s (HTTP POST)
- If no heartbeat received for 90s (3 missed cycles), mark `status='offline'`
- On WS reconnect, mark `status='online'` and refresh `connection_info`
- Admin UI shows real-time status via polling `GET /api/v1/gateways`

**Claude Session D Instructions**:
> Extend the Gateway model with new fields and create the Alembic migration.
> Implement the registration endpoints following the pattern in `backend/app/api/gateways.py`.
> Build the WS manager using the `websockets` library, similar to `gateway_rpc.py`.
> Test with a mock gateway client script that registers, sends heartbeats, and deregisters.

---

### M3: H5 User Authentication System

**Directory**: Backend + new tables

**Scope**: Independent authentication system for H5 end users. Covers registration, login,
JWT lifecycle management, and admin-side agent assignment.

**Files to create/modify**:
```
backend/app/
  models/
    h5_users.py                  # NEW: H5User, H5RefreshToken models
  schemas/
    h5_auth.py                   # NEW: Register, Login, Token schemas
    h5_users.py                  # NEW: H5 user CRUD schemas
  core/
    h5_auth.py                   # NEW: JWT creation/validation, password hashing
  api/
    h5_auth.py                   # NEW: Auth router (register, login, refresh, me)
    h5_users.py                  # NEW: Admin router (list, assign, unassign)
  services/
    h5_user_service.py           # NEW: H5 user business logic
  api/deps.py                    # MODIFY: Add H5 auth dependency functions
  main.py                        # MODIFY: Register new routers
backend/migrations/versions/
  xxxx_add_h5_users.py           # NEW: Alembic migration
```

**Database Tables**:
```sql
-- H5 终端用户表
CREATE TABLE h5_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    username        VARCHAR(64) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(32),
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(128),
    avatar_url      VARCHAR(512),
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    last_login_at   TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (organization_id, username)
);

-- Refresh Token 存储表 (token 以哈希形式保存)
CREATE TABLE h5_refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    h5_user_id  UUID NOT NULL REFERENCES h5_users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- H5 用户与 Agent 分配关系表
CREATE TABLE h5_user_agent_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    h5_user_id  UUID NOT NULL REFERENCES h5_users(id) ON DELETE CASCADE,
    agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    role        VARCHAR(32) NOT NULL DEFAULT 'user',
    assigned_at TIMESTAMP NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE (h5_user_id, agent_id)
);
```

**REST API Endpoints**:
```
POST   /api/v1/h5/auth/register
  Body: { organization_id, username, password, display_name?, email?, phone? }
  Response: { user: H5User, access_token, refresh_token }

POST   /api/v1/h5/auth/login
  Body: { organization_id, username, password }
  Response: { user: H5User, access_token, refresh_token }

POST   /api/v1/h5/auth/refresh
  Body: { refresh_token }
  Response: { access_token, refresh_token }

GET    /api/v1/h5/auth/me          # Current H5 user profile
  Response: { user: H5User, assignments: [...] }

PATCH  /api/v1/h5/auth/me          # Update display_name, avatar_url
  Body: { display_name?, avatar_url? }

-- Admin endpoints (require admin JWT):
GET    /api/v1/h5/users            # List H5 users with pagination
POST   /api/v1/h5/users/{id}/assign    # Assign user to agent
  Body: { agent_id, board_id, role? }
DELETE /api/v1/h5/users/{id}/assign/{agent_id}  # Unassign
```

**JWT Configuration**:
- Access token: 15 min TTL, HS256 signed with `H5_JWT_SECRET`
- Refresh token: 30 day TTL, stored as bcrypt hash in `h5_refresh_tokens`
- Payload: `{ sub: h5_user_id, org: organization_id, type: "h5", iat, exp }`
- Separate secret from admin JWT — never share `H5_JWT_SECRET` with `JWT_SECRET`

**Dependency Injection** (add to `deps.py`):
```python
class H5AuthContext:
    h5_user: H5User
    organization_id: UUID

async def get_h5_auth_context(request: Request, db: AsyncSession) -> H5AuthContext:
    """Extract and validate H5 JWT from Authorization header."""

async def require_h5_auth(ctx: H5AuthContext = Depends(get_h5_auth_context)) -> H5AuthContext:
    """Require authenticated H5 user. Raises 401 if missing/invalid."""
```

**Claude Session B Instructions**:
> Follow the pattern in `backend/app/core/auth.py` for the H5 auth module.
> Use `bcrypt` for password hashing via `passlib` (already in dependencies).
> Use `PyJWT` for token creation and validation.
> Create the Alembic migration. Write pytest integration tests for all endpoints.
> Ensure the H5 JWT secret is loaded from `H5_JWT_SECRET` env var only.

---

### M4: WebSocket Relay Service

**Directory**: `backend/app/services/ws_relay/`

**Scope**: Core relay layer connecting H5 clients to agents through gateways via WebSocket.
Also exposes the board sync WebSocket endpoint used by M9.

**Files to create/modify**:
```
backend/app/
  services/
    ws_relay/
      __init__.py
      connection_manager.py      # H5 client WS connection registry
      gateway_pool.py            # Persistent gateway WS connection pool
      message_router.py          # Route messages between clients and gateways
      protocol.py                # Message format, heartbeat, auth handshake
      redis_bridge.py            # Redis pub/sub for multi-instance routing
  api/
    ws_h5.py                     # NEW: FastAPI WS endpoint for H5 clients
    ws_gateway.py                # NEW: FastAPI WS endpoint for gateway relay
    ws_board.py                  # NEW: FastAPI WS endpoint for board sync (M9)
  models/
    ws_sessions.py               # NEW: Chat session tracking model
  schemas/
    ws_messages.py               # NEW: WS message envelope schemas
  main.py                        # MODIFY: Register WS endpoints
backend/migrations/versions/
  xxxx_add_ws_sessions.py        # NEW: Alembic migration
```

**WS Message Protocol** (JSON over WebSocket):
```json
// Auth handshake (first message after connect)
{ "type": "auth", "payload": { "token": "<jwt>" } }
{ "type": "auth_ok", "payload": { "user_id": "...", "assignments": [...] } }
{ "type": "auth_error", "payload": { "reason": "invalid_token" } }

// Chat message (H5 client -> server)
{
  "type": "chat",
  "id": "<uuid>",
  "payload": {
    "agent_id": "<uuid>",
    "content": "Hello!",
    "session_id": "<uuid>"
  }
}

// Chat response (server -> H5 client)
{
  "type": "chat",
  "id": "<uuid>",
  "payload": {
    "agent_id": "<uuid>",
    "content": "Hi! How can I help?",
    "session_id": "<uuid>",
    "role": "agent"
  }
}

// System messages
{ "type": "heartbeat", "id": "<uuid>" }
{ "type": "system", "payload": { "event": "agent_offline", "agent_id": "..." } }
{ "type": "error", "payload": { "code": "AGENT_UNAVAILABLE", "message": "..." } }
```

**Connection Manager** (`connection_manager.py`):
```python
class H5ConnectionManager:
    """Manages active H5 client WebSocket connections in-process."""

    # In-memory: { h5_user_id -> WebSocket }
    # Redis: { h5_user_id -> server_instance_id } for multi-instance routing

    async def connect(self, user_id: UUID, websocket: WebSocket) -> None
    async def disconnect(self, user_id: UUID) -> None
    async def send_to_user(self, user_id: UUID, message: dict) -> bool
    async def broadcast_to_users(self, user_ids: list[UUID], message: dict) -> None
```

**Gateway Pool** (`gateway_pool.py`):
```python
class GatewayPool:
    """Manages persistent WebSocket connections to gateways."""

    # { gateway_id -> WebSocket }

    async def register_gateway(self, gateway_id: UUID, websocket: WebSocket) -> None
    async def unregister_gateway(self, gateway_id: UUID) -> None
    async def send_to_gateway(self, gateway_id: UUID, message: dict) -> dict
    async def is_gateway_connected(self, gateway_id: UUID) -> bool
```

**Message Router** (`message_router.py`):
```python
class MessageRouter:
    """Routes messages between H5 clients and gateways."""

    async def route_h5_to_agent(
        self, h5_user_id: UUID, agent_id: UUID, content: str, session_id: UUID | None
    ) -> None:
        # 1. Validate assignment (h5_user_agent_assignments)
        # 2. Resolve agent -> gateway_id (agents table, cached in Redis)
        # 3. Get/create chat session (h5_chat_sessions)
        # 4. Translate to gateway RPC: chat.send(sessionKey, message, metadata)
        # 5. Forward to gateway via GatewayPool

    async def route_gateway_to_h5(
        self, gateway_id: UUID, session_key: str, content: str
    ) -> None:
        # 1. Resolve session_key -> h5_chat_session -> h5_user_id
        # 2. Forward to H5 client via ConnectionManager (or Redis pub/sub if cross-instance)
```

**Redis Pub/Sub Bridge** (`redis_bridge.py`):
```python
class RedisBridge:
    """Cross-instance message routing via Redis pub/sub (DB1)."""

    # Channel pattern: ws:route:{target_type}:{target_id}
    # e.g., ws:route:h5:user-uuid, ws:route:gateway:gw-uuid

    async def publish(self, channel: str, message: dict) -> None
    async def subscribe(self, channel: str, callback: Callable) -> None
```

**Database Table** (`h5_chat_sessions`):
```sql
-- H5 聊天会话表 (跟踪活跃的用户-Agent 会话)
CREATE TABLE h5_chat_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    h5_user_id      UUID NOT NULL REFERENCES h5_users(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id),
    gateway_id      UUID NOT NULL REFERENCES gateways(id),
    session_key     VARCHAR(255) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    last_message_at TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_h5_chat_sessions_user ON h5_chat_sessions(h5_user_id, status);
```

**Scaling Strategy**:
- SLB uses source-IP session persistence for WebSocket stickiness
- Redis DB1 pub/sub handles cross-instance message routing for H5 relay
- Redis DB3 pub/sub handles cross-instance routing for board sync (M9)
- Connection state in memory (fast lookup) + Redis keys (cross-instance awareness)

**Claude Session F Instructions**:
> Build incrementally in this order:
> 1. H5 WS endpoint with auth handshake and echo test
> 2. Gateway WS endpoint with auth and connection pool
> 3. Message router (H5 -> gateway forwarding, reference `gateway_rpc.py`)
> 4. Response routing (gateway -> H5 client)
> 5. Redis pub/sub bridge for multi-instance delivery
> 6. Board sync WS stub (full implementation in M9)
> Reference `backend/app/services/openclaw/gateway_rpc.py` for gateway RPC protocol details.

---

### M5: H5 Chat UI (Integrated in Next.js)

**Directory**: `frontend/src/app/h5/`, `frontend/src/components/h5/`

**Scope**: H5 chat interface integrated into the existing Next.js admin frontend. Mobile-first
responsive layout with real WebSocket connection to M4 relay.

**Files to create**:
```
frontend/src/
  app/
    h5/
      layout.tsx                 # H5 layout (mobile-first, no admin sidebar)
      login/
        page.tsx                 # H5 login page
      chat/
        page.tsx                 # Chat session list
        [sessionId]/
          page.tsx               # Specific conversation view
  components/
    h5/
      ChatWindow.tsx             # Main chat container with message list
      ChatBubble.tsx             # Individual message bubble (user/agent)
      ChatInput.tsx              # Text input + send button
      SessionList.tsx            # Session list sidebar
      H5Header.tsx               # Mobile header with back button
  lib/
    ws-client.ts                 # WebSocket client with auto-reconnect
    h5-auth.ts                   # H5 auth token management (localStorage)
  hooks/
    useWebSocket.ts              # React hook for WS connection lifecycle
    useH5Auth.ts                 # React hook for H5 auth state
  locales/
    en.json                      # MODIFY: Add h5.* keys
    zh-CN.json                   # MODIFY: Add h5.* Chinese translations
```

**WebSocket Client** (`ws-client.ts`):
```typescript
class WSClient {
  private ws: WebSocket | null
  private reconnectTimer: number
  private messageHandlers: Map<string, Function>

  connect(url: string, token: string): void
  disconnect(): void
  send(type: string, payload: object): void
  onMessage(type: string, handler: Function): void

  // Auto-reconnect: exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
  // Heartbeat: client-side ping every 30s
}
```

**Chat UI Design**:
- Mobile-first responsive layout — no admin sidebar
- Full-screen chat on mobile, split-panel on desktop (session list + chat window)
- Message bubbles with user/agent avatars and timestamps
- Typing indicator (three-dot animation)
- Connection status banner (connected / reconnecting / offline)

**Claude Session K/L Instructions**:
> Phase 1 (Session K, Week 6): Scaffold H5 pages, login flow, chat UI with mock WebSocket data.
> Phase 2 (Session L, Week 6): Connect real WebSocket to M4 relay service.
> Follow existing i18n pattern: use `useTranslation()` with keys under `h5.*` namespace.
> Follow component patterns in `frontend/src/components/organisms/`.

---

### M6: Admin Gateway & H5 User Management

**Directory**: Frontend extensions

**Scope**: Admin UI for managing gateways (health, live connections), H5 users, agent
assignments, and links to team management from M13.

**Files to create/modify**:
```
frontend/src/
  app/
    gateways/
      [gatewayId]/
        connections/
          page.tsx               # NEW: Live connections view
    h5-users/
      page.tsx                   # NEW: H5 user management list
      [userId]/
        page.tsx                 # NEW: H5 user detail + agent assignments
  components/
    gateways/
      GatewayHealthBadge.tsx     # NEW: Online/offline/error status badge
      GatewayConnectionsPanel.tsx # NEW: Live WS connections table
      GatewayMetricsCard.tsx     # NEW: CPU/memory/sessions metrics
    h5-users/
      H5UserTable.tsx            # NEW: User listing with DataTable
      AgentAssignmentDialog.tsx  # NEW: Assign H5 user to agent dialog
  locales/
    en.json                      # MODIFY: Add h5Users.*, gatewayHealth.* keys
    zh-CN.json                   # MODIFY: Add Chinese translations
```

**Admin API Endpoints to consume**:
```
GET    /api/v1/h5/users                      # List H5 users (paginated)
GET    /api/v1/h5/users/{id}                 # H5 user detail + assignments
POST   /api/v1/h5/users/{id}/assign          # Assign to agent
DELETE /api/v1/h5/users/{id}/assign/{aid}    # Unassign from agent
GET    /api/v1/gateways/{id}/connections     # Gateway live connections
GET    /api/v1/gateways/{id}/metrics         # Gateway health metrics
GET    /api/v1/agent-teams                   # Team list (from M13)
```

**Claude Session M Instructions**:
> Follow existing page patterns (e.g., `agents/page.tsx`, `tags/page.tsx`).
> Use `DashboardPageLayout`, `DataTable`, and existing UI component library.
> All strings must use `useTranslation()` with both `en.json` and `zh-CN.json`.
> Add team management navigation links that route to M13 pages.

---

### M7: Independent H5 Mobile Web App

**Directory**: `h5-app/` (new top-level directory)

**Scope**: Extract H5 chat into a standalone lightweight mobile web app using Vite + React,
optimized for mobile devices with PWA support.

**Files to create**:
```
h5-app/
  package.json                   # Minimal deps: React, TailwindCSS, React Router
  vite.config.ts                 # Vite for fast builds + PWA plugin
  tsconfig.json
  Dockerfile
  src/
    main.tsx
    App.tsx
    pages/
      Login.tsx
      Chat.tsx
      Sessions.tsx
    components/
      ChatWindow.tsx             # Extracted from M5
      ChatBubble.tsx
      ChatInput.tsx
    lib/
      ws-client.ts               # Copied from M5
      h5-auth.ts                 # Copied from M5
      i18n.ts                    # Simplified i18n (no next-intl)
    locales/
      en.json
      zh-CN.json
    hooks/
      useWebSocket.ts
      useH5Auth.ts
compose.yml                      # MODIFY: Add h5-app service
```

**Tech Stack**:
- React 19 + Vite (lightweight alternative to Next.js)
- TailwindCSS (reuse existing design tokens from admin frontend)
- Target bundle size: < 200KB gzipped
- PWA manifest for mobile home screen installation
- React Router for client-side navigation

**Claude Session N Instructions**:
> Extract working code from M5 (Next.js integrated version).
> Replace Next.js-specific code (`next/router`, `Link`) with React Router equivalents.
> Optimize for mobile: viewport meta, touch events, iOS safe area insets.
> Add `vite-plugin-pwa` with a web app manifest for home screen installation.
> Target Lighthouse mobile score >= 90.

---

### M8: AI Proactivity Engine

**Directory**: `backend/app/services/proactivity/`

**Scope**: Event-driven rule engine that monitors system activity and proactively surfaces
AI-generated suggestions to admin users via SSE. Includes builtin rules, custom rule management,
and suggestion lifecycle (pending -> accepted/dismissed).

**Files to create**:
```
backend/app/
  models/
    agent_suggestions.py         # AgentSuggestion ORM model
    proactive_rules.py           # ProactiveRule ORM model
    agent_events.py              # AgentEvent ORM model
  schemas/
    agent_suggestions.py         # Pydantic schemas
    proactive_rules.py
    agent_events.py
  api/
    agent_suggestions.py         # REST + SSE endpoints
    proactive_rules.py           # Rule CRUD endpoints
  services/
    proactivity/
      __init__.py
      event_bus.py               # Redis pub/sub abstraction (DB2)
      event_publisher.py         # Publish events from existing handlers
      rule_engine.py             # Consumer process: evaluate rules -> create suggestions
      suggestion_service.py      # Suggestion CRUD business logic
      builtin_rules.py           # Builtin rule definitions
backend/migrations/versions/
  xxxx_add_proactivity_tables.py # Alembic migration
```

**Database Tables**:
```sql
-- AI 建议表 (由规则引擎或 Agent 直接创建)
CREATE TABLE agent_suggestions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    board_id            UUID REFERENCES boards(id),
    agent_id            UUID REFERENCES agents(id),
    suggestion_type     VARCHAR(64) NOT NULL,
    -- 建议类型: deadline_alert, quality_concern, workload_rebalance, task_reassign,
    --           task_create, blocked_task, idle_agent
    title               VARCHAR(512) NOT NULL,
    description         TEXT,
    confidence          FLOAT NOT NULL DEFAULT 0.5,  -- 0.0 to 1.0
    priority            VARCHAR(32) NOT NULL DEFAULT 'medium',
    -- priority 值: low, medium, high, critical
    status              VARCHAR(32) NOT NULL DEFAULT 'pending',
    -- status 值: pending, accepted, dismissed, expired, executed
    payload             JSONB,           -- 执行动作所需的具体参数
    source_event_id     UUID REFERENCES agent_events(id),
    resolved_by_user_id UUID REFERENCES users(id),
    resolved_at         TIMESTAMP,
    expires_at          TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_agent_suggestions_org_status ON agent_suggestions(organization_id, status);
CREATE INDEX ix_agent_suggestions_board ON agent_suggestions(board_id);

-- 主动规则配置表 (内置规则 + 用户自定义规则)
CREATE TABLE proactive_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    board_id          UUID REFERENCES boards(id),  -- NULL 表示适用所有看板
    name              VARCHAR(256) NOT NULL,
    description       TEXT,
    trigger_event     VARCHAR(128) NOT NULL,
    -- 触发事件: task.status_changed, agent.heartbeat, cron.hourly, cron.daily, etc.
    conditions        JSONB NOT NULL DEFAULT '{}',
    action_type       VARCHAR(64) NOT NULL,
    -- 动作类型: create_suggestion, send_notification, auto_assign
    action_config     JSONB NOT NULL DEFAULT '{}',
    is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    is_builtin        BOOLEAN NOT NULL DEFAULT FALSE,
    cooldown_seconds  INTEGER NOT NULL DEFAULT 3600,  -- 同一规则最小触发间隔
    last_fired_at     TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_proactive_rules_org ON proactive_rules(organization_id, is_enabled);

-- 系统事件日志表 (规则引擎的输入源)
CREATE TABLE agent_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    board_id        UUID REFERENCES boards(id),
    agent_id        UUID REFERENCES agents(id),
    task_id         UUID REFERENCES tasks(id),
    event_type      VARCHAR(128) NOT NULL,
    -- 事件类型: task.created, task.status_changed, task.completed, agent.heartbeat,
    --           agent.task_started, approval.resolved, coordination.action_taken
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_agent_events_org_type ON agent_events(organization_id, event_type);
CREATE INDEX ix_agent_events_created ON agent_events(created_at);
```

**REST API Endpoints**:
```
-- Suggestion endpoints (admin-facing)
GET    /api/v1/suggestions
  Query: status, board_id, priority, limit, offset
  Response: { items: AgentSuggestion[], total: int }

GET    /api/v1/suggestions/{id}
  Response: AgentSuggestion

POST   /api/v1/suggestions/{id}/accept
  Body: {}
  Response: { ok, action_result? }

POST   /api/v1/suggestions/{id}/dismiss
  Body: { reason? }
  Response: { ok }

GET    /api/v1/suggestions/stream            # SSE endpoint
  Headers: Accept: text/event-stream
  Events: data: { type: "suggestion.new", suggestion: AgentSuggestion }

-- Proactive rule endpoints (admin configuration)
GET    /api/v1/proactive-rules
  Response: { items: ProactiveRule[], total: int }

POST   /api/v1/proactive-rules
  Body: { name, trigger_event, conditions, action_type, action_config, board_id?, cooldown_seconds }

PATCH  /api/v1/proactive-rules/{id}
  Body: { name?, conditions?, action_config?, cooldown_seconds? }

DELETE /api/v1/proactive-rules/{id}

POST   /api/v1/proactive-rules/{id}/toggle
  Response: { is_enabled: bool }

-- Agent-facing endpoints (called by agents via gateway RPC)
POST   /api/v1/agent/suggestions
  Body: { suggestion_type, title, description, confidence, priority, payload, board_id?, agent_id? }

POST   /api/v1/agent/events
  Body: { event_type, board_id?, task_id?, payload }
```

**Event Bus Design** (`event_bus.py`):
```python
# Redis DB2 channels:
# mc:events:{org_id}           - org-wide events
# mc:events:{org_id}:{board_id} - board-scoped events

@dataclass(frozen=True)
class SystemEvent:
    event_type: str
    organization_id: UUID
    board_id: UUID | None
    agent_id: UUID | None
    task_id: UUID | None
    payload: dict[str, Any]
    timestamp: datetime
    event_id: UUID

class EventBus:
    async def publish(self, event: SystemEvent) -> None
    async def subscribe(self, org_id: UUID, callback: Callable[[SystemEvent], Awaitable[None]]) -> None
```

**Event Publisher** (`event_publisher.py`):
```python
class EventPublisher:
    """Thin wrapper used by existing API handlers to emit events."""

    async def publish(
        self,
        event_type: str,
        organization_id: UUID,
        board_id: UUID | None = None,
        agent_id: UUID | None = None,
        task_id: UUID | None = None,
        payload: dict | None = None,
    ) -> None:
        # 1. Write to agent_events table (audit log)
        # 2. Publish to Redis event bus
```

**Integration Points** - add `event_publisher.publish()` calls to:
- `backend/app/api/tasks.py` — on task create, update status, delete
- `backend/app/api/approvals.py` — on approval resolve (approved/rejected)
- `backend/app/api/agent.py` — on heartbeat, task start/complete
- `backend/app/services/openclaw/coordination_service.py` — on coordination actions

**Builtin Rules**:

| Rule Name | Trigger Event | Condition | Action |
|-----------|--------------|-----------|--------|
| Overdue Task Alert | cron.daily | task.due_at < now AND status != done | create_suggestion(deadline_alert) |
| Stale Review Detection | cron.hourly | task.status == review AND age > 24h | create_suggestion(quality_concern) |
| WIP Limit Warning | task.status_changed | in_progress count > board.max_agents * 3 | create_suggestion(workload_rebalance) |
| Unblocking Opportunity | task.status_changed(done) | downstream tasks now unblocked | create_suggestion(task_reassign) |
| Idle Agent Detection | agent.heartbeat | no in_progress tasks for > 1h | create_suggestion(task_reassign) |
| Auto-create Follow-up | task.status_changed(done) | pattern matches follow-up need | create_suggestion(task_create) |

**Frontend Components**:
```
frontend/src/
  components/suggestions/
    SuggestionBell.tsx           # Header bell icon with unread count badge
    SuggestionPanel.tsx          # Slide-over panel listing all suggestions
    SuggestionCard.tsx           # Single suggestion with Accept/Dismiss actions
    SuggestionStream.tsx         # SSE connection manager (singleton)
  components/proactive-rules/
    RulesTable.tsx               # Rules list with enable/disable toggle
    RuleForm.tsx                 # Create/edit rule dialog
  app/settings/proactive-rules/
    page.tsx                     # Rule management settings page
```

**Claude Session C Instructions**:
> Start with the database migration and ORM models, then event_bus.py and event_publisher.py.
> Build the rule_engine.py as a standalone process (entry point for event-bus-consumer service).
> Wire `event_publisher.publish()` calls into `tasks.py` first to verify the flow end-to-end.
> Add SSE endpoint for suggestions using FastAPI `StreamingResponse` with `text/event-stream`.
> Build frontend SuggestionBell and SuggestionPanel last, consuming the SSE stream.
> Use `asyncio.Queue` internally in SSE handler; Redis pub/sub pushes into the queue.

---

### M9: Enhanced TaskBoard + Real-time Sync

**Directory**: Backend extensions + Frontend components

**Scope**: Upgrade the existing TaskBoard with WebSocket-based real-time sync so multiple
admin users see live updates, plus an inline AI suggestion strip.

**Files to create**:
```
backend/app/
  services/realtime/
    __init__.py
    task_broadcast.py            # Broadcast task changes to board subscribers
    board_state_sync.py          # Full board state snapshot for initial load
  api/ws_board.py                # WS /ws/board/{board_id}/sync endpoint

frontend/src/
  components/organisms/
    TaskBoardRealtime.tsx        # Upgraded TaskBoard with WS sync
  components/molecules/
    QuickTaskCreator.tsx         # Inline task creation within board columns
    AITaskSuggestionInline.tsx   # Inline suggestion strip below board header
  hooks/
    useBoardSync.ts              # Board WebSocket connection hook
  lib/
    board-sync-protocol.ts       # TypeScript types for board sync messages
```

**WebSocket Board Sync Protocol**: `WS /ws/board/{board_id}/sync`

Server -> Client messages:
```json
{ "type": "task.updated", "task_id": "...", "changes": {}, "updated_by": { "type": "user"|"agent", "id": "..." }, "timestamp": "..." }
{ "type": "task.created", "task": { ...TaskObject }, "timestamp": "..." }
{ "type": "task.deleted", "task_id": "...", "timestamp": "..." }
{ "type": "suggestion.new", "suggestion": { ...AgentSuggestion } }
{ "type": "board.state", "tasks": [...], "timestamp": "..." }   // initial full state
```

Client -> Server messages:
```json
{ "type": "task.move", "task_id": "...", "status": "in_progress" }
{ "type": "task.create", "title": "...", "status": "todo", "assignee_id": "..." }
```

**Task Broadcast** (`task_broadcast.py`):
```python
class TaskBroadcaster:
    """Broadcasts task mutations to all subscribers of a board via Redis DB3."""

    async def broadcast_task_updated(self, board_id: UUID, task_id: UUID, changes: dict, actor: dict) -> None
    async def broadcast_task_created(self, board_id: UUID, task: dict) -> None
    async def broadcast_task_deleted(self, board_id: UUID, task_id: UUID) -> None
    async def broadcast_suggestion(self, board_id: UUID, suggestion: dict) -> None
```

**Integration**: Add `TaskBroadcaster` calls to `backend/app/api/tasks.py` after successful
CRUD operations.

**Claude Session G Instructions**:
> Build `ws_board.py` WS endpoint first with auth (admin JWT required).
> Implement `task_broadcast.py` using Redis DB3 pub/sub, mirroring the pattern from M4.
> Modify `tasks.py` CRUD endpoints to call `TaskBroadcaster` after commit.
> Build `useBoardSync.ts` hook that reconnects automatically and merges server state into
> the existing React Query cache.
> `TaskBoardRealtime.tsx` should wrap the existing TaskBoard and inject the WS sync hook.

---

### M10: General Workflow Engine

**Directory**: Backend + Frontend

**Scope**: Visual pipeline builder that chains AI tasks, approvals, webhooks, and conditions
into automated multi-step workflows with run tracking.

**Files to create**:
```
backend/app/
  models/pipelines.py            # Pipeline, PipelineRun, PipelineStageTask models
  schemas/pipelines.py           # Pydantic schemas
  api/pipelines.py               # Full CRUD + run management
  services/pipeline_engine.py    # Stage execution logic
backend/migrations/versions/
  xxxx_add_pipeline_tables.py

frontend/src/
  app/pipelines/
    page.tsx                     # Pipeline list
    new/page.tsx                 # Create pipeline wizard
    [pipelineId]/page.tsx        # Pipeline detail (run history)
    [pipelineId]/edit/page.tsx   # Pipeline canvas editor
  components/pipelines/
    PipelineCanvas.tsx           # Drag-and-drop stage builder
    PipelineStageCard.tsx        # Individual stage card (type + config)
    PipelineRunTimeline.tsx      # Run progress visualization
    PipelineTemplateSelector.tsx # Predefined pipeline templates
    PipelinesTable.tsx           # Pipeline list table
```

**Database Tables**:
```sql
-- 工作流管道定义表
CREATE TABLE pipelines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    board_id        UUID REFERENCES boards(id),
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    pipeline_type   VARCHAR(64) NOT NULL DEFAULT 'general',
    -- 管道类型: general, review_flow, release_flow, onboarding
    stages          JSONB NOT NULL DEFAULT '[]',
    -- stages 结构: [{ id, name, type, config, next_stage_id, condition? }]
    -- stage type: ai_task, approval, manual, webhook, condition
    trigger_config  JSONB,
    -- { trigger_type: manual|schedule|event, cron_expr?, event_type? }
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_pipelines_org ON pipelines(organization_id);

-- 管道执行记录表
CREATE TABLE pipeline_runs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id      UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    organization_id  UUID NOT NULL REFERENCES organizations(id),
    input_data       JSONB,
    current_stage_id VARCHAR(128),
    status           VARCHAR(32) NOT NULL DEFAULT 'running',
    -- status 值: running, paused, completed, failed, cancelled
    stage_results    JSONB NOT NULL DEFAULT '{}',
    -- { stage_id: { status, output, started_at, completed_at } }
    started_at       TIMESTAMP NOT NULL DEFAULT now(),
    completed_at     TIMESTAMP,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_pipeline_runs_pipeline ON pipeline_runs(pipeline_id, status);

-- 管道阶段与任务的关联表
CREATE TABLE pipeline_stage_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    stage_id        VARCHAR(128) NOT NULL,
    task_id         UUID NOT NULL REFERENCES tasks(id),
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(pipeline_run_id, stage_id)
);
```

**REST API Endpoints**:
```
GET    /api/v1/pipelines                     # List pipelines (paginated)
POST   /api/v1/pipelines                     # Create pipeline
  Body: { name, stages, board_id?, trigger_config?, pipeline_type }

GET    /api/v1/pipelines/{id}                # Pipeline detail
PATCH  /api/v1/pipelines/{id}               # Update pipeline definition
DELETE /api/v1/pipelines/{id}

POST   /api/v1/pipelines/{id}/run            # Trigger a pipeline run
  Body: { input_data? }
  Response: { run_id, status }

GET    /api/v1/pipelines/{id}/runs           # List runs for a pipeline
GET    /api/v1/pipeline-runs/{run_id}        # Run detail + stage results
POST   /api/v1/pipeline-runs/{run_id}/cancel

GET    /api/v1/pipeline-templates            # List builtin templates
```

**Stage Types**:
- `ai_task` — create a task assigned to a specific agent, wait for completion
- `approval` — create an approval request, wait for resolution
- `manual` — pause and wait for human confirmation
- `webhook` — HTTP POST to external URL with stage output
- `condition` — evaluate JSONB condition expression, branch to next stage

**Claude Session I Instructions**:
> Start with the database migration and ORM models.
> Build `pipeline_engine.py` as an async state machine: each stage transitions the run.
> Integrate stage execution into the existing RQ worker queue for async processing.
> For `ai_task` stages, reuse the existing task creation and coordination service.
> Build the frontend `PipelineCanvas.tsx` using a simple drag-and-drop library (dnd-kit).

---

### M11: Shared Calendar System

**Directory**: Backend + Frontend

**Scope**: Organization-wide calendar showing milestones, task schedules, and agent workload.
Includes conflict detection and optimal slot suggestions.

**Files to create**:
```
backend/app/
  models/calendar_events.py      # CalendarEvent, TaskSchedule models
  schemas/calendar.py            # Pydantic schemas
  api/calendar.py                # Calendar REST endpoints
  services/calendar_service.py   # Conflict detection, workload calculation
backend/migrations/versions/
  xxxx_add_calendar_tables.py

frontend/src/
  app/calendar/
    page.tsx                     # Main calendar view
  components/calendar/
    CalendarView.tsx             # Month/week/day view switcher
    CalendarDayCell.tsx          # Day cell with event chips
    AgentWorkloadTimeline.tsx    # Horizontal timeline per agent
    MilestoneMarker.tsx          # Visual milestone indicator
    TaskScheduleDialog.tsx       # Schedule task dialog with conflict warnings
    CalendarSidebar.tsx          # Filter sidebar (agents, boards, event types)
```

**Database Tables**:
```sql
-- 日历事件表 (里程碑、会议、截止日等)
CREATE TABLE calendar_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    board_id            UUID REFERENCES boards(id),
    title               VARCHAR(512) NOT NULL,
    description         TEXT,
    event_type          VARCHAR(64) NOT NULL DEFAULT 'milestone',
    -- 事件类型: milestone, meeting, deadline, release, holiday
    starts_at           TIMESTAMP NOT NULL,
    ends_at             TIMESTAMP,
    is_all_day          BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule     VARCHAR(256),  -- RFC 5545 RRULE 格式
    metadata            JSONB,
    created_by_user_id  UUID REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_calendar_events_org_range ON calendar_events(organization_id, starts_at, ends_at);

-- 任务排期表 (将任务分配到时间段)
CREATE TABLE task_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id),
    board_id        UUID NOT NULL REFERENCES boards(id),
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end   TIMESTAMP NOT NULL,
    actual_start    TIMESTAMP,
    actual_end      TIMESTAMP,
    status          VARCHAR(32) NOT NULL DEFAULT 'planned',
    -- 状态值: planned, in_progress, completed, missed
    estimated_hours FLOAT,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT ck_schedule_range CHECK (scheduled_end > scheduled_start)
);
CREATE INDEX ix_task_schedules_agent_range ON task_schedules(agent_id, scheduled_start, scheduled_end);
CREATE INDEX ix_task_schedules_board ON task_schedules(board_id);
```

**REST API Endpoints**:
```
GET    /api/v1/calendar/events
  Query: start_date, end_date, board_id?, agent_id?, event_type?
  Response: { events: CalendarEvent[], schedules: TaskSchedule[] }

POST   /api/v1/calendar/events
  Body: { title, event_type, starts_at, ends_at?, is_all_day, board_id? }

PATCH  /api/v1/calendar/events/{id}
DELETE /api/v1/calendar/events/{id}

GET    /api/v1/calendar/schedules
  Query: start_date, end_date, agent_id?, board_id?

POST   /api/v1/calendar/schedules
  Body: { task_id, agent_id, scheduled_start, scheduled_end, estimated_hours? }

DELETE /api/v1/calendar/schedules/{id}

GET    /api/v1/calendar/workload
  Query: start_date, end_date, agent_ids[]
  Response: { agent_id: { hours_scheduled: float, tasks: [...] }[] }

POST   /api/v1/calendar/suggest-slot
  Body: { agent_id, duration_hours, preferred_after?, preferred_before? }
  Response: { suggested_start, suggested_end, conflicts: [] }
```

**Calendar Service Functions**:
```python
class CalendarService:
    async def detect_conflicts(self, agent_id: UUID, start: datetime, end: datetime) -> list[TaskSchedule]
    async def calculate_workload(self, agent_ids: list[UUID], start: date, end: date) -> dict
    async def suggest_optimal_slot(self, agent_id: UUID, duration_hours: float, window: tuple[datetime, datetime]) -> tuple[datetime, datetime]
```

**Claude Session J Instructions**:
> Implement CalendarService conflict detection first, as it is used by the schedule creation endpoint.
> Build `AgentWorkloadTimeline.tsx` as a purely data-driven component — it receives agent + schedule
> arrays and renders a Gantt-style timeline without polling.
> Integrate with the proactivity engine: if an agent's schedule exceeds 8h/day, publish a
> `schedule.overloaded` event to trigger a workload rebalance suggestion.

---

### M12: Digital Memory Hub (Hybrid Search)

**Directory**: Backend + Frontend

**Scope**: Organization knowledge base with hybrid keyword + semantic search using pgvector.
Supports document attachments via OSS, automatic embedding updates, and category-based browsing.

**Files to create**:
```
backend/app/
  models/knowledge_entries.py    # KnowledgeEntry, KnowledgeDocument models
  schemas/knowledge.py           # Pydantic schemas
  api/knowledge.py               # Knowledge REST endpoints
  services/knowledge_service.py  # Search, embedding, CRUD logic
backend/migrations/versions/
  xxxx_add_knowledge_tables.py

frontend/src/
  app/knowledge/
    page.tsx                     # Knowledge hub home (category tree + recent)
    search/page.tsx              # Search results page
  components/knowledge/
    KnowledgeSearchBar.tsx       # Search input with mode toggle (keyword/semantic/hybrid)
    KnowledgeEntryCard.tsx       # Entry card with tags and source ref
    KnowledgeCategoryTree.tsx    # Hierarchical category navigation
    KnowledgeSidebar.tsx         # Filter sidebar (agent, board, tags)
    KnowledgeCreateDialog.tsx    # Create/edit entry dialog with file upload
```

**Database Tables**:
```sql
-- 需要先安装 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 知识条目表 (支持全文检索 + 向量语义检索)
CREATE TABLE knowledge_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    board_id        UUID REFERENCES boards(id),
    board_group_id  UUID REFERENCES board_groups(id),
    agent_id        UUID REFERENCES agents(id),  -- 创建该知识的 Agent
    title           VARCHAR(512) NOT NULL,
    content         TEXT NOT NULL,
    category        VARCHAR(128),
    tags            JSONB DEFAULT '[]',
    source_type     VARCHAR(64),
    -- 来源类型: manual, agent_generated, task_outcome, document_upload
    source_ref      JSONB,
    -- { task_id?, agent_id?, url? }
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    search_vector   TSVECTOR,     -- 全文检索索引 (自动更新)
    embedding       VECTOR(1536), -- 语义向量 (OpenAI ada-002 / Tongyi)
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_knowledge_entries_org ON knowledge_entries(organization_id);
CREATE INDEX ix_knowledge_entries_board ON knowledge_entries(board_id);
CREATE INDEX ix_knowledge_entries_search ON knowledge_entries USING GIN(search_vector);
CREATE INDEX ix_knowledge_entries_embedding ON knowledge_entries
    USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ix_knowledge_entries_category ON knowledge_entries(organization_id, category);

-- 自动更新 search_vector 的触发器
CREATE OR REPLACE FUNCTION knowledge_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_knowledge_search_vector
  BEFORE INSERT OR UPDATE OF title, content, category
  ON knowledge_entries FOR EACH ROW
  EXECUTE FUNCTION knowledge_search_vector_update();

-- 知识条目附件表 (文件存储在 OSS)
CREATE TABLE knowledge_documents (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_entry_id UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    file_name          VARCHAR(512) NOT NULL,
    file_type          VARCHAR(128),
    file_size_bytes    BIGINT,
    storage_url        VARCHAR(2048) NOT NULL,  -- OSS 访问 URL
    created_at         TIMESTAMP NOT NULL DEFAULT now()
);
```

**REST API Endpoints**:
```
GET    /api/v1/knowledge
  Query: category?, board_id?, agent_id?, tags?, is_pinned?, limit, offset
  Response: { items: KnowledgeEntry[], total: int }

POST   /api/v1/knowledge
  Body: { title, content, category?, tags?, source_type?, board_id?, agent_id? }
  Response: KnowledgeEntry

GET    /api/v1/knowledge/{id}
PATCH  /api/v1/knowledge/{id}
DELETE /api/v1/knowledge/{id}
POST   /api/v1/knowledge/{id}/pin

POST   /api/v1/knowledge/search
  Body: { query, mode: "keyword"|"semantic"|"hybrid", board_id?, category?, limit }
  Response: { items: KnowledgeEntry[], scores: float[] }

POST   /api/v1/knowledge/{id}/documents    # Upload document to OSS
  Body: multipart/form-data { file }
  Response: KnowledgeDocument

DELETE /api/v1/knowledge/documents/{doc_id}

-- Agent-facing endpoint (agents can save knowledge)
POST   /api/v1/agent/knowledge
  Body: { title, content, category?, tags?, source_ref?, board_id }
```

**Hybrid Search Logic**:
```python
class KnowledgeService:
    async def search(
        self,
        org_id: UUID,
        query: str,
        mode: Literal["keyword", "semantic", "hybrid"] = "hybrid",
        board_id: UUID | None = None,
        limit: int = 20,
    ) -> list[tuple[KnowledgeEntry, float]]:
        if mode == "keyword":
            # Use tsvector @@ plainto_tsquery with ts_rank scoring
        elif mode == "semantic":
            embedding = await self._embed(query)
            # Use pgvector <=> cosine distance, ORDER BY ASC
        else:  # hybrid
            # Run both queries, merge with configurable weight:
            # final_score = keyword_weight * ts_rank + semantic_weight * (1 - cosine_distance)
            # Default: 0.3 keyword + 0.7 semantic

    async def _embed(self, text: str) -> list[float]:
        # Configurable provider: openai, tongyi, or local
        # Provider selected via EMBEDDING_PROVIDER env var
```

**Embedding Providers**:
- `openai` — `text-embedding-ada-002` via OpenAI API (default)
- `tongyi` — Alibaba Tongyi Qianwen embedding API
- `local` — local inference server (e.g., Ollama)

**Claude Session H Instructions**:
> Run `CREATE EXTENSION IF NOT EXISTS vector;` before the Alembic migration.
> Build the tsvector trigger in the migration — do not rely on application code for this.
> Implement `KnowledgeService.search()` with all three modes, starting with keyword-only.
> Add embedding generation as a background RQ job triggered after entry create/update.
> Build `KnowledgeSearchBar.tsx` with a mode selector toggle (keyword / semantic / hybrid).
> For OSS upload, use `oss2` Python SDK and return a pre-signed URL for frontend access.

---

### M13: Team Architecture + Command Center

**Directory**: Backend + Frontend

**Scope**: Agent team management (team formation, role assignment, capability tracking) plus
a real-time Command Center dashboard showing live agent status, communication graph,
resource allocation, and gateway health.

**Files to create**:
```
backend/app/
  models/
    agent_teams.py               # AgentTeam, AgentTeamMember models
    agent_capabilities.py        # AgentCapability model
  schemas/
    agent_teams.py               # Team schemas
    command_center.py            # Command center dashboard schemas
  api/
    agent_teams.py               # Team CRUD endpoints
    command_center.py            # Dashboard aggregation endpoints
  services/
    team_service.py              # Team formation logic
    command_center_service.py    # Live metrics aggregation
backend/migrations/versions/
  xxxx_add_team_tables.py

frontend/src/
  app/
    teams/
      page.tsx                   # Team list
      new/page.tsx               # Create team wizard
      [teamId]/page.tsx          # Team detail
      [teamId]/edit/page.tsx     # Edit team
    command-center/
      page.tsx                   # Command Center live dashboard
  components/
    teams/
      TeamCard.tsx               # Team summary card
      TeamMemberGrid.tsx         # Agent grid with role badges
      TeamFormationWizard.tsx    # Step-by-step team creation
      AgentRoleBadge.tsx         # Role badge (leader/specialist/member)
      TeamsTable.tsx             # Teams list table
    command-center/
      AgentStatusGrid.tsx        # Real-time agent status grid
      AgentCommunicationGraph.tsx # Force-directed agent interaction graph
      ResourceAllocationChart.tsx # Task distribution chart per agent
      LiveActivityStream.tsx     # Scrolling live event log
      GatewayStatusPanel.tsx     # Gateway health grid
      CommandCenterKPIs.tsx      # KPI cards (active agents, tasks, throughput)
```

**Database Tables**:
```sql
-- Agent 团队定义表
CREATE TABLE agent_teams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    board_id        UUID REFERENCES boards(id),
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    team_type       VARCHAR(64) NOT NULL DEFAULT 'custom',
    -- 团队类型: custom, task_force, review_committee, specialist_pool
    config          JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_agent_teams_org ON agent_teams(organization_id);

-- 团队成员表 (Agent 角色和能力)
CREATE TABLE agent_team_members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      UUID NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
    agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role_in_team VARCHAR(64) NOT NULL DEFAULT 'member',
    -- 角色: leader, specialist, member, reviewer
    capabilities JSONB DEFAULT '[]',
    joined_at    TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(team_id, agent_id)
);
CREATE INDEX ix_agent_team_members_agent ON agent_team_members(agent_id);

-- Agent 能力档案表 (用于智能分配和搜索)
CREATE TABLE agent_capabilities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    capability      VARCHAR(128) NOT NULL,
    -- 能力标签: code_review, python, data_analysis, documentation, testing, etc.
    proficiency     VARCHAR(32) NOT NULL DEFAULT 'standard',
    -- 熟练度: novice, standard, expert
    metadata        JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(agent_id, capability)
);
CREATE INDEX ix_agent_capabilities_org ON agent_capabilities(organization_id, capability);
```

**REST API Endpoints**:
```
-- Team management
GET    /api/v1/agent-teams
  Response: { items: AgentTeam[], total: int }

POST   /api/v1/agent-teams
  Body: { name, team_type, board_id?, description?, config? }

GET    /api/v1/agent-teams/{id}
PATCH  /api/v1/agent-teams/{id}
DELETE /api/v1/agent-teams/{id}

POST   /api/v1/agent-teams/{id}/members
  Body: { agent_id, role_in_team, capabilities? }

DELETE /api/v1/agent-teams/{id}/members/{agent_id}

-- Agent capabilities
GET    /api/v1/agents/{id}/capabilities
POST   /api/v1/agents/{id}/capabilities
  Body: { capability, proficiency }
DELETE /api/v1/agents/{id}/capabilities/{capability}

GET    /api/v1/agent-capabilities/search
  Query: capabilities[], organization_id
  Response: { agents: [{ agent_id, matched_capabilities, proficiency_scores }] }

-- Command Center dashboard
GET    /api/v1/command-center/overview
  Response: { active_agents, tasks_today, throughput_7d, gateways_online }

GET    /api/v1/command-center/agent-status
  Response: { agents: [{ id, name, status, current_task, gateway_id, last_seen }] }

GET    /api/v1/command-center/communication-graph
  Response: { nodes: Agent[], edges: [{ from, to, weight, interaction_count }] }

GET    /api/v1/command-center/resource-allocation
  Response: { per_agent: [{ agent_id, tasks_assigned, tasks_in_progress, estimated_hours }] }

GET    /api/v1/command-center/live-activity
  Query: limit, since_id?
  Response: { events: AgentEvent[], next_since_id }
```

**Claude Session P/Q Instructions**:
> Session P (Week 6): Build all backend endpoints and database migration.
> Session Q (Week 6): Build frontend Command Center with polling (1s refresh for live data).
> `AgentCommunicationGraph.tsx` should use D3.js force simulation for the interaction graph.
> `LiveActivityStream.tsx` should use SSE from `/api/v1/suggestions/stream` and agent events.
> Reuse `GatewayHealthBadge` from M6 inside `GatewayStatusPanel.tsx`.

---

## 6. Shared Interfaces & Contracts

### WebSocket Message Types (M4, M5, M7)

```typescript
// frontend/src/lib/ws-types.ts

type WSMessageType = 'auth' | 'auth_ok' | 'auth_error' | 'chat' | 'system' | 'heartbeat' | 'error'

interface WSMessage {
  type: WSMessageType
  id?: string
  payload: Record<string, unknown>
  timestamp?: string
}

interface ChatMessage {
  type: 'chat'
  id: string
  payload: {
    agent_id: string
    content: string
    session_id: string
    role?: 'user' | 'agent'
  }
}

interface AuthOkMessage {
  type: 'auth_ok'
  payload: {
    user_id: string
    assignments: Array<{ agent_id: string; agent_name: string; board_name: string }>
  }
}
```

### H5 Auth API Types (M3, M5, M6, M7)

```typescript
// frontend/src/api/h5-types.ts

interface H5User {
  id: string
  organization_id: string
  username: string
  display_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  status: 'active' | 'suspended' | 'deleted'
}

interface H5TokenResponse {
  user: H5User
  access_token: string
  refresh_token: string
}
```

### SystemEvent Dataclass (M8 Event Bus)

```python
# backend/app/services/proactivity/event_bus.py

@dataclass(frozen=True)
class SystemEvent:
    event_type: str
    organization_id: UUID
    board_id: UUID | None
    agent_id: UUID | None
    task_id: UUID | None
    payload: dict[str, Any]
    timestamp: datetime
    event_id: UUID
```

### BoardSyncMessage Types (M9)

```typescript
// frontend/src/lib/board-sync-protocol.ts

type ActorRef = { type: 'user' | 'agent'; id: string; name: string }
type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'

type BoardSyncMessage =
  | { type: 'task.updated'; task_id: string; changes: Partial<Task>; updated_by: ActorRef; timestamp: string }
  | { type: 'task.created'; task: Task; timestamp: string }
  | { type: 'task.deleted'; task_id: string; timestamp: string }
  | { type: 'suggestion.new'; suggestion: AgentSuggestion }
  | { type: 'board.state'; tasks: Task[]; timestamp: string }
  | { type: 'task.move'; task_id: string; status: TaskStatus }    // client -> server
  | { type: 'task.create'; title: string; status: TaskStatus; assignee_id?: string }  // client -> server
```

---

## 7. Environment Variables

```bash
# === H5 Auth (M3) ===
H5_JWT_SECRET=<random-64-char-secret>
H5_JWT_ACCESS_TTL_MINUTES=15
H5_JWT_REFRESH_TTL_DAYS=30

# === WebSocket Relay (M4) ===
WS_REDIS_PUBSUB_URL=redis://${REDIS_HOST}:6379/1
WS_HEARTBEAT_INTERVAL_SECONDS=30
WS_HEARTBEAT_TIMEOUT_SECONDS=90
WS_MAX_CONNECTIONS_PER_INSTANCE=10000

# === Gateway Registration (M2) ===
GATEWAY_REGISTRATION_ENABLED=true
GATEWAY_HEARTBEAT_INTERVAL_SECONDS=30
GATEWAY_OFFLINE_THRESHOLD_SECONDS=90

# === Proactivity Engine (M8) ===
PROACTIVITY_REDIS_URL=redis://${REDIS_HOST}:6379/2
PROACTIVITY_EVENT_TTL_DAYS=90
PROACTIVITY_SUGGESTION_EXPIRY_HOURS=168
PROACTIVITY_RULE_COOLDOWN_SECONDS=3600

# === Board Sync (M9) ===
BOARD_SYNC_REDIS_URL=redis://${REDIS_HOST}:6379/3

# === Workflow Engine (M10) ===
PIPELINE_DEFAULT_STAGE_TIMEOUT_HOURS=24
PIPELINE_MAX_CONCURRENT_RUNS=10

# === Knowledge Hub (M12) ===
KNOWLEDGE_SEARCH_LANGUAGE=english
KNOWLEDGE_MAX_DOCUMENT_SIZE_MB=50
EMBEDDING_PROVIDER=openai        # openai | tongyi | local
EMBEDDING_API_KEY=<api-key>
EMBEDDING_MODEL=text-embedding-ada-002

# === Alibaba Cloud Core ===
ACR_REGISTRY=registry.cn-shenzhen.aliyuncs.com/<namespace>
RDS_HOST=<rds-private-endpoint>
RDS_DB=mission_control
RDS_USER=mc_admin
RDS_PASS=<password>
REDIS_HOST=<redis-private-endpoint>

# === Alibaba OSS (M12 document storage) ===
OSS_ENDPOINT=https://oss-cn-shenzhen.aliyuncs.com
OSS_BUCKET=mc-knowledge-docs
OSS_ACCESS_KEY=<access-key-id>
OSS_SECRET_KEY=<access-key-secret>
```

---

## 8. How to Start a New Claude Session

Each module is designed to be developed independently by a single Claude session.

### Starting a Session

1. Open a new Claude Code session in the project root directory.
2. Tell Claude which module to work on:
   > "Work on Module M8 (AI Proactivity Engine). Follow the instructions in ARCHITECTURE.md section M8."
3. Claude will read this `ARCHITECTURE.md`, implement the module following specified patterns,
   create all files, migrations, and tests.
4. All sessions work on the same git repository using feature branches.

### Feature Branches

```
feat/m1-cloud-infra
feat/m2-gateway-registration
feat/m3-h5-auth
feat/m4-ws-relay
feat/m5-h5-chat-ui
feat/m6-admin-extensions
feat/m7-h5-app
feat/m8-proactivity-engine
feat/m9-realtime-taskboard
feat/m10-workflow-engine
feat/m11-shared-calendar
feat/m12-knowledge-hub
feat/m13-teams-command-center
```

### Merge Order

Merge completed feature branches to `main` in dependency order. Do not merge M4 before M2 and
M3 are merged. Do not merge M9 before M4 and M8 are merged. See the dependency graph in
Section 3.

---

## 9. Testing Strategy

| Module | Test Types | Targets and Success Criteria |
|--------|-----------|------------------------------|
| M1 | Smoke | Health endpoints on cloud deploy respond 200; WS upgrade succeeds through SLB |
| M2 | Integration | Gateway register/heartbeat/deregister full cycle; offline detection triggers at 90s |
| M3 | Unit + Integration | Auth endpoints, JWT validation, password hashing, token refresh rotation |
| M4 | Integration + E2E | WS connect, auth handshake, H5->agent message routing, cross-instance via Redis |
| M5 | Component + E2E | Chat UI renders, WS hook reconnects on drop, messages display in correct order |
| M6 | Component | Admin pages render, tables populate, assignment dialog works end-to-end |
| M7 | E2E | Standalone app loads, login works, chat functions on mobile viewport |
| M8 | Unit + Integration | Event publish -> rule evaluation -> suggestion creation -> SSE delivery |
| M9 | Integration + E2E | Task CRUD broadcasts over WS; two browser tabs show same board state |
| M10 | Unit + Integration | Pipeline stage transitions, RQ job execution, run status updates |
| M11 | Unit + Integration | Conflict detection accuracy, workload calculation, slot suggestion logic |
| M12 | Integration | Keyword search recalls, semantic search ranking, hybrid mode blending |
| M13 | Integration + E2E | Team CRUD, capability search, Command Center KPI aggregation |

---

## 10. Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| WebSocket scaling on multi-instance | Medium | Redis pub/sub bridge (DB1/DB3); SLB source-IP persistence |
| Gateway behind NAT/firewall | Low | Gateway initiates outbound WS — no inbound port required |
| H5 user auth security | Medium | bcrypt hashing, short-lived JWTs, refresh token rotation, separate secret |
| Module interface mismatch | Medium | Shared type definitions in `ws-types.ts`; API contract tests before integration |
| Database migration conflicts | Medium | One migration file per module branch; merge in dependency order |
| Alibaba Cloud vendor lock-in | Low | Standard Docker + PostgreSQL + Redis; portable to any cloud |
| pgvector performance at scale | Medium | IVFFlat index with `lists=100`; increase for > 1M entries |
| Event bus backlog under load | Medium | Redis pub/sub is fire-and-forget; add persistent event queue (RQ) for critical rules |
| Dual-write inconsistency (proactivity) | Low | Events written to `agent_events` table first, then Redis; rule engine reads DB for final state |
| Embedding API cost | Medium | Cache embeddings on entry create/update only; batch updates via RQ job |
| Workflow engine stage timeouts | Medium | Per-stage timeout config; dead-letter RQ queue for stuck runs |

---

## 11. Database Summary

### New Tables (13 total across 7 modules)

| Table | Module | Purpose |
|-------|--------|---------|
| `h5_users` | M3 | H5 end user accounts |
| `h5_refresh_tokens` | M3 | H5 JWT refresh token store |
| `h5_user_agent_assignments` | M3 | H5 user to agent mapping |
| `h5_chat_sessions` | M4 | Active H5-agent chat session tracking |
| `agent_suggestions` | M8 | AI-generated suggestions with lifecycle |
| `proactive_rules` | M8 | Builtin and custom rule configurations |
| `agent_events` | M8 | System event audit log (rule engine input) |
| `pipelines` | M10 | Workflow pipeline definitions |
| `pipeline_runs` | M10 | Pipeline execution records |
| `pipeline_stage_tasks` | M10 | Stage-to-task linkage during runs |
| `calendar_events` | M11 | Milestones, meetings, deadlines |
| `task_schedules` | M11 | Task time-slot assignments per agent |
| `knowledge_entries` | M12 | Knowledge base entries with search vectors |
| `knowledge_documents` | M12 | OSS file attachments for knowledge entries |
| `agent_teams` | M13 | Agent team definitions |
| `agent_team_members` | M13 | Team membership with roles |
| `agent_capabilities` | M13 | Agent capability and proficiency profiles |

### Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector for M12 semantic search
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram similarity (optional, improves fuzzy search)
```

### Existing Table Modifications

| Table | Module | Changes |
|-------|--------|---------|
| `gateways` | M2 | Add: `registration_token_hash`, `status`, `last_heartbeat_at`, `connection_info`, `auto_registered` |
