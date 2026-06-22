# SAFEOPS MCP — Phase 2: Public Accessibility Specification

This document details the architecture, configuration, deployment strategies, and security protocols required to transition **SAFEOPS MCP** from a local trial (Phase 1) to a secure, publicly accessible, production-grade cloud service (Phase 2).

---

## 1. Architectural Transition: Stdio vs. SSE Transport

In Phase 1, the MCP server runs locally as a subprocess using stdin/stdout streams (**Stdio Transport**). For public accessibility, we must transition to the **SSE (Server-Sent Events) Transport** over HTTPS.

```text
┌────────────────────────┐                    ┌────────────────────────┐
│     AI Agent Client    │ ◄─── SSE Stream ───│   Public MCP Server    │
│  (e.g., Claude Code,   │ ─── HTTP POST ────►│   (FastAPI/mcp-server) │
│   Cursor, Windsurf)    │                    └───────────┬────────────┘
└────────────────────────┘                                │
                                                          ▼
                                              ┌────────────────────────┐
                                              │    FastAPI Backend     │
                                              │      & Postgres DB     │
                                              └────────────────────────┘
```

### Protocol Mechanics
1. **Connection Initiation**: The AI Agent client establishes a persistent HTTP connection to the MCP server's SSE endpoint (e.g., `GET /mcp/sse`). The server responds with a stream of server-sent events.
2. **Endpoint Mapping**: The server sends a client-specific endpoint URI (e.g., `POST /mcp/messages?session_id=1234`) inside the initial SSE connection payload.
3. **Command Processing**: Subsequent JSON-RPC requests (tool calls, lists) are sent by the client via standard HTTP `POST` requests to the session-specific endpoint.

---

## 2. Production Deployment & Orchestration

For Phase 2, we will leverage **Docker Compose** or **Kubernetes** to deploy the full stack. The SQLite engine will be replaced with PostgreSQL, and Redis will act as the coordination layer for rate limiting and task queues.

### Production `docker-compose.yml` (Recommended Architecture)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: safeops-db
    restart: always
    environment:
      POSTGRES_DB: safeops
      POSTGRES_USER: safeops_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: safeops-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redisdata:/data

  backend:
    image: safeops-backend:latest
    container_name: safeops-api
    restart: always
    environment:
      DATABASE_URL: postgres://safeops_admin:${DB_PASSWORD}@postgres:5432/safeops
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      ENVIRONMENT: production
    depends_on:
      - postgres
      - redis

  mcp-server:
    image: safeops-mcp-server:latest
    container_name: safeops-mcp
    restart: always
    environment:
      SAFEOPS_BACKEND_URL: http://backend:8000
    depends_on:
      - backend

  frontend:
    image: safeops-frontend:latest
    container_name: safeops-dashboard
    restart: always
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: https://api.safeops.io

volumes:
  pgdata:
  redisdata:
```

---

## 3. Ingress & Reverse Proxy Configuration

A secure reverse proxy (e.g., **Nginx** or **Cloudflare Tunnels**) is required to handle SSL/TLS termination, enforce HTTPS, and manage connection timeout/keepalive configurations needed for SSE streams.

### Option A: Cloudflare Tunnels (Zero-Open-Ports)
We recommend Cloudflare Tunnels to expose the server safely without opening firewall ports on your host infrastructure:
1. Install `cloudflared` on the host machine.
2. Route traffic for `mcp.safeops.io` to the local port hosting the MCP server.
3. Enable Cloudflare WAF (Web Application Firewall) to protect against DDoS attacks.

### Option B: Nginx Ingress Configuration
If hosting directly, use this Nginx configuration template:

```nginx
server {
    listen 443 ssl http2;
    server_name mcp.safeops.io;

    ssl_certificate /etc/letsencrypt/live/mcp.safeops.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.safeops.io/privkey.pem;

    location /mcp/sse {
        proxy_pass http://mcp-server:8080;
        
        # Crucial headers for SSE streaming
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Content-Type 'text/event-stream';
        proxy_set_header Cache-Control 'no-cache';
        proxy_buffering off;
        proxy_read_timeout 24h;
        keepalive_timeout 24h;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Multi-Layered Security & Client Authentication

To secure the public endpoints from unauthorized access:

### 1. Bearer Token Authorization
All clients must attach the bearer token as an HTTP header on the initial request:
`Authorization: Bearer so_token_<secure-hash>`
For the SSE protocol, if headers cannot be customized in client libraries, the token must be passed securely via query parameter `?token=so_tok_...` and validated on handshake.

### 2. IP Whitelisting (CIDR Range Enforcement)
The FastAPI backend supports CIDR verification. In Phase 2, this must be enforced. Any client connection originating from an IP address not in the client registration whitelist is blocked at the router layer before policy evaluation.

### 3. API Rate Limiting (Redis-backed)
Public endpoints will be protected by a rate-limiting middleware configured to allow:
- **Handshakes (`/mcp/sse`)**: Max 10 per minute per IP.
- **Message Posts (`/mcp/messages`)**: Max 100 per minute per client session.

---

## 5. Deployment Checklist (Phase 2 Launch)

- [ ] Transition `server.py` to support `mcp.server.sse.SseServerTransport`.
- [ ] Migrate database schemas from SQLite (`safeops.db`) to the production PostgreSQL cluster.
- [ ] Implement query parameter authentication fallback for SSE handshakes.
- [ ] Deploy reverse proxy with HTTP/2 enabled and buffer caching disabled (`proxy_buffering off`).
- [ ] Verify Docker container isolation is active on the executor host (commands must run in isolated `safeops-sandbox` docker containers rather than local systemd-run).
- [ ] Conduct load testing on the SSE stream with up to 100 concurrent agent threads.
