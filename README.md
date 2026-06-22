# SAFEOPS MCP — Secure AI Agent Governance Platform

<div align="center">

**Enterprise-grade Model Context Protocol (MCP) server that acts as an intelligent governance and execution layer between AI coding agents and critical infrastructure.**

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![MCP](https://img.shields.io/badge/MCP-Protocol-purple)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## What is SafeOps MCP?

SafeOps MCP prevents AI agents (Claude Code, Cursor, Windsurf, Antigravity, etc.) from executing destructive commands directly on host systems. Instead of raw terminal access, every agent action passes through a multi-layered safety pipeline:

```
AI Agent → MCP Server → Safety Classifier → Risk Engine → Policy Engine → Sandbox → Audit Ledger
```

### Core Safety Features

| Feature | Description |
|---------|-------------|
| **Dynamic Risk Scoring** | Every command is scored 0–10 based on tool type, environment, and arguments |
| **Context-Aware Policies** | RBAC + ABAC rules per role/tool/environment combination |
| **Multi-Stage Approvals** | High-risk actions pause and require human authorization via dashboard |
| **Sandboxed Execution** | Commands run in isolated environments (`systemd-run` locally or Docker containers) |
| **Automatic Rollbacks** | Pre-execution snapshots with auto-restore on failure |
| **Cryptographic Audit Trail** | SHA-256 hash-chained immutable logs for tamper-proof auditing |
| **Safe Doc Traversal** | Securely fetches and parses online documentation for AI agents to read |

---

## Project Structure

```
safeops-mcp/
├── backend/                 # FastAPI API server
│   ├── app/
│   │   ├── main.py          # Application entrypoint + DB seeding
│   │   ├── models.py        # SQLAlchemy ORM models (SQLite/PostgreSQL)
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── config.py        # Environment configuration
│   │   ├── database.py      # Engine + session management
│   │   ├── core/            # Business logic engines
│   │   │   ├── auth_utils.py    # JWT + bcrypt authentication
│   │   │   ├── safety.py       # Input sanitization classifier
│   │   │   ├── risk.py         # Dynamic risk scoring engine
│   │   │   ├── policy.py       # RBAC/ABAC policy evaluator
│   │   │   ├── sandbox.py      # Isolated command executor
│   │   │   ├── rollback.py     # Snapshot & restore engine
│   │   │   └── audit_utils.py  # Hash-chain audit ledger
│   │   └── routers/         # API endpoint handlers
│   │       ├── auth.py          # Login, register, JWT
│   │       ├── clients.py      # Agent registration & tokens
│   │       ├── tools.py        # Tool catalog & seeding
│   │       ├── policies.py     # Security policy CRUD
│   │       ├── executions.py   # Tool execution pipeline
│   │       ├── approvals.py    # Approval queue management
│   │       ├── audit.py        # Audit log queries & verification
│   │       └── rollbacks.py    # Snapshot restore triggers
│   └── requirements.txt
├── frontend/                # Next.js 15 cybersecurity dashboard
│   └── src/app/
│       ├── layout.tsx       # Sidebar navigation + status bar
│       ├── page.tsx         # Overview + onboarding tutorial
│       ├── approvals/       # Approval queue (pending/approved/rejected)
│       ├── tools/           # Tools catalog browser
│       ├── audit/           # Cryptographic audit trail viewer
│       ├── policies/        # Policy rules editor
│       ├── agents/          # Connected agent management
│       └── rollbacks/       # State snapshot rollback center
├── mcp-server/              # Standalone MCP stdio server
│   └── server.py            # Tool discovery + execution relay
├── docs/                    # Architecture documentation
└── docker-compose.yml       # Container orchestration (optional)
```

---

## Quick Start (Local — No Docker Required)

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

### 1. Clone the Repository

```bash
git clone git@github.com:Elk-Union/safeops-mcp.git
cd safeops-mcp
```

### 2. Start the Backend API

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

On first startup, the backend automatically:
- Creates an SQLite database (`safeops.db`)
- Seeds default roles: `superadmin`, `admin`, `operator`, `reader`
- Creates a default admin user: `admin@safeops.io` / `safeops-admin`

### 3. Seed the Tools Catalog

```bash
# Get a JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@safeops.io","password":"safeops-admin"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Seed 15 default tools
curl -X POST http://localhost:8000/api/v1/tools/seed \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Register an AI Agent Client

```bash
# Get the operator role ID
ROLE_ID=$(python3 -c "
import sqlite3; conn = sqlite3.connect('safeops.db')
for r in conn.execute('SELECT id FROM roles WHERE name=\"operator\"'): print(r[0])
conn.close()")

# Register a client — save the returned api_token!
curl -X POST http://localhost:8000/api/v1/clients/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"My Agent\", \"role_id\": \"$ROLE_ID\"}"
```

### 5. Create Policies for the Agent

```bash
# Allow all tools for the operator role
for TOOL_ID in $(python3 -c "
import sqlite3; conn = sqlite3.connect('safeops.db')
for r in conn.execute('SELECT id FROM mcp_tools'): print(r[0])
conn.close()"); do
  curl -s -X POST http://localhost:8000/api/v1/policies/ \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"role_id\": \"$ROLE_ID\", \"tool_id\": \"$TOOL_ID\", \"environment\": \"*\", \"effect\": \"allow\"}"
done
```

### 6. Start the Frontend Dashboard

```bash
cd ../frontend
npm install --legacy-peer-deps
npm run dev
```

Dashboard available at `http://localhost:3000`

### 7. Set Up the MCP Server

```bash
cd ../mcp-server
python -m venv .venv
source .venv/bin/activate
pip install mcp requests
```

---

## Connecting AI Agents

### Claude Code / Antigravity / Any MCP Client

Add to your MCP configuration (e.g. `~/.config/claude/claude_code_config.json`):

```json
{
  "mcpServers": {
    "safeops": {
      "command": "/path/to/safeops-mcp/mcp-server/.venv/bin/python",
      "args": ["/path/to/safeops-mcp/mcp-server/server.py"],
      "env": {
        "SAFEOPS_API_TOKEN": "<your_client_api_token>",
        "SAFEOPS_BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

Once configured, the AI agent can use all 15 SafeOps tools:

| Tool | Category | Risk | Description |
|------|----------|------|-------------|
| `get_uptime` | system | 1.0 | Get system uptime |
| `cpu_usage` | system | 1.0 | Real-time CPU metrics |
| `ram_usage` | system | 1.0 | Memory utilization |
| `disk_usage` | system | 1.0 | Disk partition metrics |
| `system_health` | system | 1.0 | Combined health diagnostic |
| `check_updates` | packages | 2.0 | Check available package updates |
| `update_package` | packages | 5.0 | Install/upgrade a package |
| `remove_package` | packages | 7.0 | Uninstall a package |
| `package_info` | packages | 1.0 | Show package metadata |
| `start_service` | services | 4.0 | Start a systemd/docker service |
| `stop_service` | services | 6.0 | Stop a service |
| `restart_service` | services | 5.0 | Restart a service |
| `service_status` | services | 1.0 | Service status details |
| `traverse_documentation` | setup | 2.0 | Safely fetch & parse online docs |
| `simulate_install` | setup | 4.0 | Dry-run install commands in sandbox |

---

## Architecture

```
┌──────────────────┐     stdio/SSE      ┌──────────────────┐
│   AI Agent       │ ◄──────────────── │   MCP Server     │
│ (Claude, Cursor, │                    │  (server.py)     │
│  Windsurf, etc.) │                    └────────┬─────────┘
└──────────────────┘                             │ HTTP
                                                 ▼
                                    ┌────────────────────────┐
                                    │     FastAPI Backend     │
                                    │                        │
                                    │  ┌──────────────────┐  │
                                    │  │ Safety Classifier │  │  Input sanitization
                                    │  └────────┬─────────┘  │
                                    │           ▼            │
                                    │  ┌──────────────────┐  │
                                    │  │   Risk Engine     │  │  Dynamic 0-10 scoring
                                    │  └────────┬─────────┘  │
                                    │           ▼            │
                                    │  ┌──────────────────┐  │
                                    │  │  Policy Engine    │  │  RBAC + ABAC evaluation
                                    │  └────────┬─────────┘  │
                                    │           ▼            │
                                    │  ┌──────────────────┐  │
                                    │  │ Sandbox Executor  │  │  systemd-run / Docker
                                    │  └────────┬─────────┘  │
                                    │           ▼            │
                                    │  ┌──────────────────┐  │
                                    │  │  Audit Ledger     │  │  SHA-256 hash chain
                                    │  └──────────────────┘  │
                                    └────────────────────────┘
                                                 │
                                    ┌────────────┴───────────┐
                                    │   SQLite / PostgreSQL   │
                                    └────────────────────────┘
```

### Execution Flow

1. **Agent calls a tool** → MCP server receives the request
2. **Safety Classifier** sanitizes inputs against injection attacks
3. **Risk Engine** scores the action (base risk × environment multiplier)
4. **Policy Engine** checks RBAC/ABAC rules for allow/deny/approval_required
5. If risk ≥ threshold → **Approval Request** created, agent gets approval URL
6. If allowed → **Rollback Engine** takes pre-execution snapshots
7. **Sandbox Executor** runs command in isolation (`systemd-run` or Docker)
8. On failure → automatic rollback from snapshot
9. **Audit Ledger** records the action with SHA-256 hash chain

---

## API Documentation

Interactive Swagger docs available at `http://localhost:8000/docs` when the backend is running.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/login` | Authenticate and get JWT token |
| `POST` | `/api/v1/auth/register` | Register a new dashboard user |
| `GET` | `/api/v1/auth/me` | Get current user info |
| `POST` | `/api/v1/clients/` | Register an AI agent client |
| `GET` | `/api/v1/clients/` | List registered clients |
| `DELETE` | `/api/v1/clients/{id}` | Revoke a client |
| `GET` | `/api/v1/tools/` | List all tools (dashboard) |
| `GET` | `/api/v1/tools/client-catalog` | Get tools for a client (MCP) |
| `POST` | `/api/v1/tools/seed` | Seed default tool catalog |
| `POST` | `/api/v1/policies/` | Create a security policy |
| `GET` | `/api/v1/policies/` | List all policies |
| `POST` | `/api/v1/executions/` | Execute a tool through the safety pipeline |
| `GET` | `/api/v1/approvals/` | List approval requests |
| `POST` | `/api/v1/approvals/{id}` | Approve/reject a request |
| `GET` | `/api/v1/audit/` | Query audit logs |
| `GET` | `/api/v1/audit/verify` | Verify hash chain integrity |
| `POST` | `/api/v1/rollbacks/{id}/restore` | Trigger a rollback |

---

## Dashboard

The cybersecurity-themed Next.js dashboard provides:

- **Overview** — Real-time KPI stats (health score, active agents, pending reviews, ledger status) with interactive onboarding tutorial
- **Approvals** — 3-tab queue (Pending/Approved/Rejected) with approve/reject actions
- **Tools Catalog** — Filterable grid of all registered tools with risk scores
- **Audit Trail** — Searchable log table with ledger integrity verification
- **Policies Editor** — CRUD interface for security policy rules
- **Connected Agents** — Agent registration and token management
- **Rollback Center** — Snapshot restore interface

---

## Configuration

Environment variables (set in shell or `.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./safeops.db` | Database connection string |
| `SECRET_KEY` | (built-in dev key) | JWT signing key — **change in production** |
| `ENVIRONMENT` | `development` | `development` / `staging` / `production` |
| `SANDBOX_DOCKER_IMAGE` | `alpine:latest` | Docker image for sandbox (if Docker available) |
| `SANDBOX_TIMEOUT_SECONDS` | `30` | Max execution time per command |
| `SAFEOPS_API_TOKEN` | — | Client API token for MCP server |
| `SAFEOPS_BACKEND_URL` | `http://localhost:8000` | Backend URL for MCP server |

---

## Default Credentials

| Resource | Value |
|----------|-------|
| Admin Email | `admin@safeops.io` |
| Admin Password | `safeops-admin` |

>  **Change these immediately in production!**

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, branching strategy, and code standards.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
