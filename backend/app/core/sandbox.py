import os
import subprocess
import tempfile
import time
from typing import Dict, Any, List
from ..config import settings

# Attempt to import docker SDK, fail gracefully if not installed/configured
try:
    import docker
except ImportError:
    docker = None

class SandboxExecutor:
    def __init__(self, image: str = settings.SANDBOX_DOCKER_IMAGE, timeout: int = settings.SANDBOX_TIMEOUT_SECONDS):
        self.image = image
        self.timeout = timeout
        self.client = None
        
        if docker:
            try:
                self.client = docker.from_env()
            except Exception:
                # Docker daemon not running or socket permissions missing
                self.client = None

    def execute_in_docker(self, cmd_args: List[str], env: Dict[str, str], read_only_root: bool) -> Dict[str, Any]:
        """
        Executes command in a transient Docker container with CPU, Memory, and Network restrictions.
        """
        if not self.client:
            raise RuntimeError("Docker daemon is unreachable.")

        # Create temporary host directory to mount for writing output
        with tempfile.TemporaryDirectory() as tmp_dir:
            try:
                # Create transient container
                container = self.client.containers.create(
                    image=self.image,
                    command=cmd_args,
                    environment=env or {},
                    network_mode="none",             # Isolates network exfiltrations
                    mem_limit="512m",                # Cap memory at 512MB
                    nano_cpus=500000000,            # Cap CPU at 0.5 cores
                    read_only=read_only_root,        # Mount root as read-only
                    volumes={
                        tmp_dir: {"bind": "/workspace", "mode": "rw"}
                    },
                    working_dir="/workspace",
                    user="1000:1000"                 # Run as non-root user (1000)
                )

                container.start()
                
                # Await completion with timeout
                result = container.wait(timeout=self.timeout)
                exit_code = result.get("StatusCode", -1)

                # Fetch log output streams
                stdout = container.logs(stdout=True, stderr=False).decode("utf-8")
                stderr = container.logs(stdout=False, stderr=True).decode("utf-8")

                # Remove container
                container.remove(force=True)

                return {
                    "exit_code": exit_code,
                    "stdout": stdout,
                    "stderr": stderr,
                    "error": None
                }
            except Exception as e:
                # Safely clean up if container exists
                try:
                    container.remove(force=True)
                except Exception:
                    pass
                return {
                    "exit_code": -1,
                    "stdout": "",
                    "stderr": "",
                    "error": f"Docker Sandbox Error: {str(e)}"
                }

    def execute_in_local_fallback(self, cmd_args: List[str], env: Dict[str, str]) -> Dict[str, Any]:
        """
        Fallback command execution using systemd-run or low-privilege subprocess if Docker is unavailable.
        """
        # Formulate low-privilege running command. If systemd-run is available, use cgroup constraints.
        has_systemd_run = subprocess.call(["which", "systemd-run"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0
        
        # Prepare environment copy
        proc_env = os.environ.copy()
        if env:
            proc_env.update(env)

        # Clear proxy settings to restrict network exfiltrations locally
        for k in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
            proc_env.pop(k, None)

        if has_systemd_run:
            # Wrap execution via systemd-run with CPU/Memory limits and run as uid 1000 (usually non-root developer)
            systemd_prefix = [
                "systemd-run", 
                "--scope", 
                "--quiet",
                "-p", "MemoryMax=512M", 
                "-p", "CPUQuota=50%",
                "--uid=1000",
                "--gid=1000"
            ]
            run_cmd = systemd_prefix + cmd_args
        else:
            # Standard subprocess fallback, runs under standard user limits (without systemd cgroup capping)
            run_cmd = cmd_args

        try:
            # Execute command synchronously with timeout
            proc = subprocess.run(
                run_cmd,
                env=proc_env,
                capture_output=True,
                text=True,
                timeout=self.timeout
            )
            return {
                "exit_code": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "error": None
            }
        except subprocess.TimeoutExpired as te:
            return {
                "exit_code": -1,
                "stdout": te.stdout or "",
                "stderr": te.stderr or "Process execution timed out.",
                "error": "TimeoutExpired"
            }
        except Exception as e:
            return {
                "exit_code": -1,
                "stdout": "",
                "stderr": "",
                "error": f"Local Sandbox Error: {str(e)}"
            }

    def execute(self, cmd_args: List[str], env: Dict[str, str] = None, read_only_root: bool = True) -> Dict[str, Any]:
        """
        Execute command with sandbox routing (Docker -> Systemd -> Local subprocess).
        """
        if self.client:
            return self.execute_in_docker(cmd_args, env, read_only_root)
        else:
            return self.execute_in_local_fallback(cmd_args, env)
