# SafeOps MCP Startup & Setup Guide

This guide is designed for developers and AI agents (such as Claude Code, Cursor, or Windsurf) to automatically configure, initialize, and run the SafeOps MCP platform.

---

## 🛠️ Automated Setup Steps

Follow these steps in sequence to set up the backend database, seed defaults, register an operator agent, and install dependencies.

### Step 1: Initialize the Backend Database
Run the following commands to create the Python virtual environment for the backend, install requirements, and run the automated database initialization script.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 init_system.py
```

*Note: The `init_system.py` script creates database tables, seeds roles and administrator credentials, registers a default agent client, maps default allow policies for all 16 tools, and outputs the plaintext `SAFEOPS_API_TOKEN`.*

### Step 2: Set Up the MCP Server Environment
Configure the Python virtual environment for the stdio MCP bridge.

```bash
cd ../mcp-server
python3 -m venv .venv
source .venv/bin/activate
pip install mcp requests
```

### Step 3: Install Frontend Dependencies
Install Next.js dependencies for the administrative dashboard.

```bash
cd ../frontend
npm install --legacy-peer-deps
```

---

## 🚀 Running the Platform

Once the installation is complete, open separate terminal windows or run background tasks to start the FastAPI backend and Next.js frontend.

### 1. Start the Backend API (Port 8000)
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the Frontend Dashboard (Port 3000)
```bash
cd frontend
npm run dev
```

---

## 🔌 Configuring Your AI Agent (MCP Client Config)

To connect your editor agent (e.g. Claude Code or Cursor) to the running SafeOps MCP server, add the following configuration block to your agent's configuration file.

* **Claude Code Config Path**: `~/.config/claude/claude_code_config.json`
* **Cursor Config Path**: Add under settings → Models → MCP.

### Configuration Template
Replace `/path/to/safeops-mcp` with the absolute path to this repository and `<SAFEOPS_API_TOKEN>` with the token generated during **Step 1**.

```json
{
  "mcpServers": {
    "safeops": {
      "command": "/path/to/safeops-mcp/mcp-server/.venv/bin/python",
      "args": ["/path/to/safeops-mcp/mcp-server/server.py"],
      "env": {
        "SAFEOPS_API_TOKEN": "<SAFEOPS_API_TOKEN>",
        "SAFEOPS_BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

---

## 🔒 Verification

1. **Dashboard Check**: Open `http://localhost:3000`, log in using `admin@safeops.io` and password `safeops-admin`. Verify that stats are populated and the 16 tools are listed.
2. **Audit Check**: Run an agent command and confirm the execution record appears on the overview page.
