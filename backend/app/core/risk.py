from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Dict, Any
from ..models import ToolExecution, MCPTool

class RiskEngine:
    @staticmethod
    def calculate_historical_failure_rate(db: Session, tool_name: str) -> float:
        """
        Calculate failure rate (failed runs / total runs) in the last 30 days.
        """
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        # Get count of total runs
        total_runs = db.query(func.count(ToolExecution.id)).join(MCPTool).filter(
            MCPTool.name == tool_name,
            ToolExecution.created_at >= thirty_days_ago
        ).scalar() or 0

        if total_runs == 0:
            return 0.0

        # Get count of failed runs
        failed_runs = db.query(func.count(ToolExecution.id)).join(MCPTool).filter(
            MCPTool.name == tool_name,
            ToolExecution.created_at >= thirty_days_ago,
            ToolExecution.status == "FAILED"
        ).scalar() or 0
        
        # Calculate failure rate capped at 0.5 (max 50% risk modifier)
        failure_rate = failed_runs / total_runs
        return min(0.5, failure_rate)

    @classmethod
    def assess_risk(cls, db: Session, tool: MCPTool, environment: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs the dynamic risk evaluation.
        Formula: Risk = Min(10.0, Base * EnvMultiplier * (1.0 + HistFailureRate) * SystemCriticality)
        """
        base_risk = tool.base_risk
        
        # Environment multiplier
        env_multipliers = {
            "development": 0.5,
            "staging": 1.0,
            "production": 2.0
        }
        m_env = env_multipliers.get(environment.lower(), 1.0)
        
        # Historical failure rate
        f_history = cls.calculate_historical_failure_rate(db, tool.name)
        
        # System criticality (e.g. check if argument specifies critical target like db/prod databases)
        # We can scan the arguments to increase weight if target resources are highly sensitive
        w_system = 1.0
        critical_keywords = ["postgres", "db", "production-db", "prod-database", "k8s-prod", "nginx-ingress"]
        
        for arg_val in arguments.values():
            if isinstance(arg_val, str):
                if any(kw in arg_val.lower() for kw in critical_keywords):
                    w_system = 1.25 # 25% increase for touching core infrastructure
                    break
        
        # Calculate raw and capped score
        raw_score = base_risk * m_env * (1.0 + f_history) * w_system
        risk_score = min(10.0, round(raw_score, 2))
        
        # Build explanation string
        explanation_parts = [
            f"Base risk for '{tool.name}' is {base_risk}.",
            f"Environment is '{environment}' ({m_env}x multiplier)."
        ]
        if f_history > 0.0:
            explanation_parts.append(f"Recent failures index is {f_history:.1%}.")
        if w_system > 1.0:
            explanation_parts.append(f"Identified critical system context ({w_system}x weight).")
            
        explanation = " ".join(explanation_parts)
        
        return {
            "risk_score": risk_score,
            "explanation": explanation
        }
