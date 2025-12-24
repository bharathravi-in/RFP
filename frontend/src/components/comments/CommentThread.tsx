import { useState, useEffect, useRef } from 'react';
import { commentsApi } from '@/api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    ChatBubbleLeftIcon,
    PaperAirplaneIcon,
    CheckCircleIcon,
    ArrowUturnLeftIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

interface CommentUser {
    id: number;
    name: string;
    avatar?: string;
}

interface Comment {
    id: number;
    content: string;
    created_by: number;
    creator_name: string;
    creator_avatar?: string;
    created_at: string;
    resolved: boolean;
    resolved_by?: number;
    parent_id?: number;
    replies?: Comment[];
    reply_count?: number;
    mentioned_users: number[];
}

interface CommentThreadProps {
    sectionId?: number;
    questionId?: number;
    answerId?: number;
    onClose?: () => void;
}

export default function CommentThread({ sectionId, questionId, answerId, onClose }: CommentThreadProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [mentionSuggestions, setMentionSuggestions] = useState<CommentUser[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const [showResolved, setShowResolved] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        loadComments();
    }, [sectionId, questionId, answerId, showResolved]);

    const loadComments = async () => {
        try {
            const response = await commentsApi.list({
                section_id: sectionId,
                question_id: questionId,
                answer_id: answerId,
                include_resolved: showResolved,
            });
            setComments(response.data.comments || []);
        } catch {
            toast.error('Failed to load comments');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            await commentsApi.create({
                content: newComment,
                section_id: sectionId,
                question_id: questionId,
                answer_id: answerId,
                parent_id: replyingTo || undefined,
            });
            setNewComment('');
            setReplyingTo(null);
            toast.success('Comment added');
            loadComments();
        } catch {
            toast.error('Failed to add comment');
        }
    };

    const handleResolve = async (commentId: number, resolved: boolean) => {
        try {
            await commentsApi.resolve(commentId, resolved);
            toast.success(resolved ? 'Comment resolved' : 'Comment reopened');
            loadComments();
        } catch {
            toast.error('Failed to update comment');
        }
    };

    const handleDelete = async (commentId: number) => {
        if (!confirm('Delete this comment?')) return;
        try {
            await commentsApi.delete(commentId);
            toast.success('Comment deleted');
            loadComments();
        } catch {
            toast.error('Failed to delete comment');
        }
    };

    const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setNewComment(value);

        // Check for @mention trigger
        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const textAfterAt = value.slice(lastAtIndex + 1);
            if (textAfterAt.match(/^\w*$/)) {
                // Fetch mention suggestions
                try {
                    const response = await commentsApi.getUsersForMention(textAfterAt);
                    setMentionSuggestions(response.data.users || []);
                    setShowMentions(response.data.users?.length > 0);
                } catch {
                    setShowMentions(false);
                }
            } else {
                setShowMentions(false);
            }
        } else {
            setShowMentions(false);
        }
    };

    const insertMention = (user: CommentUser) => {
        const lastAtIndex = newComment.lastIndexOf('@');
        const before = newComment.slice(0, lastAtIndex);
        const after = `@${user.name} `;
        setNewComment(before + after);
        setShowMentions(false);
        textareaRef.current?.focus();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const renderComment = (comment: Comment, isReply = false) => (
        <div
            key={comment.id}
            className={clsx(
                'group relative',
                isReply ? 'ml-8 mt-3' : 'mb-4',
                comment.resolved && 'opacity-60'
            )}
        >
            <div className="flex gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    {comment.creator_avatar ? (
                        <img
                            src={comment.creator_avatar}
                            alt={comment.creator_name}
                            className="h-8 w-8 rounded-full"
                        />
                    ) : (
                        <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center">
                            <span className="text-primary text-sm font-medium">
                                {comment.creator_name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-text-primary text-sm">
                            {comment.creator_name}
                        </span>
                        <span className="text-text-muted text-xs">
                            {formatDate(comment.created_at)}
                        </span>
                        {comment.resolved && (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                                <CheckCircleSolidIcon className="h-3 w-3" />
                                Resolved
                            </span>
                        )}
                    </div>

                    <p className="text-text-secondary text-sm whitespace-pre-wrap">
                        {comment.content}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isReply && (
                            <button
                                onClick={() => setReplyingTo(comment.id)}
                                className="text-xs text-text-muted hover:text-primary flex items-center gap-1"
                            >
                                <ArrowUturnLeftIcon className="h-3 w-3" />
                                Reply
                            </button>
                        )}
                        <button
                            onClick={() => handleResolve(comment.id, !comment.resolved)}
                            className="text-xs text-text-muted hover:text-success flex items-center gap-1"
                        >
                            <CheckCircleIcon className="h-3 w-3" />
                            {comment.resolved ? 'Reopen' : 'Resolve'}
                        </button>
                        <button
                            onClick={() => handleDelete(comment.id)}
                            className="text-xs text-text-muted hover:text-error flex items-center gap-1"
                        >
                            <TrashIcon className="h-3 w-3" />
                            Delete
                        </button>
                    </div>

                    {/* Replies */}
                    {comment.replies?.map((reply) => renderComment(reply, true))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-surface border-l border-border">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <ChatBubbleLeftIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-text-primary">Comments</h3>
                    <span className="text-xs text-text-muted">({comments.length})</span>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-text-muted">
                        <input
                            type="checkbox"
                            checked={showResolved}
                            onChange={(e) => setShowResolved(e.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary"
                        />
                        Show resolved
                    </label>
                    {onClose && (
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                            <XMarkIcon className="h-5 w-5 text-text-muted" />
                        </button>
                    )}
                </div>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="text-center text-text-muted py-8">Loading...</div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-8">
                        <ChatBubbleLeftIcon className="h-10 w-10 mx-auto text-text-muted mb-2" />
                        <p className="text-text-secondary text-sm">No comments yet</p>
                        <p className="text-text-muted text-xs mt-1">
                            Use @mention to notify team members
                        </p>
                    </div>
                ) : (
                    comments.map((comment) => renderComment(comment))
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
                {replyingTo && (
                    <div className="flex items-center justify-between mb-2 px-2 py-1 bg-gray-50 rounded text-xs text-text-secondary">
                        <span>Replying to comment...</span>
                        <button
                            onClick={() => setReplyingTo(null)}
                            className="text-text-muted hover:text-text-primary"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        ref={textareaRef}
                        value={newComment}
                        onChange={handleTextChange}
                        placeholder="Add a comment... (use @ to mention)"
                        rows={2}
                        className="input w-full resize-none pr-10"
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim()}
                        className="absolute right-2 bottom-2 p-1.5 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                    >
                        <PaperAirplaneIcon className="h-4 w-4" />
                    </button>

                    {/* Mention Suggestions */}
                    {showMentions && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {mentionSuggestions.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => insertMention(user)}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                                >
                                    <div className="h-6 w-6 rounded-full bg-primary-light flex items-center justify-center text-xs text-primary font-medium">
                                        {user.name.charAt(0)}
                                    </div>
                                    <span className="text-sm text-text-primary">{user.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
