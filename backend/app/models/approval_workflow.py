"""
Approval Workflow Models for enterprise proposal approval processes.

Provides configurable multi-stage approval workflows with role-based approvers,
conditional routing, escalation rules, and audit trails.
"""
from datetime import datetime
from ..extensions import db


class ApprovalWorkflow(db.Model):
    """Defines an approval workflow template."""
    
    __tablename__ = 'approval_workflows'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    
    # Workflow definition
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    
    # Trigger conditions
    trigger_type = db.Column(db.String(50), default='manual')  # manual, auto_on_complete, value_threshold
    trigger_conditions = db.Column(db.JSON, default=dict)  # e.g., {"min_value": 50000}
    
    # Settings
    is_active = db.Column(db.Boolean, default=True)
    is_default = db.Column(db.Boolean, default=False)
    allow_parallel = db.Column(db.Boolean, default=False)  # Allow parallel approvals
    require_all = db.Column(db.Boolean, default=True)  # Require all approvers vs any
    
    # Escalation
    auto_escalate = db.Column(db.Boolean, default=False)
    escalation_hours = db.Column(db.Integer, default=48)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Relationships
    organization = db.relationship('Organization', backref=db.backref('approval_workflows', lazy='dynamic'))
    stages = db.relationship('ApprovalStage', backref='workflow', lazy='dynamic', 
                            cascade='all, delete-orphan', order_by='ApprovalStage.order')
    creator = db.relationship('User', foreign_keys=[created_by])
    
    def to_dict(self, include_stages=True):
        data = {
            'id': self.id,
            'organization_id': self.organization_id,
            'name': self.name,
            'description': self.description,
            'trigger_type': self.trigger_type,
            'trigger_conditions': self.trigger_conditions or {},
            'is_active': self.is_active,
            'is_default': self.is_default,
            'allow_parallel': self.allow_parallel,
            'require_all': self.require_all,
            'auto_escalate': self.auto_escalate,
            'escalation_hours': self.escalation_hours,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
        }
        if include_stages:
            data['stages'] = [s.to_dict() for s in self.stages.order_by('order').all()]
        return data


class ApprovalStage(db.Model):
    """A stage within an approval workflow."""
    
    __tablename__ = 'approval_stages'
    
    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey('approval_workflows.id', ondelete='CASCADE'), nullable=False)
    
    # Stage definition
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    
    # Approver configuration
    approver_type = db.Column(db.String(50), default='role')  # role, user, manager, dynamic
    approver_role = db.Column(db.String(50))  # admin, manager, legal, finance, etc.
    approver_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Approval requirements
    required_approvals = db.Column(db.Integer, default=1)  # Number of approvals needed
    
    # Conditional logic
    conditions = db.Column(db.JSON, default=dict)  # e.g., {"if_value_above": 100000}
    skip_conditions = db.Column(db.JSON, default=dict)  # Conditions to skip this stage
    
    # Notifications
    notify_on_pending = db.Column(db.Boolean, default=True)
    reminder_hours = db.Column(db.Integer, default=24)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    approver_user = db.relationship('User', foreign_keys=[approver_user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'name': self.name,
            'description': self.description,
            'order': self.order,
            'approver_type': self.approver_type,
            'approver_role': self.approver_role,
            'approver_user_id': self.approver_user_id,
            'required_approvals': self.required_approvals,
            'conditions': self.conditions or {},
            'skip_conditions': self.skip_conditions or {},
            'notify_on_pending': self.notify_on_pending,
            'reminder_hours': self.reminder_hours,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ApprovalRequest(db.Model):
    """An active approval request for a project/proposal."""
    
    __tablename__ = 'approval_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    workflow_id = db.Column(db.Integer, db.ForeignKey('approval_workflows.id', ondelete='SET NULL'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    
    # Request details
    title = db.Column(db.String(200), nullable=False)
    notes = db.Column(db.Text)
    
    # Current state
    status = db.Column(db.String(50), default='pending')  # pending, in_progress, approved, rejected, cancelled
    current_stage_id = db.Column(db.Integer, db.ForeignKey('approval_stages.id'), nullable=True)
    
    # Tracking
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # Request context data
    request_metadata = db.Column(db.JSON, default=dict)  # Additional context like proposal value
    
    # Relationships
    organization = db.relationship('Organization')
    workflow = db.relationship('ApprovalWorkflow')
    project = db.relationship('Project', backref=db.backref('approval_requests', lazy='dynamic'))
    current_stage = db.relationship('ApprovalStage', foreign_keys=[current_stage_id])
    submitter = db.relationship('User', foreign_keys=[submitted_by])
    decisions = db.relationship('ApprovalDecision', backref='request', lazy='dynamic',
                               cascade='all, delete-orphan', order_by='ApprovalDecision.created_at')
    
    def to_dict(self, include_decisions=False):
        data = {
            'id': self.id,
            'organization_id': self.organization_id,
            'workflow_id': self.workflow_id,
            'project_id': self.project_id,
            'title': self.title,
            'notes': self.notes,
            'status': self.status,
            'current_stage_id': self.current_stage_id,
            'current_stage': self.current_stage.to_dict() if self.current_stage else None,
            'submitted_by': self.submitted_by,
            'submitter_name': self.submitter.name if self.submitter else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'request_metadata': self.request_metadata or {},
        }
        if include_decisions:
            data['decisions'] = [d.to_dict() for d in self.decisions.all()]
        return data


class ApprovalDecision(db.Model):
    """Individual approval/rejection decision by an approver."""
    
    __tablename__ = 'approval_decisions'
    
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('approval_requests.id', ondelete='CASCADE'), nullable=False)
    stage_id = db.Column(db.Integer, db.ForeignKey('approval_stages.id'), nullable=False)
    
    # Decision
    decision = db.Column(db.String(50), nullable=False)  # approved, rejected, delegated
    comments = db.Column(db.Text)
    
    # Approver
    approver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    delegated_to_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    stage = db.relationship('ApprovalStage')
    approver = db.relationship('User', foreign_keys=[approver_id])
    delegated_to = db.relationship('User', foreign_keys=[delegated_to_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'stage_id': self.stage_id,
            'stage_name': self.stage.name if self.stage else None,
            'decision': self.decision,
            'comments': self.comments,
            'approver_id': self.approver_id,
            'approver_name': self.approver.name if self.approver else None,
            'delegated_to_id': self.delegated_to_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
