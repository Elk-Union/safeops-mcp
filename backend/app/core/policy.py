from sqlalchemy.orm import Session
from ipaddress import ip_address, ip_network
from typing import Dict, Any, Optional
import datetime
from ..models import PolicyRule, MCPTool, ClientRegistry

class PolicyEngine:
    @staticmethod
    def evaluate_ip(client_ip: str, whitelist_cidr: Optional[str]) -> bool:
        """
        Validates if the client's source IP fits within CIDR networks.
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
    def evaluate_time_constraint(rules_json: Optional[Dict[str, Any]]) -> bool:
        """
        Validates if the current UTC hour falls within the allowed operations window.
        """
        if not rules_json:
            return True
        allowed_hours = rules_json.get("allowed_hours") # e.g. {"start": 8, "end": 20}
        if not allowed_hours:
            return True
        current_hour = datetime.datetime.utcnow().hour
        start = allowed_hours.get("start", 0)
        end = allowed_hours.get("end", 24)
        return start <= current_hour <= end

    @classmethod
    def evaluate_execution(
        cls, 
        db: Session, 
        client: ClientRegistry, 
        tool: MCPTool, 
        environment: str, 
        arguments: Dict[str, Any],
        client_ip: str
    ) -> str:
        """
        Resolves if the tool execution is allowed.
        Returns: "allow", "deny", or "approval_required"
        """
        # 1. Enforce IP Whitelist Check
        if client.ip_whitelist and not cls.evaluate_ip(client_ip, client.ip_whitelist):
            return "deny"

        # 2. Query Policies matching Role and Tool
        policies = db.query(PolicyRule).filter(
            PolicyRule.role_id == client.role_id,
            PolicyRule.tool_id == tool.id
        ).all()

        if not policies:
            # Zero-trust fallback: Deny if no explicit policy is registered
            return "deny"

        # Find the most specific policy rule matching the environment
        # Specific environment match takes precedence over wildcard '*'
        matched_policy = None
        for policy in policies:
            if policy.environment.lower() == environment.lower():
                matched_policy = policy
                break
        
        if not matched_policy:
            for policy in policies:
                if policy.environment == "*":
                    matched_policy = policy
                    break
        
        if not matched_policy:
            return "deny"

        # 3. Check Time Constraint
        rules_json = matched_policy.rules_json
        if not cls.evaluate_time_constraint(rules_json):
            return "deny"

        # 4. Check Argument constraints if defined in rules_json
        # E.g. {"arguments_restrictions": {"service_name": {"allowed_values": ["nginx", "redis"]}}}
        if rules_json and "arguments_restrictions" in rules_json:
            restrictions = rules_json["arguments_restrictions"]
            for arg_key, restriction in restrictions.items():
                if arg_key in arguments:
                    val = arguments[arg_key]
                    allowed = restriction.get("allowed_values")
                    denied = restriction.get("denied_values")
                    if allowed and val not in allowed:
                        return "deny"
                    if denied and val in denied:
                        return "deny"

        return matched_policy.effect.lower()
