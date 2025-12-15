import { useState } from 'react';
import { ChatBubbleLeftIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface Comment {
    id: number;
    text: string;
    user: {
        id: number;
        name: string;
    };
    position?: number;
    resolved: boolean;
    createdAt: string;
}

interface InlineCommentProps {
    comment: Comment;
    onResolve: (commentId: number) => void;
    onReply?: (commentId: number, text: string) => void;
}

export function InlineComment({ comment, onResolve, onReply }: InlineCommentProps) {
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');

    const handleReply = () => {
        if (replyText.trim() && onReply) {
            onReply(comment.id, replyText);
            setReplyText('');
            setShowReply(false);
        }
    };

    return (
        <div className={clsx(
            'border-l-4 pl-3 py-2 my-2',
            comment.resolved ? 'border-success bg-success-50/50' : 'border-warning bg-warning-50/50'
        )}>
            <div className="flex items-start gap-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-text-primary">{comment.user.name}</span>
                        <span className="text-text-muted">
                            {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                        {comment.resolved && (
                            <span className="inline-flex items-center gap-1 text-success">
                                <CheckIcon className="h-3 w-3" />
                                Resolved
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-text-secondary mt-1">{comment.text}</p>
                </div>

                {!comment.resolved && (
                    <button
                        onClick={() => onResolve(comment.id)}
                        className="p-1 text-success hover:bg-success-light rounded transition-colors"
                        title="Mark as resolved"
                    >
                        <CheckIcon className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Reply Section */}
            {!comment.resolved && (
                <div className="mt-2">
                    {showReply ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="input flex-1 text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                            />
                            <button onClick={handleReply} className="btn-primary text-xs py-1">
                                Reply
                            </button>
                            <button
                                onClick={() => setShowReply(false)}
                                className="btn-secondary text-xs py-1"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowReply(true)}
                            className="text-xs text-primary hover:underline"
                        >
                            Reply
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// Comment Thread Component
interface CommentThreadProps {
    comments: Comment[];
    onResolve: (commentId: number) => void;
    onAddComment: (text: string) => void;
}

export function CommentThread({ comments, onResolve, onAddComment }: CommentThreadProps) {
    const [newComment, setNewComment] = useState('');

    const handleSubmit = () => {
        if (newComment.trim()) {
            onAddComment(newComment);
            setNewComment('');
        }
    };

    const unresolvedCount = comments.filter(c => !c.resolved).length;

    return (
        <div className="border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
                <div className="flex items-center gap-2">
                    <ChatBubbleLeftIcon className="h-5 w-5 text-text-muted" />
                    <span className="font-medium text-text-primary">Comments</span>
                    {unresolvedCount > 0 && (
                        <span className="px-2 py-0.5 bg-warning-light text-warning text-xs font-medium rounded-full">
                            {unresolvedCount} unresolved
                        </span>
                    )}
                </div>
            </div>

            {/* Comments List */}
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                {comments.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-4">
                        No comments yet. Be the first to add one!
                    </p>
                ) : (
                    comments.map((comment) => (
                        <InlineComment
                            key={comment.id}
                            comment={comment}
                            onResolve={onResolve}
                        />
                    ))
                )}
            </div>

            {/* Add Comment */}
            <div className="p-4 border-t border-border bg-surface">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="input flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!newComment.trim()}
                        className="btn-primary"
                    >
                        Comment
                    </button>
                </div>
            </div>
        </div>
    );
}
