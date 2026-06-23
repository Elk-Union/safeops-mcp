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

    def execute_in_docker(self, cmd_args: List[str], env: Dict[str, str], read_only_root: bool, log_filepath: str = None) -> Dict[str, Any]:
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
                
                # Write initial empty file or make sure directory exists
                if log_filepath:
                    os.makedirs(os.path.dirname(log_filepath), exist_ok=True)
                    with open(log_filepath, "w", encoding="utf-8") as f:
                        f.write("")

                # Poll logs in a loop while container runs
                start_time = time.time()
                while True:
                    container.reload()
                    status = container.status
                    
                    if log_filepath:
                        try:
                            # Fetch current log buffer and write to the file
                            logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="ignore")
                            with open(log_filepath, "w", encoding="utf-8") as f:
                                f.write(logs)
                        except Exception:
                            pass
                    
                    if status != "running":
                        break
                        
                    if time.time() - start_time > self.timeout:
                        try:
                            container.kill()
                        except Exception:
                            pass
                        raise TimeoutError("Docker container execution timed out.")
                        
                    time.sleep(0.15)

                # Fetch final log output streams
                stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="ignore")
                stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="ignore")
                
                # Await completion to get exit status
                result = container.wait(timeout=2)
                exit_code = result.get("StatusCode", -1)

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

    def execute_in_local_fallback(self, cmd_args: List[str], env: Dict[str, str], log_filepath: str = None) -> Dict[str, Any]:
        """
        Fallback command execution using systemd-run or low-privilege subprocess if Docker is unavailable.
        """
        # Formulate low-privilege running command. If systemd-run is available, use cgroup constraints.
        has_systemd_run = subprocess.call(["which", "systemd-run"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0
        
        # Prepare environment copy
        proc_env = os.environ.copy()
        if env:
            proc_env.update(env)

        # Prepend the virtual environment bin directory to the subprocess PATH
        import sys
        venv_bin = os.path.dirname(sys.executable)
        if venv_bin:
            proc_env["PATH"] = venv_bin + os.path.pathsep + proc_env.get("PATH", "")

        # Resolve command arguments to absolute paths if they exist in the virtual environment bin folder
        if venv_bin and len(cmd_args) > 0:
            local_exe = os.path.join(venv_bin, cmd_args[0])
            if os.path.isfile(local_exe) and os.access(local_exe, os.X_OK):
                cmd_args = [local_exe] + cmd_args[1:]

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
            if log_filepath:
                os.makedirs(os.path.dirname(log_filepath), exist_ok=True)
                with open(log_filepath, "w", encoding="utf-8") as log_file:
                    proc = subprocess.run(
                        run_cmd,
                        env=proc_env,
                        stdout=log_file,
                        stderr=subprocess.STDOUT,
                        timeout=self.timeout
                    )
                with open(log_filepath, "r", encoding="utf-8") as log_file:
                    stdout_content = log_file.read()
                return {
                    "exit_code": proc.returncode,
                    "stdout": stdout_content,
                    "stderr": "",
                    "error": None
                }
            else:
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

    def execute(self, cmd_args: List[str], env: Dict[str, str] = None, read_only_root: bool = True, log_filepath: str = None) -> Dict[str, Any]:
        """
        Execute command with sandbox routing (Docker -> Systemd -> Local subprocess).
        """
        if self.client:
            return self.execute_in_docker(cmd_args, env, read_only_root, log_filepath)
        else:
            return self.execute_in_local_fallback(cmd_args, env, log_filepath)
