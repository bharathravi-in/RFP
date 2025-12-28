"""
LLM Usage Tracking Model and Service

Tracks token usage and costs for LLM API calls.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, List
from sqlalchemy import func

from app import db


class LLMUsage(db.Model):
    """Model for tracking LLM API usage and costs."""
    
    __tablename__ = 'llm_usage'
    
    id = db.Column(db.Integer, primary_key=True)
    org_id = db.Column(db.Integer, db.ForeignKey('organization.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    # Request info
    agent_type = db.Column(db.String(50), nullable=False, index=True)
    provider = db.Column(db.String(50), nullable=False)
    model = db.Column(db.String(100), nullable=False)
    
    # Token counts
    prompt_tokens = db.Column(db.Integer, default=0)
    completion_tokens = db.Column(db.Integer, default=0)
    total_tokens = db.Column(db.Integer, default=0)
    
    # Cost tracking
    estimated_cost = db.Column(db.Numeric(10, 6), default=0)
    
    # Timing
    latency_ms = db.Column(db.Integer, nullable=True)
    
    # Metadata
    request_id = db.Column(db.String(100), nullable=True)
    success = db.Column(db.Boolean, default=True)
    error_message = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def __repr__(self):
        return f'<LLMUsage {self.id} {self.provider}/{self.model} {self.total_tokens} tokens>'


# Cost per 1K tokens (approximate, update as needed)
COST_PER_1K_TOKENS = {
    'gpt-4': {'input': 0.03, 'output': 0.06},
    'gpt-4-turbo': {'input': 0.01, 'output': 0.03},
    'gpt-4o': {'input': 0.005, 'output': 0.015},
    'gpt-4o-mini': {'input': 0.00015, 'output': 0.0006},
    'gpt-3.5-turbo': {'input': 0.0005, 'output': 0.0015},
    'claude-3-opus': {'input': 0.015, 'output': 0.075},
    'claude-3-sonnet': {'input': 0.003, 'output': 0.015},
    'claude-3-haiku': {'input': 0.00025, 'output': 0.00125},
    'gemini-1.5-pro': {'input': 0.00125, 'output': 0.005},
    'gemini-1.5-flash': {'input': 0.000075, 'output': 0.0003},
    'gemini-2.0-flash-exp': {'input': 0.0001, 'output': 0.0004},
}


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> Decimal:
    """
    Estimate cost for token usage.
    
    Args:
        model: Model name
        prompt_tokens: Number of input tokens
        completion_tokens: Number of output tokens
        
    Returns:
        Estimated cost in USD
    """
    # Find matching cost config
    costs = None
    model_lower = model.lower()
    for model_key, model_costs in COST_PER_1K_TOKENS.items():
        if model_key in model_lower:
            costs = model_costs
            break
    
    if not costs:
        # Default to GPT-4o-mini pricing
        costs = COST_PER_1K_TOKENS['gpt-4o-mini']
    
    input_cost = (prompt_tokens / 1000) * costs['input']
    output_cost = (completion_tokens / 1000) * costs['output']
    
    return Decimal(str(round(input_cost + output_cost, 6)))


def record_usage(
    org_id: int,
    agent_type: str,
    provider: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: int = None,
    user_id: int = None,
    request_id: str = None,
    success: bool = True,
    error_message: str = None
) -> LLMUsage:
    """
    Record LLM usage to database.
    
    Args:
        org_id: Organization ID
        agent_type: Type of agent that made the call
        provider: LLM provider name
        model: Model used
        prompt_tokens: Input token count
        completion_tokens: Output token count
        latency_ms: Request latency in milliseconds
        user_id: Optional user ID
        request_id: Optional request ID for correlation
        success: Whether the request succeeded
        error_message: Error message if failed
        
    Returns:
        LLMUsage record
    """
    usage = LLMUsage(
        org_id=org_id,
        user_id=user_id,
        agent_type=agent_type,
        provider=provider,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        estimated_cost=estimate_cost(model, prompt_tokens, completion_tokens),
        latency_ms=latency_ms,
        request_id=request_id,
        success=success,
        error_message=error_message
    )
    
    db.session.add(usage)
    db.session.commit()
    
    return usage


def get_usage_summary(org_id: int, days: int = 30) -> Dict:
    """
    Get usage summary for an organization.
    
    Args:
        org_id: Organization ID
        days: Number of days to include
        
    Returns:
        Dict with usage statistics
    """
    from datetime import timedelta
    
    since = datetime.utcnow() - timedelta(days=days)
    
    # Aggregate stats
    stats = db.session.query(
        func.sum(LLMUsage.total_tokens).label('total_tokens'),
        func.sum(LLMUsage.prompt_tokens).label('prompt_tokens'),
        func.sum(LLMUsage.completion_tokens).label('completion_tokens'),
        func.sum(LLMUsage.estimated_cost).label('total_cost'),
        func.count(LLMUsage.id).label('request_count'),
        func.avg(LLMUsage.latency_ms).label('avg_latency')
    ).filter(
        LLMUsage.org_id == org_id,
        LLMUsage.created_at >= since
    ).first()
    
    # By agent type
    by_agent = db.session.query(
        LLMUsage.agent_type,
        func.sum(LLMUsage.total_tokens).label('tokens'),
        func.sum(LLMUsage.estimated_cost).label('cost'),
        func.count(LLMUsage.id).label('requests')
    ).filter(
        LLMUsage.org_id == org_id,
        LLMUsage.created_at >= since
    ).group_by(LLMUsage.agent_type).all()
    
    # By model
    by_model = db.session.query(
        LLMUsage.model,
        func.sum(LLMUsage.total_tokens).label('tokens'),
        func.sum(LLMUsage.estimated_cost).label('cost')
    ).filter(
        LLMUsage.org_id == org_id,
        LLMUsage.created_at >= since
    ).group_by(LLMUsage.model).all()
    
    return {
        'period_days': days,
        'total_tokens': stats.total_tokens or 0,
        'prompt_tokens': stats.prompt_tokens or 0,
        'completion_tokens': stats.completion_tokens or 0,
        'total_cost': float(stats.total_cost or 0),
        'request_count': stats.request_count or 0,
        'avg_latency_ms': round(stats.avg_latency or 0, 2),
        'by_agent': [
            {
                'agent_type': a.agent_type,
                'tokens': a.tokens or 0,
                'cost': float(a.cost or 0),
                'requests': a.requests
            }
            for a in by_agent
        ],
        'by_model': [
            {
                'model': m.model,
                'tokens': m.tokens or 0,
                'cost': float(m.cost or 0)
            }
            for m in by_model
        ]
    }
