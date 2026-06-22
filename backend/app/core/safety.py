import re
from typing import Dict, Any, List, Tuple

class SafetyClassifier:
    # Destructive keywords or utilities commonly used in exploits
    SHELL_INJECTION_PATS = [
        re.compile(r"[;`$&|]"), # command chaining characters
        re.compile(r"\$\(.*?\)"), # subshells
        re.compile(r"eval\b"),
        re.compile(r"exec\b")
    ]
    
    PATH_TRAVERSAL_PAT = re.compile(r"\.\./")
    
    EXFILTRATION_PATS = [
        re.compile(r"/etc/shadow"),
        re.compile(r"/etc/passwd"),
        re.compile(r"\.env"),
        re.compile(r"id_rsa"),
        re.compile(r"curl\s+.*?https?://[a-zA-Z0-9.\-]+/?") # external exfiltration curls
    ]

    @classmethod
    def sanitize_arguments(cls, arguments: Dict[str, Any]) -> None:
        """
        Scans arguments for command injection or exfiltration attempts.
        Raises ValueError if a malicious signature is identified.
        """
        for key, val in arguments.items():
            if isinstance(val, str):
                # 1. Check for command injection chaining characters
                for pat in cls.SHELL_INJECTION_PATS:
                    if pat.search(val):
                        raise ValueError(f"Malicious characters identified in argument '{key}'. Execution blocked.")
                
                # 2. Check for path traversal attempts
                if cls.PATH_TRAVERSAL_PAT.search(val):
                    raise ValueError(f"Path traversal attempt identified in argument '{key}'. Execution blocked.")
                
                # 3. Check for credentials file exfiltrations
                for pat in cls.EXFILTRATION_PATS:
                    if pat.search(val):
                        raise ValueError(f"Credential exposure risk flagged in argument '{key}'. Execution blocked.")
            elif isinstance(val, list):
                # Recursively check lists of arguments
                for item in val:
                    if isinstance(item, str):
                        cls.sanitize_arguments({key: item})

    @classmethod
    def classify_intent(cls, tool_name: str, arguments: Dict[str, Any]) -> Tuple[str, str]:
        """
        Categorizes execution intent: "safe", "caution", "dangerous", "critical"
        Returns a tuple: (category, rationale)
        """
        # Run sanitation first
        try:
            cls.sanitize_arguments(arguments)
        except ValueError as ve:
            return "critical", str(ve)

        # Categorize based on tool names and arguments
        # Read-only indicators
        read_only_tools = ["get_uptime", "cpu_usage", "ram_usage", "disk_usage", "system_health", "package_info", "service_status", "docker_ps", "docker_stats", "docker_logs", "deployment_status", "postgres_status", "workflow_status"]
        if tool_name in read_only_tools:
            return "safe", "Read-only system diagnostic operation."

        # Caution level (State modifications that are simple to revert)
        caution_tools = ["start_service", "restart_service", "docker_restart", "check_updates"]
        if tool_name in caution_tools:
            return "caution", "Minor service state modification."

        # Dangerous level (Installs, updates, deletions, deployments)
        dangerous_tools = ["update_package", "remove_package", "stop_service", "deploy_fastapi", "rollback_fastapi", "restart_n8n", "backup_database", "simulate_install"]
        if tool_name in dangerous_tools:
            # Check if arguments modify critical apps
            service_name = arguments.get("service_name", "").lower()
            if service_name in ["db", "postgresql", "mysql", "nginx"]:
                return "dangerous", "Modifying core backend databases or network routers."
            return "dangerous", "Software installation, removal, or application deployment."

        # Critical level (Kernel upgrades, restorations, database wipes)
        critical_tools = ["restore_database", "restart_deployment"]
        if tool_name in critical_tools:
            return "critical", "Potential data loss or service disruption hazard."

        # Fallback default
        return "dangerous", "Unclassified operational task."
