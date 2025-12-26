import { useState } from 'react';
import { sectionsApi, usersApi } from '@/api/client';
import { RFPSection, SectionComment, SectionPriority } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    UserIcon,
    CalendarIcon,
    FlagIcon,
    ChatBubbleLeftIcon,
    PaperAirplaneIcon,
    TrashIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface User {
    id: number;
    name: string;
    email: string;
}

interface SectionWorkflowPanelProps {
    section: RFPSection;
    projectId: number;
    onUpdate: (section: RFPSection) => void;
    users?: User[];
}

const PRIORITY_CONFIG: Record<SectionPriority, { label: string; color: string; bgColor: string }> = {
    low: { label: 'Low', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    normal: { label: 'Normal', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    high: { label: 'High', color: 'text-amber-600', bgColor: 'bg-amber-100' },
    urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export default function SectionWorkflowPanel({
    section,
    projectId,
    onUpdate,
    users = [],
}: SectionWorkflowPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showComments, setShowComments] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [isAddingComment, setIsAddingComment] = useState(false);

    const handleAssigneeChange = async (userId: number | null) => {
        try {
            const response = await sectionsApi.updateSection(projectId, section.id, {
                assigned_to: userId,
            });
            onUpdate(response.data.section);
            toast.success(userId ? 'Assignee updated' : 'Assignee removed');
        } catch {
            toast.error('Failed to update assignee');
        }
    };

    const handleDueDateChange = async (date: string | null) => {
        try {
            const response = await sectionsApi.updateSection(projectId, section.id, {
                due_date: date,
            });
            onUpdate(response.data.section);
            toast.success('Due date updated');
        } catch {
            toast.error('Failed to update due date');
        }
    };

    const handlePriorityChange = async (priority: SectionPriority) => {
        try {
            const response = await sectionsApi.updateSection(projectId, section.id, {
                priority,
            });
            onUpdate(response.data.section);
            toast.success('Priority updated');
        } catch {
            toast.error('Failed to update priority');
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        setIsAddingComment(true);
        try {
            const response = await sectionsApi.addComment(section.id, newComment.trim());
            // Update section with new comments
            onUpdate({
                ...section,
                comments: response.data.comments,
            });
            setNewComment('');
            toast.success('Comment added');
        } catch {
            toast.error('Failed to add comment');
        } finally {
            setIsAddingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        try {
            const response = await sectionsApi.deleteComment(section.id, commentId);
            onUpdate({
                ...section,
                comments: response.data.comments,
            });
            toast.success('Comment deleted');
        } catch {
            toast.error('Failed to delete comment');
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isOverdue = section.due_date && new Date(section.due_date) < new Date();

    return (
        <div className="bg-white border border-border rounded-lg shadow-sm">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-background/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <FlagIcon className="h-4 w-4 text-text-secondary" />
                    <span className="font-medium text-sm text-text-primary">Workflow</span>
                    {section.priority && section.priority !== 'normal' && (
                        <span className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            PRIORITY_CONFIG[section.priority].bgColor,
                            PRIORITY_CONFIG[section.priority].color
                        )}>
                            {PRIORITY_CONFIG[section.priority].label}
                        </span>
                    )}
                </div>
                {isExpanded ? (
                    <ChevronUpIcon className="h-4 w-4 text-text-muted" />
                ) : (
                    <ChevronDownIcon className="h-4 w-4 text-text-muted" />
                )}
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                    {/* Assignee */}
                    <div className="flex items-center gap-3">
                        <UserIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                        <div className="flex-1">
                            <label className="block text-xs text-text-muted mb-1">Assignee</label>
                            <select
                                value={section.assigned_to || ''}
                                onChange={(e) => handleAssigneeChange(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            >
                                <option value="">Unassigned</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Due Date */}
                    <div className="flex items-center gap-3">
                        <CalendarIcon className={clsx(
                            'h-4 w-4 flex-shrink-0',
                            isOverdue ? 'text-red-500' : 'text-text-muted'
                        )} />
                        <div className="flex-1">
                            <label className="block text-xs text-text-muted mb-1">
                                Due Date
                                {isOverdue && <span className="text-red-500 ml-1">(Overdue!)</span>}
                            </label>
                            <input
                                type="datetime-local"
                                value={section.due_date ? section.due_date.slice(0, 16) : ''}
                                onChange={(e) => handleDueDateChange(e.target.value || null)}
                                className={clsx(
                                    'w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20',
                                    isOverdue ? 'border-red-300 focus:border-red-500' : 'border-border focus:border-primary'
                                )}
                            />
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="flex items-center gap-3">
                        <FlagIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                        <div className="flex-1">
                            <label className="block text-xs text-text-muted mb-1">Priority</label>
                            <div className="flex gap-2">
                                {(Object.keys(PRIORITY_CONFIG) as SectionPriority[]).map((priority) => (
                                    <button
                                        key={priority}
                                        onClick={() => handlePriorityChange(priority)}
                                        className={clsx(
                                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                            section.priority === priority
                                                ? `${PRIORITY_CONFIG[priority].bgColor} ${PRIORITY_CONFIG[priority].color} ring-2 ring-offset-1 ring-primary/30`
                                                : 'bg-background text-text-secondary hover:bg-background/80'
                                        )}
                                    >
                                        {PRIORITY_CONFIG[priority].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Comments Section */}
                    <div className="pt-2 border-t border-border">
                        <button
                            onClick={() => setShowComments(!showComments)}
                            className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2"
                        >
                            <ChatBubbleLeftIcon className="h-4 w-4" />
                            Comments ({section.comments?.length || 0})
                            {showComments ? (
                                <ChevronUpIcon className="h-3 w-3" />
                            ) : (
                                <ChevronDownIcon className="h-3 w-3" />
                            )}
                        </button>

                        {showComments && (
                            <div className="space-y-3">
                                {/* Comment List */}
                                {section.comments && section.comments.length > 0 ? (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {section.comments.map((comment: SectionComment) => (
                                            <div
                                                key={comment.id}
                                                className="bg-background rounded-lg p-3 group"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-medium text-sm text-text-primary">
                                                                {comment.user_name}
                                                            </span>
                                                            <span className="text-xs text-text-muted">
                                                                {formatDate(comment.created_at)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-text-secondary">
                                                            {comment.text}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                        className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete comment"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-muted italic">No comments yet</p>
                                )}

                                {/* Add Comment */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                        placeholder="Add a comment..."
                                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        disabled={!newComment.trim() || isAddingComment}
                                        className={clsx(
                                            'px-3 py-2 rounded-lg transition-colors',
                                            newComment.trim()
                                                ? 'bg-primary text-white hover:bg-primary-dark'
                                                : 'bg-background text-text-muted cursor-not-allowed'
                                        )}
                                    >
                                        {isAddingComment ? (
                                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                                        ) : (
                                            <PaperAirplaneIcon className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
