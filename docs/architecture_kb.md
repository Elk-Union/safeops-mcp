# SAFEOPS MCP: Enterprise-Grade Systems Administration Governance Platform Spec

This document serves as the official, production-grade technical specification and architecture knowledge base for **SAFEOPS MCP** (Safe Operations Model Context Protocol). It outlines the architecture, logic, code patterns, and security guardrails necessary to build a secure governance layer between AI coding agents and critical infrastructure.

---

## 1. Executive Summary & Core Philosophy

AI coding agents (e.g., Claude Code, Cursor, Windsurf, Antigravity) are designed to solve complex software engineering and systems administration tasks. However, providing these agents with direct, unrestricted shell access (e.g., `sudo bash` or ssh access to production systems) creates severe security vulnerabilities:
1. **Malicious or Erratic Behavior**: An agent could execute destructive commands (`rm -rf /`, formatting disks, shutting down critical databases) due to hallucination or compromised prompts.
2. **Privilege Escalation**: An agent could download external malware, modify shadow files, or open unauthorized ports.
3. **Lack of Auditability**: Direct shell histories are easily modified, spoofed, or cleared, violating compliance standards (SOC 2, ISO 27001).
4. **Data Exfiltration**: Agents could search for env files, secrets, or customer PII, and send them to external servers via `curl`.

**SAFEOPS MCP** solves this by inserting a Zero-Trust governance proxy layer between the agent and the target infrastructure. 

```text
+-----------------------+
|  AI Agent (Client)    |
+-----------------------+
            |
            | (MCP Protocol: JSON-RPC over Stdio/SSE)
            v
+-----------------------+
|  SAFEOPS MCP Server   |
+-----------------------+
            |
            | (Internal API Call with Auth Token)
            v
+-------------------------------------------------------+
|                 SAFEOPS FastAPI Backend               |
|                                                       |
|  +--------------------+       +--------------------+  |
|  |   Safety Layer     | ----> |   Policy Engine    |  |
|  +--------------------+       +--------------------+  |
|            |                             |            |
|            v                             v            |
|  +--------------------+       +--------------------+  |
|  |   Risk Engine      | ----> |   Approval Engine  |  |
|  +--------------------+       +--------------------+  |
+-------------------------------------------------------+
            |
            | (Execution Authorized or Approved)
            v
+-----------------------+
|   Rollback Snapshot   | (E.g. PG Dump, Git Commit, LVM snapshot)
+-----------------------+
            |
            v
+-----------------------+
|   Execution Sandbox   | (Isolated Docker / restricted cgroup)
+-----------------------+
            |
            v
+-----------------------+
|  Target Infrastructure|
+-----------------------+
            |
            v
+-----------------------+
|  Cryptographic Audit   | (Immutable Blockchain-style SHA256 Chain)
+-----------------------+
```

---

## 2. Threat Modeling & Security Objectives (STRIDE Analysis)

To design the governance controls of SAFEOPS MCP, we apply a STRIDE threat modeling framework to AI agent execution:

| Threat Category | Security Risk in AI Operations | SAFEOPS MCP Mitigation Control |
| :--- | :--- | :--- |
| **Spoofing Identity** | Compromised agent keys or unauthorized clients invoking server commands. | Token-based registry; client tokens map to cryptographically hashed database records; IP-whitelisting enforced at API gateway. |
| **Tampering with Data** | Agents editing target files, system binaries, or local audit logs. | Commands execute in read-only container environments where write paths are restricted to ephemeral directories. Audit logs are chained via cryptographic SHA256 hashing. |
| **Repudiation** | Agents performing operations without clean history trails. | Every command is written to an immutable audit table capturing the exact agent metadata, arguments, approvals, and output checksums. |
| **Information Disclosure** | Agents exfiltrating environment variables, database records, or configuration secrets. | Disabling network routing (`network_mode="none"`) inside transient containers; applying argument sanitization and safety classifiers before proxying. |
| **Denial of Service** | Agents spawning runaway processes, infinite loops, or resource-intensive scripts. | Strict memory limitations (512MB), CPU constraints (0.5 cores), and maximum execution timeout policies (30s) inside the sandbox. |
| **Elevation of Privilege** | Agents executing `sudo` commands, mapping volumes, or breaking out of containers. | Sandboxed container processes execute under custom user IDs (`1000:1000`) with kernel capabilities stripped (`--cap-drop=ALL`). |

---

## 3. Protocol Channels & Handshaking (JSON-RPC Specification)

The Model Context Protocol (MCP) relies on JSON-RPC 2.0 messages sent over standard input/output (`stdio`) or Server-Sent Events (`SSE`). Below are the explicit specifications for message handshaking, tool listing, and tool calling.

### 3.1 Connection Handshake

When an AI client (e.g. Claude Code) launches the SAFEOPS MCP server, it starts a handshake exchange:

**Client `initialize` Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {
        "listChanged": true
      }
    },
    "clientInfo": {
      "name": "claude-code",
      "version": "0.1.2"
    }
  }
}
```

**Server `initialize` Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {
        "listChanged": true
      }
    },
    "serverInfo": {
      "name": "safeops-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

**Client `notifications/initialized`:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

---

### 3.2 Dynamic Tool Discovery

Once initialized, the client queries for available tools:

**Client `tools/list` Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Server `tools/list` Response:**
The MCP server acts as a proxy, forwarding this request to the backend `/api/v1/tools` with its auth token. The backend returns a customized catalog matching the client's role permissions:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "get_uptime",
        "description": "Gets system uptime.",
        "inputSchema": {
          "type": "object",
          "properties": {}
        }
      },
      {
        "name": "restart_service",
        "description": "Restarts a systemd or docker service on the host machine.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "service_name": {
              "type": "string",
              "description": "The name of the service to restart (e.g. 'nginx')."
            }
          },
          "required": ["service_name"]
        }
      }
    ]
  }
}
```

---

### 3.3 Dynamic Tool Execution and Asynchronous Approvals

When the agent invokes a tool, the server relays the request to the `/api/v1/executions` endpoint.

**Client `tools/call` Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "restart_service",
    "arguments": {
      "service_name": "postgresql"
    }
  }
}
```

#### Scenario A: Execution Auto-Allowed (Risk < 3.0)
If the tool is low-risk or auto-approved, it executes in the sandbox and returns the stdout:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Service 'postgresql' restarted successfully. Exit code: 0."
      }
    ],
    "isError": false
  }
}
```

#### Scenario B: Execution Requires Human Approval (Risk >= 3.0)
If the command requires approval, the server returns a suspended, informative state. It tells the agent that the action is pending approval, providing a unique tracking ID and URL where the user can click to approve it. The agent can then display this URL to the human operator:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "⚠️ [PENDING APPROVAL] The request to restart 'postgresql' has a risk score of 5.5 and requires administrator approval. Please review and authorize the action here: http://localhost:3000/approvals/ap_89d1a1b8. Once approved, you can check the status using the check_execution tool."
      }
    ],
    "isError": false
  }
}
```

---

## 4. Integration Specifications for Major AI Agent Clients

To ensure seamless integration with various developer environments, SAFEOPS MCP supports standard configuration templates for the major AI clients.

### 4.1 Claude Code Integration
Claude Code connects to MCP servers via standard configuration files. Add SAFEOPS MCP by configuring your global settings:

**File Path**: `~/.config/claude/config.json`
```json
{
  "mcpServers": {
    "safeops": {
      "command": "python3",
      "args": ["/home/aderham/impprojs/safeops-mcp/mcp-server/server.py"],
      "env": {
        "SAFEOPS_API_TOKEN": "so_tok_92138a0fcdba8f71239abcef",
        "SAFEOPS_BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

---

### 4.2 Cursor Desktop Integration
Cursor supports MCP servers configured through its Desktop UI.

1. Navigate to **Cursor Settings** -> **Features** -> **MCP**.
2. Click **+ Add New MCP Server**.
3. Fill in the parameters:
   - **Name**: `safeops`
   - **Type**: `command`
   - **Command**: `python3 /home/aderham/impprojs/safeops-mcp/mcp-server/server.py`
4. Define Environment Variables:
   - `SAFEOPS_API_TOKEN` = `so_tok_92138a0fcdba8f71239abcef`
   - `SAFEOPS_BACKEND_URL` = `http://localhost:8000`

---

### 4.3 Windsurf Integration
Windsurf manages external tool registries via codeium configurations.

**File Path**: `~/.codeium/windsurf/mcp_config.json`
```json
{
  "mcpServers": {
    "safeops": {
      "command": "python3",
      "args": ["/home/aderham/impprojs/safeops-mcp/mcp-server/server.py"],
      "env": {
        "SAFEOPS_API_TOKEN": "so_tok_92138a0fcdba8f71239abcef",
        "SAFEOPS_BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

---

### 4.4 Antigravity Integration
Antigravity integrates with custom MCP servers registered in its global config directory.

**File Path**: `/home/aderham/.gemini/antigravity/mcp_config.json`
```json
{
  "mcpServers": {
    "safeops": {
      "command": "python3",
      "args": ["/home/aderham/impprojs/safeops-mcp/mcp-server/server.py"],
      "env": {
        "SAFEOPS_API_TOKEN": "so_tok_92138a0fcdba8f71239abcef",
        "SAFEOPS_BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

---

## 5. Advanced Policy Engine & ABAC Resolver

The Policy Engine handles the core authorization logic. It supports Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC). Below is the Python representation of the policy engine evaluator:

```python
from ipaddress import ip_address, ip_network
from typing import Dict, Any, List
import datetime

class PolicyResolver:
    @staticmethod
    def evaluate_ip(client_ip: str, whitelist_cidr: str) -> bool:
        """
        Validates if the client IP fits within whitelisted CIDR networks.
        """
        if not whitelist_cidr:
            return True
        try:
            client_addr = ip_address(client_ip)
            for network in whitelist_cidr.split(","):
                if client_addr in ip_network(network.strip()):
                    return True
            return False
        except Exception:
            return False

    @staticmethod
    def evaluate_time_constraint(rules: Dict[str, Any]) -> bool:
        """
        Validates if the current UTC hour falls within the allowed operations window.
        """
        allowed_hours = rules.get("allowed_hours") # e.g. {"start": 8, "end": 20}
        if not allowed_hours:
            return True
        current_hour = datetime.datetime.utcnow().hour
        start = allowed_hours.get("start", 0)
        end = allowed_hours.get("end", 24)
        return start <= current_hour <= end

    @classmethod
    def evaluate_policy(cls, policy: Dict[str, Any], context: Dict[str, Any]) -> str:
        """
        Resolves if the requested action is ALLOWED, DENIED, or requires APPROVAL.
        """
        rules = policy.get("rules", {})
        conditions = rules.get("conditions", [])
        
        # 1. Validate Client IP
        client_ip = context.get("client_ip", "127.0.0.1")
        ip_whitelist = rules.get("ip_whitelist")
        if ip_whitelist and not cls.evaluate_ip(client_ip, ip_whitelist):
            return "deny"
            
        # 2. Validate Time of Operation
        if not cls.evaluate_time_constraint(rules):
            return "deny"
            
        # 3. Evaluate Environment Overrides
        target_env = context.get("environment", "development").lower()
        env_overrides = rules.get("environment_overrides", {})
        
        if target_env in env_overrides:
            return env_overrides[target_env].get("effect", "deny")
            
        return policy.get("effect", "deny")
```

---

## 6. Dynamic Risk Engine Specifications

The Risk Engine calculates a dynamic, decimal score ranging from `0.0` to `10.0` to represent the severity/risk of executing the tool under the current system context.

### 6.1 Risk Formulation

The dynamic score is computed using the following equation:

\[
R_{\text{score}} = \min\left(10.0, R_{\text{base}} \times M_{\text{env}} \times \left(1.0 + F_{\text{history}}\right) \times W_{\text{system}}\right)
\]

Where:
- \(R_{\text{base}}\): Base risk score assigned to the tool configuration (from `1.0` to `10.0`).
- \(M_{\text{env}}\): Environment multiplier based on the target execution environment:
  - `development` = \(0.5\)
  - `staging` = \(1.0\)
  - `production` = \(2.0\)
- \(F_{\text{history}}\): Historical failure weight factor calculated from audit logs over the last 30 days:
  \[
  F_{\text{history}} = \min\left(0.5, \frac{\text{Failed Executions of Tool}}{\text{Total Executions of Tool} + 1}\right)
  \]
- \(W_{\text{system}}\): Criticality weight of the target system (e.g. database server = 1.25, proxy = 1.0, secondary task worker = 0.8).

---

### 6.2 Worked Scoring Scenarios

To demonstrate the risk engine calculations, review the following scenarios:

#### Scenario A: Reading logs in Production
- **Tool**: `journal_logs`
- **Base Risk (\(R_{\text{base}}\))**: 2.0
- **Environment multiplier (\(M_{\text{env}}\))**: 2.0 (Production)
- **Failure History (\(F_{\text{history}}\))**: 0.0 (No failures)
- **System Weight (\(W_{\text{system}}\))**: 1.0
- **Calculation**:
  \[
  R_{\text{score}} = \min(10.0, 2.0 \times 2.0 \times 1.0 \times 1.0) = 4.0
  \]
- **Decision**: Requires Manager approval (Score 4.0).

#### Scenario B: Deploying FastAPI application in Staging
- **Tool**: `deploy_fastapi`
- **Base Risk (\(R_{\text{base}}\))**: 7.0
- **Environment multiplier (\(M_{\text{env}}\))**: 1.0 (Staging)
- **Failure History (\(F_{\text{history}}\))**: 0.2 (2 failures out of 9 previous runs)
- **System Weight (\(W_{\text{system}}\))**: 1.0
- **Calculation**:
  \[
  R_{\text{score}} = \min(10.0, 7.0 \times 1.0 \times 1.20 \times 1.0) = 8.4
  \]
- **Decision**: Requires Admin approval (Score 8.4).

---

## 7. Execution Sandbox & Isolation Architecture

The execution of any system tool must be fully insulated. The Docker sandbox utilizes the official Docker SDK for Python, enforcing the following security constraints:

### 7.1 Container Security Configuration
- **Network Mode**: Set to `"none"` to prevent the agent from communicating with external servers, preventing command-and-control (C2) callbacks or exfiltration.
- **Resource Limits**: Configured with `mem_limit="512m"` and `nano_cpus=500000000` (capped at 0.5 vCPU).
- **User Namespace**: Spawns using non-root user credentials (`1000:1000`).
- **Filesystem Constraints**: The root directory is mounted read-only (`read_only=True`). Writing is only permitted within an ephemeral temporary directory `/workspace` backed by a host-bound temp directory.

---

### 7.2 Alternative `systemd-run` Execution Model
For situations where host-level interactions are required (e.g. managing systemd services), SAFEOPS MCP uses `systemd-run` to execute commands inside transient systemd service units with resource boundaries:

```bash
systemd-run --scope -p MemoryMax=512M -p CPUQuota=50% --uid=1000 --gid=1000 /bin/systemctl restart nginx
```

---

## 8. State Recovery and Rollback Engine

SAFEOPS MCP establishes state snapshots before executing high-risk write tasks.

### 8.1 Snapshots Registry Table
Rollback tasks are recorded in the database, containing:
- `id`: Unique snapshot UUID.
- `execution_id`: The ID of the tool execution that triggered the snapshot.
- `snapshot_type`: The mechanism used (`docker_image`, `postgres_dump`, `git_commit`, `directory_backup`).
- `snapshot_target`: Target location or identifier (e.g. `/var/backups/safeops/pg_backup_v12.sql`).

---

### 8.2 Application Deployment Rollbacks
During `deploy_fastapi` operations, the rollback framework handles updates using symlink version mapping:
1. The new deployment build is compiled inside `/var/www/releases/release_uuid`.
2. A database checkpoint is created.
3. The symlink `/var/www/active` is switched to point to the new directory.
4. An automated health check (`service_health` endpoint) is triggered.
5. If the health check fails, the symlink is immediately swapped back to `/var/www/releases/previous_release_uuid` and the rollback status is logged.

---

## 9. Cryptographic Audit Ledger

To prevent administrative tampering, audit records form an immutable hash chain:

```text
+-----------------------+      +-----------------------+      +-----------------------+
|  Audit Record 1       |      |  Audit Record 2       |      |  Audit Record 3       |
|  - Previous Hash: 000 |      |  - Previous Hash: H1  |      |  - Previous Hash: H2  |
|  - Payload Data       | ---> |  - Payload Data       | ---> |  - Payload Data       |
|  - Row Hash: H1       |      |  - Row Hash: H2       |      |  - Row Hash: H3       |
+-----------------------+      +-----------------------+      +-----------------------+
```

If a record is modified or deleted, the subsequent hashes will fail validation, alerting the security team.

### Chain Verification Routine
A background job runs periodically to audit the ledger integrity:

```python
import hashlib
from sqlalchemy.orm import Session
from ..models import AuditLog

def verify_audit_ledger(db: Session) -> bool:
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.asc()).all()
    if not logs:
        return True
        
    expected_previous = "0" * 64
    for idx, log in enumerate(logs):
        if log.previous_hash != expected_previous:
            print(f"Ledger warning: Chain broken at record ID {log.id}")
            return False
            
        # Recompute record hash
        payload = f"{log.previous_hash}|{log.timestamp.isoformat()}|{log.user_id}|{log.client_id}|{log.tool_name}|{log.arguments_hash}|{log.risk_score}|{log.status}"
        calculated_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        
        if log.row_hash != calculated_hash:
            print(f"Ledger warning: Tampered contents at record ID {log.id}")
            return False
            
        expected_previous = calculated_hash
        
    return True
```

---

## 10. Database Schema (SQLAlchemy Models)

The following schema defines the core entity structure for the PostgreSQL database:

```python
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
import datetime
from .database import Base

class Role(Base):
    __tablename__ = "roles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False) # e.g. superadmin, admin, operator, reader
    description = Column(String(255))
    
    users = relationship("User", back_populates="role")
    clients = relationship("ClientRegistry", back_populates="role")
    policies = relationship("PolicyRule", back_populates="role")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    role = relationship("Role", back_populates="users")
    approvals = relationship("ApprovalRequest", back_populates="approver")

class ClientRegistry(Base):
    __tablename__ = "mcp_clients"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False) # e.g. "Claude-Production"
    api_token_hash = Column(String(255), unique=True, nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    ip_whitelist = Column(Text, nullable=True) # CSV of allowed IPs/CIDRs
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_active = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    role = relationship("Role", back_populates="clients")
    executions = relationship("ToolExecution", back_populates="client")

class MCPTool(Base):
    __tablename__ = "mcp_tools"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False) # e.g. "restart_service"
    category = Column(String(50), nullable=False) # system, package, service, docker, etc.
    description = Column(Text)
    base_risk = Column(Float, default=1.0)
    requires_approval_above = Column(Float, default=5.0)
    rollback_available = Column(Boolean, default=False)

    executions = relationship("ToolExecution", back_populates="tool")
    policies = relationship("PolicyRule", back_populates="tool")

class PolicyRule(Base):
    __tablename__ = "policies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    tool_id = Column(UUID(as_uuid=True), ForeignKey("mcp_tools.id"), nullable=False)
    environment = Column(String(50), default="*") # *, production, staging, development
    effect = Column(String(20), nullable=False) # allow, deny, approval_required
    rules_json = Column(JSONB, nullable=True) # Context-aware rules

    role = relationship("Role", back_populates="policies")
    tool = relationship("MCPTool", back_populates="policies")

class ToolExecution(Base):
    __tablename__ = "tool_executions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("mcp_clients.id"), nullable=False)
    tool_id = Column(UUID(as_uuid=True), ForeignKey("mcp_tools.id"), nullable=False)
    arguments = Column(JSONB, nullable=True)
    environment = Column(String(50), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING_APPROVAL, EXECUTING, COMPLETED, FAILED, REJECTED
    exit_code = Column(Integer, nullable=True)
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    client = relationship("ClientRegistry", back_populates="executions")
    tool = relationship("MCPTool", back_populates="executions")
    approval = relationship("ApprovalRequest", back_populates="execution", uselist=False)
    risk_assessment = relationship("RiskAssessment", back_populates="execution", uselist=False)
    rollback = relationship("RollbackSnapshot", back_populates="execution", uselist=False)

class ApprovalRequest(Base):
    __tablename__ = "approvals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("tool_executions.id"), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED, EXPIRED
    reason = Column(Text, nullable=True)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    execution = relationship("ToolExecution", back_populates="approval")
    approver = relationship("User", back_populates="approvals")

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("tool_executions.id"), nullable=False)
    risk_score = Column(Float, nullable=False)
    explanation = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    execution = relationship("ToolExecution", back_populates="risk_assessment")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("mcp_clients.id"), nullable=False)
    tool_name = Column(String(100), nullable=False)
    arguments_hash = Column(String(64)) # SHA256 of args payload
    risk_score = Column(Float)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String(50))
    previous_hash = Column(String(64), nullable=False)
    row_hash = Column(String(64), nullable=False)

class RollbackSnapshot(Base):
    __tablename__ = "rollback_snapshots"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("tool_executions.id"), nullable=False)
    snapshot_type = Column(String(50)) # docker_image, postgres_dump, git_commit, directory_backup
    snapshot_target = Column(String(255)) # path or docker image tag
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_rolled_back = Column(Boolean, default=False)
    rolled_back_at = Column(DateTime, nullable=True)
    
    execution = relationship("ToolExecution", back_populates="rollback")
```

---

## 11. API Endpoint Specifications (FastAPI)

All endpoints reside under `/api/v1` and require authentication.

### Endpoint Catalog

- **`POST /api/v1/auth/login`**
  - **Description**: Authenticate dashboard users. Returns JWT access token.
  - **Payload**: `{ "email": "...", "password": "..." }`
  - **Response**: `{ "access_token": "...", "token_type": "bearer" }`

- **`GET /api/v1/tools`**
  - **Description**: Get all registered tools for the authenticated client.
  - **Response**: List of tool schemas.

- **`POST /api/v1/executions`**
  - **Description**: Trigger tool execution. Evaluates policies and risk.
  - **Payload**:
    ```json
    {
      "tool_name": "restart_service",
      "arguments": { "service_name": "nginx" },
      "environment": "production"
    }
    ```
  - **Responses**:
    - **`200 OK` (Auto-executed)**: Returns command output execution.
    - **`202 Accepted` (Approval Required)**: Returns `{ "status": "PENDING_APPROVAL", "approval_id": "UUID", "approval_url": "https://..." }`.
    - **`403 Forbidden`**: Blocked by policy.

- **`GET /api/v1/approvals`**
  - **Description**: Lists pending and resolved approvals. Filterable by status.

- **`POST /api/v1/approvals/{approval_id}/decide`**
  - **Description**: Approve or reject a request.
  - **Payload**: `{ "decision": "APPROVED" | "REJECTED", "reason": "Reason for decision" }`

- **`GET /api/v1/audit`**
  - **Description**: Query cryptographic audit trail logs. Supports CSV exports.

- **`POST /api/v1/clients`**
  - **Description**: Registers a new MCP client. Returns API key.

---

## 12. Production Deployment & Telemetry

### Infrastructure Stack (Docker Compose)
We orchestrate our dev/prod infrastructure via `docker-compose.yml` to bundle:
1. **API Backend**: FastAPI application container.
2. **Web Dashboard**: Next.js compiled frontend container.
3. **Database**: PostgreSQL database container.
4. **Caching & Queue**: Redis container.
5. **Observability**: Prometheus, Grafana, and OpenTelemetry collector to monitor service latencies, execution counts, risk warnings, and engine failures.

### Production Hardening Checklist
- [ ] Enforce strict TLS 1.3 on all endpoint routers.
- [ ] Implement Redis rate limiting to prevent denial of service (DoS) attacks on endpoints.
- [ ] Mount Docker sockets `/var/run/docker.sock` to the backend *only* under a restricted group scope.
- [ ] Verify that the database executes daily backups and matches encryption-at-rest.
- [ ] Set `SAFEOPS_API_TOKEN` keys to high-entropy randomly generated values.
- [ ] Configure alert-manager hooks to notify SREs immediately if the audit log SHA256 chain breaks.
