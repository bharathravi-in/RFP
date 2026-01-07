import { useState } from 'react';
import {
    CheckCircleIcon,
    XCircleIcon,
    ChatBubbleLeftIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface QuickApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemTitle: string;
    itemType: 'answer' | 'section' | 'proposal';
    onApprove: (comment?: string) => void;
    onReject: (reason: string) => void;
    isLoading?: boolean;
}

export default function QuickApprovalModal({
    isOpen,
    onClose,
    itemTitle,
    itemType,
    onApprove,
    onReject,
    isLoading = false,
}: QuickApprovalModalProps) {
    const [mode, setMode] = useState<'choice' | 'approve' | 'reject'>('choice');
    const [comment, setComment] = useState('');

    if (!isOpen) return null;

    const handleApprove = () => {
        onApprove(comment || undefined);
        setComment('');
        setMode('choice');
    };

    const handleReject = () => {
        if (comment.trim()) {
            onReject(comment);
            setComment('');
            setMode('choice');
        }
    };

    const handleClose = () => {
        setMode('choice');
        setComment('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-text-primary">
                            Review {itemType.charAt(0).toUpperCase() + itemType.slice(1)}
                        </h3>
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-background rounded-lg transition-colors"
                        >
                            <XMarkIcon className="h-5 w-5 text-text-muted" />
                        </button>
                    </div>
                    <p className="text-sm text-text-muted mt-1 truncate">{itemTitle}</p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {mode === 'choice' && (
                        <div className="space-y-4">
                            <p className="text-text-secondary text-center mb-6">
                                What would you like to do with this {itemType}?
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setMode('approve')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-3 p-6 border-2 border-success/30 rounded-xl hover:border-success hover:bg-success/5 transition-all group"
                                >
                                    <div className="p-3 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                                        <CheckCircleIcon className="h-8 w-8 text-success" />
                                    </div>
                                    <span className="font-semibold text-success">Approve</span>
                                </button>
                                <button
                                    onClick={() => setMode('reject')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-3 p-6 border-2 border-error/30 rounded-xl hover:border-error hover:bg-error/5 transition-all group"
                                >
                                    <div className="p-3 rounded-full bg-error/10 group-hover:bg-error/20 transition-colors">
                                        <XCircleIcon className="h-8 w-8 text-error" />
                                    </div>
                                    <span className="font-semibold text-error">Request Changes</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {mode === 'approve' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
                                <CheckCircleIcon className="h-6 w-6 text-success" />
                                <p className="text-success font-medium">Approving this {itemType}</p>
                            </div>
                            <div>
                                <label className="text-sm text-text-muted mb-2 flex items-center gap-2">
                                    <ChatBubbleLeftIcon className="h-4 w-4" />
                                    Add a comment (optional)
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Great work! Approved for final submission..."
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-success h-24 resize-none"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setMode('choice')}
                                    className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-background"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleApprove}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    Confirm Approval
                                </button>
                            </div>
                        </div>
                    )}

                    {mode === 'reject' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-error/10 rounded-lg">
                                <XCircleIcon className="h-6 w-6 text-error" />
                                <p className="text-error font-medium">Requesting changes</p>
                            </div>
                            <div>
                                <label className="text-sm text-text-muted mb-2 flex items-center gap-2">
                                    <ChatBubbleLeftIcon className="h-4 w-4" />
                                    Feedback (required)
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Please describe the changes needed..."
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-error h-24 resize-none"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setMode('choice')}
                                    className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-background"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={isLoading || !comment.trim()}
                                    className="flex-1 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <XCircleIcon className="h-4 w-4" />
                                    Submit Feedback
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
