# SafeOps MCP Startup & Setup Guide

This guide is designed for developers and AI agents (such as Claude Code, Cursor, or Windsurf) to automatically configure, initialize, and run the SafeOps MCP platform.

---

## 🐋 Docker Sandbox Prerequisite

SafeOps requires **Docker** to run system commands inside isolated sandbox containers. If Docker is not running, SafeOps will run in restricted local fallback mode.

### Setup Docker on Arch Linux:
```bash
# 1. Install Docker package
sudo pacman -S --noconfirm docker

# 2. Start and enable Docker service
sudo systemctl enable --now docker

# 3. Grant access permissions to the socket
sudo usermod -aG docker $USER
# Or temporarily grant permissions to the socket for the current session:
sudo chmod 666 /var/run/docker.sock
```

### Setup Docker on Ubuntu/Debian:
```bash
# 1. Install Docker
sudo apt-get update && sudo apt-get install -y docker.io

# 2. Start and enable service
sudo systemctl enable --now docker

# 3. Grant socket permissions
sudo usermod -aG docker $USER
sudo chmod 666 /var/run/docker.sock
```

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

---

## 🛠️ Troubleshooting & Error Resolutions

Here are common error states you may encounter during setup and how to resolve them:

### 1. Port Conflict (`Address already in use`)
* **Error**: `OSError: [Errno 98] Address already in use` (for port 8000 or 3000).
* **Cause**: Another process is already running on the required port.
* **Resolution**: Identify the process using the port and terminate it:
  ```bash
  # Identify and kill process on port 8000 (FastAPI)
  lsof -t -i:8000 | xargs kill -9
  
  # Identify and kill process on port 3000 (Next.js)
  lsof -t -i:3000 | xargs kill -9
  ```

### 2. Docker Permission Denied in Sandbox
* **Error**: `docker.errors.DockerException: Error while fetching server API version: Permission denied`
* **Cause**: The current user running the backend process does not have permission to access the Docker daemon socket (`/var/run/docker.sock`).
* **Resolution**: Add the current user to the `docker` group, then log out and log back in:
  ```bash
  sudo usermod -aG docker $USER
  ```
  Alternatively, ensure the Docker daemon is actually running:
  ```bash
  sudo systemctl start docker
  ```

### 3. Module Import Errors (`ModuleNotFoundError`)
* **Error**: `ModuleNotFoundError: No module named 'app'`
* **Cause**: Running python commands from outside the `backend/` directory without setting the python path.
* **Resolution**: Always navigate to the `backend` directory before running scripts, or prepend the directory path:
  ```bash
  cd backend
  PYTHONPATH=. python3 app/main.py
  ```

### 4. Database Lock Errors
* **Error**: `sqlite3.OperationalError: database is locked`
* **Cause**: Multiple python processes or uvicorn threads are writing to the SQLite database concurrently, causing locking.
* **Resolution**: Terminate hanging python processes:
  ```bash
  pkill -f uvicorn
  pkill -f python
  ```

### 5. Infinite Login Redirect Loops
* **Error**: Inputting correct login credentials instantly redirects you back to the `/login` view without showing the dashboard.
* **Cause**: The Next.js dev server proxy and FastAPI trailing slash redirect rules are clashing, stripping the `Authorization` header during a `307/308` redirect chain.
* **Resolution**: Ensure the frontend is calling the absolute backend URL (`http://localhost:8000/api/v1/...`) directly, bypassing Next.js trailing slash rewrites. Verify the backend CORS allows requests from `http://localhost:3000`.

