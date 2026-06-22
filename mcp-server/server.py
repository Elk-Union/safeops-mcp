import asyncio
import os
import sys
import requests
from typing import Dict, Any, List
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

# Load environment configuration
BACKEND_URL = os.getenv("SAFEOPS_BACKEND_URL", "http://localhost:8000").rstrip("/")
API_TOKEN = os.getenv("SAFEOPS_API_TOKEN", "")

# Verify token presence
if not API_TOKEN:
    print("[SafeOps MCP warning] SAFEOPS_API_TOKEN is not set. MCP server will run with restricted access.", file=sys.stderr)

server = Server("safeops-mcp-server")

def fetch_allowed_tools() -> List[Dict[str, Any]]:
    """
    Fetches the dynamically allowed tools for this client from the API backend.
    """
    if not API_TOKEN:
        return []
    try:
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        url = f"{BACKEND_URL}/api/v1/tools/client-catalog"
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"[SafeOps MCP error] Failed to fetch tools catalog. API status code: {response.status_code}", file=sys.stderr)
            return []
    except Exception as e:
        print(f"[SafeOps MCP error] Connection to backend failed: {str(e)}", file=sys.stderr)
        return []

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """
    Lists the dynamic catalog of tools allowed for this agent.
    """
    print("[SafeOps MCP] Fetching dynamic tools catalog...", file=sys.stderr)
    tools_data = fetch_allowed_tools()
    
    mcp_tools = []
    
    # Fallback tool in case connection fails so the server registers successfully
    if not tools_data:
        mcp_tools.append(
            types.Tool(
                name="safeops_diagnostic",
                description="Checks connection health between MCP server and SafeOps API backend.",
                inputSchema={"type": "object", "properties": {}}
            )
        )
        return mcp_tools

    for tool in tools_data:
        # Build Schema properties dynamically
        properties = {}
        required = []
        
        # Define schemas based on tool names
        if tool["name"] == "update_package" or tool["name"] == "remove_package":
            properties["package_name"] = {
                "type": "string",
                "description": "The name of the package to install or remove."
            }
            required.append("package_name")
        elif tool["name"] in ["start_service", "stop_service", "restart_service", "service_status"]:
            properties["service_name"] = {
                "type": "string",
                "description": "The systemd or docker service name."
            }
            required.append("service_name")
        elif tool["name"] == "traverse_documentation":
            properties["url"] = {
                "type": "string",
                "description": "The URL of the documentation or guide page to parse."
            }
            required.append("url")
        elif tool["name"] == "simulate_install":
            properties["commands"] = {
                "type": "array",
                "items": {"type": "string"},
                "description": "A list of installation setup commands to dry-run."
            }
            required.append("commands")
            properties["target_dir"] = {
                "type": "string",
                "description": "Optional configuration directory target (e.g. '~/.config/nvim') to backup."
            }

        # Inject standard target_dir parameter for tools supporting rollbacks
        if tool["rollback_available"] and "target_dir" not in properties:
            properties["target_dir"] = {
                "type": "string",
                "description": "Path to the configuration folder (e.g. '~/.config/nvim') to snapshot before changes."
            }

        mcp_tools.append(
            types.Tool(
                name=tool["name"],
                description=tool["description"] or "Managed administrative operation.",
                inputSchema={
                    "type": "object",
                    "properties": properties,
                    "required": required
                }
            )
        )
        
    return mcp_tools

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
    """
    Relays tool call execution requests to the API backend /api/v1/executions.
    """
    print(f"[SafeOps MCP] Intercepted call to '{name}' with arguments {arguments}", file=sys.stderr)
    
    if name == "safeops_diagnostic":
        tools = fetch_allowed_tools()
        status = "healthy" if tools else "unreachable"
        return [
            types.TextContent(
                type="text",
                text=f"SafeOps Backend URL: {BACKEND_URL}\nConnection status: {status}\nDynamic tools count: {len(tools)}."
            )
        ]

    if not API_TOKEN:
        return [
            types.TextContent(
                type="text",
                text="Error: SafeOps MCP token is missing. Please configure SAFEOPS_API_TOKEN environment variable."
            )
        ]

    try:
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        payload = {
            "tool_name": name,
            "arguments": arguments or {},
            "environment": "production" # Default to production environment context for strict compliance checking
        }
        
        url = f"{BACKEND_URL}/api/v1/executions"
        response = requests.post(url, json=payload, headers=headers, timeout=35) # High timeout for sandbox setup runtimes
        
        if response.status_code == 200:
            result = response.json()
            stdout = result.get("stdout", "")
            stderr = result.get("stderr", "")
            exit_code = result.get("exit_code", 0)
            
            output = f"Execution result for '{name}':\n"
            if stdout:
                output += f"\n--- STDOUT ---\n{stdout}\n"
            if stderr:
                output += f"\n--- STDERR ---\n{stderr}\n"
            output += f"\nExit code: {exit_code}"
            
            return [types.TextContent(type="text", text=output)]
            
        elif response.status_code == 202:
            # Requires approval
            result = response.json()
            message = (
                f"⚠️ [PENDING APPROVAL] The request to run '{name}' has a risk score of "
                f"{result.get('risk_score')} and requires administrator authorization. "
                f"Please review and approve the request here: {result.get('approval_url')}\n"
                f"Once approved, you can continue the task."
            )
            return [types.TextContent(type="text", text=message)]
            
        elif response.status_code == 403:
            return [types.TextContent(type="text", text="❌ [SECURITY DENIED] This action violates current system administration policies.")]
        else:
            error_detail = response.json().get("detail", "Unknown backend error.")
            return [types.TextContent(type="text", text=f"Error executing command: {error_detail}")]
            
    except Exception as e:
        return [types.TextContent(type="text", text=f"MCP relay exception: {str(e)}")]

async def main():
    print("[SafeOps MCP] Starting stdio server channel...", file=sys.stderr)
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="safeops",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=types.NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
