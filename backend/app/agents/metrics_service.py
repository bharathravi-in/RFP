"""
Agent Metrics Service

Provides comprehensive metrics, observability, and A/B testing for AI agents.
Enables performance tracking, prompt versioning, and experiment management.
"""
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of metrics tracked."""
    LATENCY = "latency"
    ACCURACY = "accuracy"
    CONFIDENCE = "confidence"
    TOKEN_USAGE = "token_usage"
    ERROR_RATE = "error_rate"
    FALLBACK_RATE = "fallback_rate"
    USER_EDIT_RATE = "user_edit_rate"


@dataclass
class AgentMetric:
    """Single metric data point."""
    agent_name: str
    metric_type: MetricType
    value: float
    timestamp: datetime
    org_id: int = None
    project_id: int = None
    metadata: Dict = None
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            "metric_type": self.metric_type.value,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class PromptVersion:
    """Tracks different versions of prompts for A/B testing."""
    agent_name: str
    version: str
    prompt_text: str
    created_at: datetime
    is_active: bool = True
    performance_score: float = 0.0
    sample_count: int = 0
    metadata: Dict = None


class AgentMetricsService:
    """
    Service for tracking and analyzing agent performance.
    
    Features:
    - Real-time metrics collection
    - Performance dashboards
    - A/B testing for prompts
    - Anomaly detection
    """
    
    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self._metrics_cache = []
        self._max_cache_size = 1000
        self._prompt_versions = {}
        self._experiments = {}
    
    # ===================
    # METRICS COLLECTION
    # ===================
    
    def record_metric(
        self,
        agent_name: str,
        metric_type: MetricType,
        value: float,
        project_id: int = None,
        metadata: Dict = None
    ) -> None:
        """Record a single metric."""
        metric = AgentMetric(
            agent_name=agent_name,
            metric_type=metric_type,
            value=value,
            timestamp=datetime.utcnow(),
            org_id=self.org_id,
            project_id=project_id,
            metadata=metadata or {}
        )
        
        self._metrics_cache.append(metric)
        
        # Trim cache if too large
        if len(self._metrics_cache) > self._max_cache_size:
            self._metrics_cache = self._metrics_cache[-self._max_cache_size:]
        
        # Persist to database (async in production)
        self._persist_metric(metric)
    
    def record_agent_call(
        self,
        agent_name: str,
        start_time: datetime,
        success: bool,
        confidence: float = None,
        used_fallback: bool = False,
        tokens_used: int = None,
        project_id: int = None
    ) -> None:
        """Record complete agent call with all metrics."""
        end_time = datetime.utcnow()
        latency = (end_time - start_time).total_seconds() * 1000  # ms
        
        self.record_metric(agent_name, MetricType.LATENCY, latency, project_id)
        
        if confidence is not None:
            self.record_metric(agent_name, MetricType.CONFIDENCE, confidence, project_id)
        
        if not success:
            self.record_metric(agent_name, MetricType.ERROR_RATE, 1.0, project_id)
        else:
            self.record_metric(agent_name, MetricType.ERROR_RATE, 0.0, project_id)
        
        if used_fallback:
            self.record_metric(agent_name, MetricType.FALLBACK_RATE, 1.0, project_id)
        else:
            self.record_metric(agent_name, MetricType.FALLBACK_RATE, 0.0, project_id)
        
        if tokens_used:
            self.record_metric(agent_name, MetricType.TOKEN_USAGE, float(tokens_used), project_id)
    
    # ===================
    # DASHBOARD QUERIES
    # ===================
    
    def get_agent_summary(
        self,
        agent_name: str = None,
        hours_back: int = 24
    ) -> Dict:
        """Get summary metrics for agent(s)."""
        cutoff = datetime.utcnow() - timedelta(hours=hours_back)
        
        # Filter metrics
        relevant = [
            m for m in self._metrics_cache
            if m.timestamp >= cutoff and (agent_name is None or m.agent_name == agent_name)
        ]
        
        if not relevant:
            return {"message": "No metrics found", "agents": {}}
        
        # Group by agent
        by_agent = {}
        for m in relevant:
            if m.agent_name not in by_agent:
                by_agent[m.agent_name] = []
            by_agent[m.agent_name].append(m)
        
        summaries = {}
        for agent, metrics in by_agent.items():
            summaries[agent] = self._calculate_agent_stats(metrics)
        
        return {
            "period_hours": hours_back,
            "total_calls": len(relevant),
            "agents": summaries
        }
    
    def _calculate_agent_stats(self, metrics: List[AgentMetric]) -> Dict:
        """Calculate statistics for an agent's metrics."""
        stats = {
            "total_calls": 0,
            "avg_latency_ms": 0,
            "avg_confidence": 0,
            "error_rate": 0,
            "fallback_rate": 0,
            "total_tokens": 0
        }
        
        latencies = []
        confidences = []
        errors = []
        fallbacks = []
        tokens = []
        
        for m in metrics:
            if m.metric_type == MetricType.LATENCY:
                latencies.append(m.value)
                stats["total_calls"] += 1
            elif m.metric_type == MetricType.CONFIDENCE:
                confidences.append(m.value)
            elif m.metric_type == MetricType.ERROR_RATE:
                errors.append(m.value)
            elif m.metric_type == MetricType.FALLBACK_RATE:
                fallbacks.append(m.value)
            elif m.metric_type == MetricType.TOKEN_USAGE:
                tokens.append(m.value)
        
        if latencies:
            stats["avg_latency_ms"] = round(sum(latencies) / len(latencies), 2)
            stats["p95_latency_ms"] = round(sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0, 2)
        
        if confidences:
            stats["avg_confidence"] = round(sum(confidences) / len(confidences), 3)
        
        if errors:
            stats["error_rate"] = round(sum(errors) / len(errors), 3)
        
        if fallbacks:
            stats["fallback_rate"] = round(sum(fallbacks) / len(fallbacks), 3)
        
        if tokens:
            stats["total_tokens"] = int(sum(tokens))
            stats["avg_tokens_per_call"] = round(sum(tokens) / len(tokens), 0)
        
        return stats
    
    def get_performance_dashboard(self) -> Dict:
        """Get complete performance dashboard data."""
        summary_24h = self.get_agent_summary(hours_back=24)
        summary_1h = self.get_agent_summary(hours_back=1)
        
        # Identify issues
        alerts = []
        for agent, stats in summary_1h.get("agents", {}).items():
            if stats.get("error_rate", 0) > 0.1:
                alerts.append({
                    "agent": agent,
                    "type": "high_error_rate",
                    "value": stats["error_rate"],
                    "severity": "critical" if stats["error_rate"] > 0.25 else "warning"
                })
            if stats.get("fallback_rate", 0) > 0.3:
                alerts.append({
                    "agent": agent,
                    "type": "high_fallback_rate",
                    "value": stats["fallback_rate"],
                    "severity": "warning"
                })
            if stats.get("avg_latency_ms", 0) > 5000:
                alerts.append({
                    "agent": agent,
                    "type": "high_latency",
                    "value": stats["avg_latency_ms"],
                    "severity": "warning"
                })
        
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "summary_24h": summary_24h,
            "summary_1h": summary_1h,
            "alerts": alerts,
            "active_experiments": list(self._experiments.keys())
        }
    
    # ===================
    # A/B TESTING
    # ===================
    
    def register_prompt_version(
        self,
        agent_name: str,
        version: str,
        prompt_text: str,
        is_active: bool = True
    ) -> PromptVersion:
        """Register a new prompt version for A/B testing."""
        pv = PromptVersion(
            agent_name=agent_name,
            version=version,
            prompt_text=prompt_text,
            created_at=datetime.utcnow(),
            is_active=is_active
        )
        
        key = f"{agent_name}:{version}"
        self._prompt_versions[key] = pv
        
        logger.info(f"Registered prompt version: {key}")
        return pv
    
    def get_prompt_for_experiment(
        self,
        agent_name: str,
        experiment_id: str = None
    ) -> Optional[str]:
        """Get appropriate prompt for A/B experiment."""
        if experiment_id and experiment_id in self._experiments:
            exp = self._experiments[experiment_id]
            if exp.get("agent") == agent_name:
                # Simple 50/50 split for now
                import random
                variant = random.choice(["control", "treatment"])
                return exp.get(f"{variant}_prompt")
        
        # Return active prompt version
        active_versions = [
            pv for key, pv in self._prompt_versions.items()
            if pv.agent_name == agent_name and pv.is_active
        ]
        
        if active_versions:
            return active_versions[0].prompt_text
        
        return None
    
    def create_experiment(
        self,
        experiment_id: str,
        agent_name: str,
        control_version: str,
        treatment_version: str,
        traffic_split: float = 0.5
    ) -> Dict:
        """Create an A/B experiment."""
        control_key = f"{agent_name}:{control_version}"
        treatment_key = f"{agent_name}:{treatment_version}"
        
        if control_key not in self._prompt_versions:
            return {"error": f"Control version not found: {control_version}"}
        if treatment_key not in self._prompt_versions:
            return {"error": f"Treatment version not found: {treatment_version}"}
        
        self._experiments[experiment_id] = {
            "agent": agent_name,
            "control_version": control_version,
            "treatment_version": treatment_version,
            "control_prompt": self._prompt_versions[control_key].prompt_text,
            "treatment_prompt": self._prompt_versions[treatment_key].prompt_text,
            "traffic_split": traffic_split,
            "created_at": datetime.utcnow().isoformat(),
            "status": "active",
            "control_metrics": [],
            "treatment_metrics": []
        }
        
        logger.info(f"Created experiment: {experiment_id}")
        return {"success": True, "experiment_id": experiment_id}
    
    def record_experiment_result(
        self,
        experiment_id: str,
        variant: str,  # "control" or "treatment"
        success: bool,
        confidence: float = None,
        user_edited: bool = False
    ) -> None:
        """Record result for an experiment."""
        if experiment_id not in self._experiments:
            return
        
        result = {
            "success": success,
            "confidence": confidence,
            "user_edited": user_edited,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self._experiments[experiment_id][f"{variant}_metrics"].append(result)
    
    def get_experiment_results(self, experiment_id: str) -> Dict:
        """Get results for an experiment."""
        if experiment_id not in self._experiments:
            return {"error": "Experiment not found"}
        
        exp = self._experiments[experiment_id]
        
        control = exp.get("control_metrics", [])
        treatment = exp.get("treatment_metrics", [])
        
        def calc_stats(metrics):
            if not metrics:
                return {"count": 0}
            return {
                "count": len(metrics),
                "success_rate": sum(1 for m in metrics if m["success"]) / len(metrics),
                "avg_confidence": sum(m.get("confidence", 0) or 0 for m in metrics) / len(metrics),
                "edit_rate": sum(1 for m in metrics if m.get("user_edited")) / len(metrics)
            }
        
        control_stats = calc_stats(control)
        treatment_stats = calc_stats(treatment)
        
        # Determine winner
        winner = None
        if control_stats["count"] >= 10 and treatment_stats["count"] >= 10:
            control_score = control_stats["success_rate"] * (1 - control_stats.get("edit_rate", 0))
            treatment_score = treatment_stats["success_rate"] * (1 - treatment_stats.get("edit_rate", 0))
            
            if treatment_score > control_score * 1.05:  # 5% improvement threshold
                winner = "treatment"
            elif control_score > treatment_score * 1.05:
                winner = "control"
            else:
                winner = "no_significant_difference"
        
        return {
            "experiment_id": experiment_id,
            "agent": exp.get("agent"),
            "status": exp.get("status"),
            "control": control_stats,
            "treatment": treatment_stats,
            "winner": winner,
            "recommendation": f"Use {winner} version" if winner and winner != "no_significant_difference" else "Continue experiment"
        }
    
    # ===================
    # PERSISTENCE
    # ===================
    
    def _persist_metric(self, metric: AgentMetric) -> None:
        """Persist metric to database."""
        try:
            from app.models import AgentPerformance
            from app.extensions import db
            
            record = AgentPerformance(
                agent_name=metric.agent_name,
                metric_type=metric.metric_type.value,
                metric_value=metric.value,
                org_id=metric.org_id,
                project_id=metric.project_id,
                recorded_at=metric.timestamp,
                metadata=json.dumps(metric.metadata) if metric.metadata else None
            )
            db.session.add(record)
            db.session.commit()
        except ImportError:
            pass  # Model not available
        except Exception as e:
            logger.warning(f"Failed to persist metric: {e}")


# Singleton instance
_metrics_service = None

def get_metrics_service(org_id: int = None) -> AgentMetricsService:
    """Get or create metrics service instance."""
    global _metrics_service
    if _metrics_service is None:
        _metrics_service = AgentMetricsService(org_id=org_id)
    return _metrics_service
