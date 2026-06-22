# SAFEOPS MCP — Secure System Administration Platform

SAFEOPS MCP is a secure, enterprise-grade Model Context Protocol (MCP) platform that acts as an intelligent governance and execution layer between AI coding/operations agents (such as Claude Code, Cursor, Windsurf, Antigravity) and critical infrastructure. 

It prevents AI agents from executing destructive commands directly on host shells, replacing raw terminal access with:
1. **Dynamic Risk Assessment**: Evaluates commands dynamically on a scale from 0 to 10.
2. **Context-Aware Policies**: Restricts access using role-based and attribute-based permissions.
3. **Multi-Stage Approvals**: Suspends risky actions (e.g. restarts, package upgrades) and requests human authorization via a real-time web dashboard.
4. **Execution Sandbox**: Runs authorized commands inside isolated, transient Docker containers with resource and time limits.
5. **State Rollbacks**: Takes automated backups/snapshots before modifying systems and allows restoring in case of errors.
6. **Immutable Cryptographic Audit**: Chains logs together with SHA256 hashes to guarantee audit log tamper resistance.

---

## Directory Structure

```text
safeops-mcp/
├── backend/                   # FastAPI service hosting engines, database models, and endpoints
├── frontend/                  # Next.js 15 Tailwind security control dashboard
├── mcp-server/                # Standalone Python MCP server communicating via Stdio/SSE
├── docs/                      # Architectural knowledge base & specifications
└── docker-compose.yml         # Container orchestration (Web UI, API, Redis, Postgres)
```

For a comprehensive breakdown of each module, check out [docs/architecture_kb.md](docs/architecture_kb.md).

---

## Quick Start (Docker Compose)

To spin up the entire SAFEOPS MCP platform locally:

```bash
docker compose up --build
```

This starts:
- **FastAPI API Server** on `http://localhost:8000`
- **Next.js Dashboard** on `http://localhost:3000`
- **PostgreSQL Database** on port `5432`
- **Redis Cache & Session Store** on port `6379`
