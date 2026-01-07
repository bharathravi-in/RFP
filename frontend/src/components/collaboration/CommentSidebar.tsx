import { useState, useEffect } from 'react';
import { commentsApi } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import {
    ChatBubbleLeftRightIcon,
    XMarkIcon,
    PaperAirplaneIcon,
    CheckCircleIcon,
    ArrowUturnLeftIcon,
    TrashIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
    id: number;
    content: string;
    created_by_name: string;
    created_at: string;
    resolved: boolean;
    parent_id: number | null;
    replies: Comment[];
}

interface CommentSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    questionId?: number;
    sectionId?: number;
    title: string;
}

export default function CommentSidebar({ isOpen, onClose, questionId, sectionId, title }: CommentSidebarProps) {
    const { user } = useAuthStore();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadComments = async () => {
        if (!questionId && !sectionId) return;
        setIsLoading(true);
        try {
            const response = await commentsApi.list({
                question_id: questionId,
                section_id: sectionId,
                include_resolved: true
            });
            // Convert flat list to threaded structure
            const allComments: Comment[] = response.data.comments || [];
            const rootComments = allComments.filter(c => !c.parent_id);
            const threaded = rootComments.map(root => ({
                ...root,
                replies: allComments.filter(c => c.parent_id === root.id)
            }));
            setComments(threaded);
        } catch (error) {
            console.error('Failed to load comments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadComments();
        }
    }, [isOpen, questionId, sectionId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setIsSubmitting(true);
        try {
            await commentsApi.create({
                content: newComment,
                question_id: questionId,
                section_id: sectionId,
                parent_id: replyTo || undefined
            });
            setNewComment('');
            setReplyTo(null);
            loadComments();
            toast.success('Comment added');
        } catch (error) {
            toast.error('Failed to add comment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResolve = async (commentId: number, resolved: boolean) => {
        try {
            await commentsApi.resolve(commentId, resolved);
            loadComments();
            toast.success(resolved ? 'Comment resolved' : 'Comment reopened');
        } catch (error) {
            toast.error('Action failed');
        }
    };

    const handleDelete = async (commentId: number) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await commentsApi.delete(commentId);
            loadComments();
            toast.success('Comment deleted');
        } catch (error) {
            toast.error('Failed to delete comment');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-surface border-l border-border shadow-2xl z-40 flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-background">
                <div className="flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-text-primary truncate max-w-[180px]">{title}</h3>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                        <span className="text-sm">Loading discussion...</span>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <ChatBubbleLeftRightIcon className="h-10 w-10 text-gray-300 mb-2" />
                        <p className="text-sm text-text-secondary font-medium">No comments yet</p>
                        <p className="text-xs text-text-muted mt-1">Start a discussion on this item</p>
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="space-y-3">
                            {/* Main Comment */}
                            <div className={clsx(
                                "p-3 rounded-lg border transition-all",
                                comment.resolved ? "bg-gray-50 border-gray-200 opacity-75" : "bg-white border-border shadow-sm"
                            )}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-xs text-text-primary">{comment.created_by_name}</span>
                                    <span className="text-[10px] text-text-muted">{formatDistanceToNow(new Date(comment.created_at))} ago</span>
                                </div>
                                <p className="text-sm text-text-secondary whitespace-pre-wrap">{comment.content}</p>

                                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50">
                                    <button
                                        onClick={() => setReplyTo(comment.id)}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <ArrowUturnLeftIcon className="h-3 w-3" /> Reply
                                    </button>
                                    <button
                                        onClick={() => handleResolve(comment.id, !comment.resolved)}
                                        className={clsx(
                                            "text-xs flex items-center gap-1",
                                            comment.resolved ? "text-green-600 font-medium" : "text-text-muted hover:text-green-600"
                                        )}
                                    >
                                        {comment.resolved ? (
                                            <><CheckCircleIconSolid className="h-3 w-3" /> Resolved</>
                                        ) : (
                                            <><CheckCircleIcon className="h-3 w-3" /> Resolve</>
                                        )}
                                    </button>
                                    {comment.created_by_name === user?.name && (
                                        <button onClick={() => handleDelete(comment.id)} className="text-xs text-red-500 hover:text-red-700 ml-auto">
                                            <TrashIcon className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Replies */}
                            {comment.replies.map(reply => (
                                <div key={reply.id} className="ml-6 p-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-xs text-text-primary">{reply.created_by_name}</span>
                                        <span className="text-[10px] text-text-muted">{formatDistanceToNow(new Date(reply.created_at))} ago</span>
                                    </div>
                                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{reply.content}</p>
                                    {reply.created_by_name === user?.name && (
                                        <div className="flex justify-end mt-1">
                                            <button onClick={() => handleDelete(reply.id)} className="text-xs text-red-500 hover:text-red-700">
                                                <TrashIcon className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background border-t border-border">
                {replyTo && (
                    <div className="mb-2 p-2 bg-primary/5 rounded flex items-center justify-between text-xs">
                        <span className="text-text-secondary">Replying to thread...</span>
                        <button onClick={() => setReplyTo(null)} className="text-primary font-bold">Cancel</button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={replyTo ? "Write a reply..." : "Add a comment..."}
                        className="w-full p-3 pr-10 text-sm border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none h-20"
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting || !newComment.trim()}
                        className="absolute bottom-3 right-3 p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                        <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
