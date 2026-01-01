"""
Approval Workflow Routes for enterprise proposal approval processes.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from ..extensions import db
from ..models import (
    User, Project,
    ApprovalWorkflow, ApprovalStage, ApprovalRequest, ApprovalDecision,
    Notification
)

bp = Blueprint('approvals', __name__)


# =============================================================================
# WORKFLOW TEMPLATES
# =============================================================================

@bp.route('/workflows', methods=['GET'])
@jwt_required()
def list_workflows():
    """List all approval workflows for the organization."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    workflows = ApprovalWorkflow.query.filter_by(
        organization_id=user.organization_id
    ).order_by(ApprovalWorkflow.created_at.desc()).all()
    
    return jsonify({
        'workflows': [w.to_dict() for w in workflows]
    }), 200


@bp.route('/workflows', methods=['POST'])
@jwt_required()
def create_workflow():
    """Create a new approval workflow."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    
    workflow = ApprovalWorkflow(
        organization_id=user.organization_id,
        name=data.get('name'),
        description=data.get('description'),
        trigger_type=data.get('trigger_type', 'manual'),
        trigger_conditions=data.get('trigger_conditions', {}),
        is_active=data.get('is_active', True),
        is_default=data.get('is_default', False),
        allow_parallel=data.get('allow_parallel', False),
        require_all=data.get('require_all', True),
        auto_escalate=data.get('auto_escalate', False),
        escalation_hours=data.get('escalation_hours', 48),
        created_by=user_id
    )
    
    # If setting as default, unset other defaults
    if workflow.is_default:
        ApprovalWorkflow.query.filter_by(
            organization_id=user.organization_id,
            is_default=True
        ).update({'is_default': False})
    
    db.session.add(workflow)
    db.session.flush()  # Get the ID
    
    # Create stages if provided
    stages = data.get('stages', [])
    for i, stage_data in enumerate(stages):
        stage = ApprovalStage(
            workflow_id=workflow.id,
            name=stage_data.get('name'),
            description=stage_data.get('description'),
            order=i,
            approver_type=stage_data.get('approver_type', 'role'),
            approver_role=stage_data.get('approver_role'),
            approver_user_id=stage_data.get('approver_user_id'),
            required_approvals=stage_data.get('required_approvals', 1),
            conditions=stage_data.get('conditions', {}),
            skip_conditions=stage_data.get('skip_conditions', {}),
            notify_on_pending=stage_data.get('notify_on_pending', True),
            reminder_hours=stage_data.get('reminder_hours', 24)
        )
        db.session.add(stage)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Workflow created',
        'workflow': workflow.to_dict()
    }), 201


@bp.route('/workflows/<int:workflow_id>', methods=['GET'])
@jwt_required()
def get_workflow(workflow_id):
    """Get a specific workflow with stages."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    workflow = ApprovalWorkflow.query.get(workflow_id)
    if not workflow or workflow.organization_id != user.organization_id:
        return jsonify({'error': 'Workflow not found'}), 404
    
    return jsonify(workflow.to_dict(include_stages=True)), 200


@bp.route('/workflows/<int:workflow_id>', methods=['PUT'])
@jwt_required()
def update_workflow(workflow_id):
    """Update an approval workflow."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    workflow = ApprovalWorkflow.query.get(workflow_id)
    if not workflow or workflow.organization_id != user.organization_id:
        return jsonify({'error': 'Workflow not found'}), 404
    
    data = request.get_json()
    
    # Update fields
    for field in ['name', 'description', 'trigger_type', 'trigger_conditions',
                  'is_active', 'is_default', 'allow_parallel', 'require_all',
                  'auto_escalate', 'escalation_hours']:
        if field in data:
            setattr(workflow, field, data[field])
    
    # Handle default toggle
    if data.get('is_default'):
        ApprovalWorkflow.query.filter(
            ApprovalWorkflow.organization_id == user.organization_id,
            ApprovalWorkflow.id != workflow_id
        ).update({'is_default': False})
    
    db.session.commit()
    
    return jsonify({
        'message': 'Workflow updated',
        'workflow': workflow.to_dict()
    }), 200


@bp.route('/workflows/<int:workflow_id>', methods=['DELETE'])
@jwt_required()
def delete_workflow(workflow_id):
    """Delete an approval workflow."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    workflow = ApprovalWorkflow.query.get(workflow_id)
    if not workflow or workflow.organization_id != user.organization_id:
        return jsonify({'error': 'Workflow not found'}), 404
    
    # Check for active requests
    active_requests = ApprovalRequest.query.filter_by(
        workflow_id=workflow_id,
        status='in_progress'
    ).count()
    
    if active_requests > 0:
        return jsonify({
            'error': f'Cannot delete workflow with {active_requests} active approval requests'
        }), 400
    
    db.session.delete(workflow)
    db.session.commit()
    
    return jsonify({'message': 'Workflow deleted'}), 200


# =============================================================================
# WORKFLOW STAGES
# =============================================================================

@bp.route('/workflows/<int:workflow_id>/stages', methods=['POST'])
@jwt_required()
def add_stage(workflow_id):
    """Add a stage to a workflow."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    workflow = ApprovalWorkflow.query.get(workflow_id)
    if not workflow or workflow.organization_id != user.organization_id:
        return jsonify({'error': 'Workflow not found'}), 404
    
    data = request.get_json()
    
    # Get next order number
    max_order = db.session.query(db.func.max(ApprovalStage.order))\
        .filter_by(workflow_id=workflow_id).scalar() or -1
    
    stage = ApprovalStage(
        workflow_id=workflow_id,
        name=data.get('name'),
        description=data.get('description'),
        order=data.get('order', max_order + 1),
        approver_type=data.get('approver_type', 'role'),
        approver_role=data.get('approver_role'),
        approver_user_id=data.get('approver_user_id'),
        required_approvals=data.get('required_approvals', 1),
        conditions=data.get('conditions', {}),
        skip_conditions=data.get('skip_conditions', {}),
        notify_on_pending=data.get('notify_on_pending', True),
        reminder_hours=data.get('reminder_hours', 24)
    )
    
    db.session.add(stage)
    db.session.commit()
    
    return jsonify({
        'message': 'Stage added',
        'stage': stage.to_dict()
    }), 201


@bp.route('/stages/<int:stage_id>', methods=['PUT'])
@jwt_required()
def update_stage(stage_id):
    """Update a workflow stage."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    stage = ApprovalStage.query.get(stage_id)
    if not stage:
        return jsonify({'error': 'Stage not found'}), 404
    
    workflow = ApprovalWorkflow.query.get(stage.workflow_id)
    if workflow.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    for field in ['name', 'description', 'order', 'approver_type', 'approver_role',
                  'approver_user_id', 'required_approvals', 'conditions',
                  'skip_conditions', 'notify_on_pending', 'reminder_hours']:
        if field in data:
            setattr(stage, field, data[field])
    
    db.session.commit()
    
    return jsonify({
        'message': 'Stage updated',
        'stage': stage.to_dict()
    }), 200


@bp.route('/stages/<int:stage_id>', methods=['DELETE'])
@jwt_required()
def delete_stage(stage_id):
    """Delete a workflow stage."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Admin access required'}), 403
    
    stage = ApprovalStage.query.get(stage_id)
    if not stage:
        return jsonify({'error': 'Stage not found'}), 404
    
    workflow = ApprovalWorkflow.query.get(stage.workflow_id)
    if workflow.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(stage)
    db.session.commit()
    
    return jsonify({'message': 'Stage deleted'}), 200


# =============================================================================
# APPROVAL REQUESTS
# =============================================================================

@bp.route('/requests', methods=['GET'])
@jwt_required()
def list_requests():
    """List approval requests (all for admins, pending for approvers)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    status_filter = request.args.get('status')  # pending, in_progress, approved, rejected
    project_id = request.args.get('project_id', type=int)
    
    query = ApprovalRequest.query.filter_by(organization_id=user.organization_id)
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    if project_id:
        query = query.filter_by(project_id=project_id)
    
    requests = query.order_by(ApprovalRequest.submitted_at.desc()).all()
    
    return jsonify({
        'requests': [r.to_dict(include_decisions=True) for r in requests]
    }), 200


@bp.route('/requests/pending', methods=['GET'])
@jwt_required()
def get_pending_approvals():
    """Get approval requests pending for the current user."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Find requests where current stage matches user's role or user ID
    pending = []
    
    requests = ApprovalRequest.query.filter_by(
        organization_id=user.organization_id,
        status='in_progress'
    ).all()
    
    for req in requests:
        if req.current_stage:
            stage = req.current_stage
            # Check if user is an approver for this stage
            if stage.approver_type == 'user' and stage.approver_user_id == user_id:
                pending.append(req)
            elif stage.approver_type == 'role' and stage.approver_role == user.role:
                pending.append(req)
            elif stage.approver_type == 'manager':
                # Check if user is a manager (simplified)
                if user.role in ['admin', 'manager', 'owner']:
                    pending.append(req)
    
    return jsonify({
        'pending_requests': [r.to_dict(include_decisions=True) for r in pending]
    }), 200


@bp.route('/requests', methods=['POST'])
@jwt_required()
def submit_request():
    """Submit a new approval request for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json()
    project_id = data.get('project_id')
    
    project = Project.query.get(project_id)
    if not project or project.organization_id != user.organization_id:
        return jsonify({'error': 'Project not found'}), 404
    
    # Check if there's already an active request
    existing = ApprovalRequest.query.filter_by(
        project_id=project_id,
        status='in_progress'
    ).first()
    
    if existing:
        return jsonify({'error': 'An approval request is already in progress for this project'}), 400
    
    # Get workflow (specified or default)
    workflow_id = data.get('workflow_id')
    if workflow_id:
        workflow = ApprovalWorkflow.query.get(workflow_id)
    else:
        workflow = ApprovalWorkflow.query.filter_by(
            organization_id=user.organization_id,
            is_default=True,
            is_active=True
        ).first()
    
    if not workflow:
        return jsonify({'error': 'No active approval workflow found'}), 400
    
    # Get first stage
    first_stage = workflow.stages.order_by(ApprovalStage.order).first()
    
    approval_request = ApprovalRequest(
        organization_id=user.organization_id,
        workflow_id=workflow.id,
        project_id=project_id,
        title=data.get('title', f'Approval request for {project.name}'),
        notes=data.get('notes'),
        status='in_progress',
        current_stage_id=first_stage.id if first_stage else None,
        submitted_by=user_id,
        metadata=data.get('metadata', {})
    )
    
    db.session.add(approval_request)
    db.session.commit()
    
    # Notify approvers of first stage
    if first_stage:
        _notify_approvers(first_stage, approval_request)
    
    return jsonify({
        'message': 'Approval request submitted',
        'request': approval_request.to_dict()
    }), 201


@bp.route('/requests/<int:request_id>/decide', methods=['POST'])
@jwt_required()
def make_decision(request_id):
    """Approve or reject at current stage."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    approval_request = ApprovalRequest.query.get(request_id)
    if not approval_request or approval_request.organization_id != user.organization_id:
        return jsonify({'error': 'Request not found'}), 404
    
    if approval_request.status != 'in_progress':
        return jsonify({'error': 'Request is not in progress'}), 400
    
    data = request.get_json()
    decision = data.get('decision')  # approved, rejected
    
    if decision not in ['approved', 'rejected']:
        return jsonify({'error': 'Decision must be approved or rejected'}), 400
    
    # Verify user can approve this stage
    stage = approval_request.current_stage
    if not stage:
        return jsonify({'error': 'No current stage'}), 400
    
    can_approve = False
    if stage.approver_type == 'user' and stage.approver_user_id == user_id:
        can_approve = True
    elif stage.approver_type == 'role' and stage.approver_role == user.role:
        can_approve = True
    elif stage.approver_type == 'manager' and user.role in ['admin', 'manager', 'owner']:
        can_approve = True
    
    if not can_approve:
        return jsonify({'error': 'You are not authorized to approve this stage'}), 403
    
    # Record decision
    decision_record = ApprovalDecision(
        request_id=request_id,
        stage_id=stage.id,
        decision=decision,
        comments=data.get('comments'),
        approver_id=user_id
    )
    db.session.add(decision_record)
    
    if decision == 'rejected':
        # Request is rejected
        approval_request.status = 'rejected'
        approval_request.completed_at = datetime.utcnow()
        
        # Notify submitter
        _notify_submitter(approval_request, 'rejected', user)
    else:
        # Check if stage requirements are met
        stage_decisions = ApprovalDecision.query.filter_by(
            request_id=request_id,
            stage_id=stage.id,
            decision='approved'
        ).count() + 1  # +1 for current decision
        
        if stage_decisions >= stage.required_approvals:
            # Move to next stage
            next_stage = ApprovalStage.query.filter(
                ApprovalStage.workflow_id == approval_request.workflow_id,
                ApprovalStage.order > stage.order
            ).order_by(ApprovalStage.order).first()
            
            if next_stage:
                approval_request.current_stage_id = next_stage.id
                _notify_approvers(next_stage, approval_request)
            else:
                # All stages complete - approved!
                approval_request.status = 'approved'
                approval_request.completed_at = datetime.utcnow()
                _notify_submitter(approval_request, 'approved', user)
    
    db.session.commit()
    
    return jsonify({
        'message': f'Request {decision}',
        'request': approval_request.to_dict(include_decisions=True)
    }), 200


@bp.route('/requests/<int:request_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_request(request_id):
    """Cancel an approval request."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    approval_request = ApprovalRequest.query.get(request_id)
    if not approval_request or approval_request.organization_id != user.organization_id:
        return jsonify({'error': 'Request not found'}), 404
    
    # Only submitter or admin can cancel
    if approval_request.submitted_by != user_id and user.role not in ['admin', 'owner']:
        return jsonify({'error': 'Access denied'}), 403
    
    if approval_request.status not in ['pending', 'in_progress']:
        return jsonify({'error': 'Cannot cancel completed request'}), 400
    
    approval_request.status = 'cancelled'
    approval_request.completed_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Request cancelled',
        'request': approval_request.to_dict()
    }), 200


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _notify_approvers(stage, approval_request):
    """Send notifications to approvers for a stage."""
    if not stage.notify_on_pending:
        return
    
    # Find users to notify based on stage configuration
    users_to_notify = []
    
    if stage.approver_type == 'user' and stage.approver_user_id:
        users_to_notify.append(stage.approver_user_id)
    elif stage.approver_type == 'role':
        # Find all users with this role in the organization
        users = User.query.filter_by(
            organization_id=approval_request.organization_id,
            role=stage.approver_role,
            is_active=True
        ).all()
        users_to_notify = [u.id for u in users]
    elif stage.approver_type == 'manager':
        # Find all managers/admins
        users = User.query.filter(
            User.organization_id == approval_request.organization_id,
            User.role.in_(['admin', 'manager', 'owner']),
            User.is_active == True
        ).all()
        users_to_notify = [u.id for u in users]
    
    for uid in users_to_notify:
        notification = Notification(
            user_id=uid,
            type='approval',
            title='Approval Required',
            message=f'Your approval is needed for: {approval_request.title}',
            data={
                'request_id': approval_request.id,
                'project_id': approval_request.project_id,
                'stage_name': stage.name
            }
        )
        db.session.add(notification)


def _notify_submitter(approval_request, status, approver):
    """Notify the submitter of the final decision."""
    notification = Notification(
        user_id=approval_request.submitted_by,
        type='approval',
        title=f'Request {status.title()}',
        message=f'Your approval request "{approval_request.title}" has been {status} by {approver.name}',
        data={
            'request_id': approval_request.id,
            'project_id': approval_request.project_id,
            'status': status
        }
    )
    db.session.add(notification)
