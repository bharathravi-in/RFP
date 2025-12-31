import { useState } from 'react';
import {
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    UserCircleIcon,
    ChatBubbleLeftEllipsisIcon,
    ArrowRightIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface Reviewer {
    id: number;
    name: string;
    email: string;
    role: string;
    status: 'pending' | 'approved' | 'rejected' | 'in_review';
    reviewed_at?: string;
    comment?: string;
}

interface ApprovalStep {
    step: number;
    title: string;
    description: string;
    reviewers: Reviewer[];
    status: 'pending' | 'in_progress' | 'completed' | 'rejected';
    required_approvals: number;
}

interface ApprovalWorkflowPanelProps {
    steps: ApprovalStep[];
    currentStep: number;
    onApprove?: (stepIndex: number) => void;
    onReject?: (stepIndex: number, reason: string) => void;
    onAddComment?: (stepIndex: number, comment: string) => void;
    canReview?: boolean;
    isLoading?: boolean;
}

export default function ApprovalWorkflowPanel({
    steps,
    currentStep,
    onApprove,
    onReject,
    onAddComment,
    canReview = true,
    isLoading = false,
}: ApprovalWorkflowPanelProps) {
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState<number | null>(null);
    const [comment, setComment] = useState('');

    const getStepIcon = (step: ApprovalStep, index: number) => {
        if (step.status === 'completed') {
            return <CheckCircleIcon className="h-6 w-6 text-success" />;
        }
        if (step.status === 'rejected') {
            return <XCircleIcon className="h-6 w-6 text-error" />;
        }
        if (index === currentStep) {
            return <ClockIcon className="h-6 w-6 text-warning animate-pulse" />;
        }
        return <ClockIcon className="h-6 w-6 text-text-muted" />;
    };

    const getReviewerStatusIcon = (status: Reviewer['status']) => {
        switch (status) {
            case 'approved':
                return <CheckCircleIcon className="h-4 w-4 text-success" />;
            case 'rejected':
                return <XCircleIcon className="h-4 w-4 text-error" />;
            case 'in_review':
                return <ClockIcon className="h-4 w-4 text-warning animate-pulse" />;
            default:
                return <ClockIcon className="h-4 w-4 text-text-muted" />;
        }
    };

    const handleReject = (stepIndex: number) => {
        if (rejectReason.trim() && onReject) {
            onReject(stepIndex, rejectReason);
            setRejectReason('');
            setShowRejectModal(null);
        }
    };

    return (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-text-primary">Approval Workflow</h3>
                    </div>
                    <span className="text-sm text-text-muted">
                        Step {currentStep + 1} of {steps.length}
                    </span>
                </div>
            </div>

            {/* Workflow Steps */}
            <div className="p-4">
                <div className="space-y-4">
                    {steps.map((step, index) => (
                        <div key={step.step} className="relative">
                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="absolute left-3 top-12 w-0.5 h-full bg-border" />
                            )}

                            <div className={clsx(
                                'flex gap-4 p-4 rounded-lg border transition-all',
                                index === currentStep
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : step.status === 'completed'
                                        ? 'border-success/50 bg-success/5'
                                        : step.status === 'rejected'
                                            ? 'border-error/50 bg-error/5'
                                            : 'border-border bg-background/50'
                            )}>
                                {/* Step Icon */}
                                <div className="flex-shrink-0">
                                    {getStepIcon(step, index)}
                                </div>

                                {/* Step Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-semibold text-text-primary">
                                            {step.title}
                                        </h4>
                                        <span className={clsx(
                                            'px-2 py-0.5 rounded-full text-xs font-medium',
                                            step.status === 'completed' && 'bg-success-light text-success',
                                            step.status === 'rejected' && 'bg-error-light text-error',
                                            step.status === 'in_progress' && 'bg-warning-light text-warning',
                                            step.status === 'pending' && 'bg-gray-100 text-text-muted'
                                        )}>
                                            {step.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-text-muted mb-3">{step.description}</p>

                                    {/* Reviewers */}
                                    <div className="space-y-2">
                                        {step.reviewers.map((reviewer) => (
                                            <div
                                                key={reviewer.id}
                                                className="flex items-center justify-between p-2 bg-background rounded-lg"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <UserCircleIcon className="h-8 w-8 text-text-muted" />
                                                    <div>
                                                        <p className="text-sm font-medium text-text-primary">
                                                            {reviewer.name}
                                                        </p>
                                                        <p className="text-xs text-text-muted">{reviewer.role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {reviewer.comment && (
                                                        <ChatBubbleLeftEllipsisIcon
                                                            className="h-4 w-4 text-text-muted"
                                                            title={reviewer.comment}
                                                        />
                                                    )}
                                                    {getReviewerStatusIcon(reviewer.status)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Buttons for Current Step */}
                                    {index === currentStep && canReview && (
                                        <div className="mt-4 pt-4 border-t border-border">
                                            {/* Comment Input */}
                                            <div className="flex gap-2 mb-3">
                                                <input
                                                    type="text"
                                                    value={comment}
                                                    onChange={(e) => setComment(e.target.value)}
                                                    placeholder="Add a comment..."
                                                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (comment.trim() && onAddComment) {
                                                            onAddComment(index, comment);
                                                            setComment('');
                                                        }
                                                    }}
                                                    disabled={!comment.trim()}
                                                    className="px-3 py-2 text-sm bg-gray-100 text-text-secondary rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                                >
                                                    Add
                                                </button>
                                            </div>

                                            {/* Approve/Reject Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => onApprove?.(index)}
                                                    disabled={isLoading}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50"
                                                >
                                                    <CheckCircleIcon className="h-4 w-4" />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => setShowRejectModal(index)}
                                                    disabled={isLoading}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
                                                >
                                                    <XCircleIcon className="h-4 w-4" />
                                                    Request Changes
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal !== null && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-text-primary mb-2">Request Changes</h3>
                        <p className="text-sm text-text-muted mb-4">
                            Provide feedback on what needs to be changed.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Describe the required changes..."
                            className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary h-32 resize-none"
                        />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setShowRejectModal(null);
                                    setRejectReason('');
                                }}
                                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-background"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReject(showRejectModal)}
                                disabled={!rejectReason.trim()}
                                className="flex-1 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 disabled:opacity-50"
                            >
                                Submit Feedback
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Simple Approval Timeline for smaller contexts
export function ApprovalTimeline({
    approvals
}: {
    approvals: Array<{ name: string; status: 'pending' | 'approved' | 'rejected'; date?: string }>;
}) {
    return (
        <div className="flex items-center gap-2 overflow-x-auto py-2">
            {approvals.map((approval, index) => (
                <div key={index} className="flex items-center">
                    <div className={clsx(
                        'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                        approval.status === 'approved' && 'bg-success-light text-success',
                        approval.status === 'rejected' && 'bg-error-light text-error',
                        approval.status === 'pending' && 'bg-gray-100 text-text-muted'
                    )}>
                        {approval.status === 'approved' && <CheckCircleIcon className="h-3 w-3" />}
                        {approval.status === 'rejected' && <XCircleIcon className="h-3 w-3" />}
                        {approval.status === 'pending' && <ClockIcon className="h-3 w-3" />}
                        {approval.name}
                    </div>
                    {index < approvals.length - 1 && (
                        <ArrowRightIcon className="h-3 w-3 text-text-muted mx-1" />
                    )}
                </div>
            ))}
        </div>
    );
}
