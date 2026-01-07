import { useState, useEffect } from 'react';
import { sectionsApi } from '@/api/client';
import { RFPSection, SectionComment, SectionPriority, AnswerSource } from '@/types';
import SourceInfoModal from '@/components/SourceInfoModal';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    XMarkIcon,
    UserIcon,
    CalendarIcon,
    FlagIcon,
    ChatBubbleLeftIcon,
    PaperAirplaneIcon,
    TrashIcon,
    DocumentTextIcon,
    ClockIcon,
    CheckCircleIcon,
    LinkIcon,
    TagIcon,
    InformationCircleIcon,
    ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';

interface User {
    id: number;
    name: string;
    email: string;
}

interface SectionDetailsSidebarProps {
    section: RFPSection;
    projectId: number;
    onUpdate: (section: RFPSection) => void;
    onClose: () => void;
    users?: User[];
    isOpen: boolean;
    defaultTab?: TabType;
}

type TabType = 'details' | 'comments' | 'history' | 'sources';

const PRIORITY_CONFIG: Record<SectionPriority, { label: string; color: string; bgColor: string; ringColor: string }> = {
    low: { label: 'Low', color: 'text-gray-600', bgColor: 'bg-gray-100', ringColor: 'ring-gray-300' },
    normal: { label: 'Normal', color: 'text-blue-600', bgColor: 'bg-blue-100', ringColor: 'ring-blue-300' },
    high: { label: 'High', color: 'text-amber-600', bgColor: 'bg-amber-100', ringColor: 'ring-amber-300' },
    urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100', ringColor: 'ring-red-300' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircleIcon }> = {
    draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: DocumentTextIcon },
    generated: { label: 'Generated', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: DocumentTextIcon },
    approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircleIcon },
    rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100', icon: XMarkIcon },
};

export default function SectionDetailsSidebar({
    section,
    projectId,
    onUpdate,
    onClose,
    users = [],
    isOpen,
    defaultTab = 'details',
}: SectionDetailsSidebarProps) {
    const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

    // Sync activeTab when defaultTab changes (e.g. clicking different icons)
    useEffect(() => {
        if (isOpen) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab, isOpen]);
    const [newComment, setNewComment] = useState('');
    const [isAddingComment, setIsAddingComment] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSource, setSelectedSource] = useState<{ source: AnswerSource | string; index: number } | null>(null);

    // Local state for form fields
    const [assignedTo, setAssignedTo] = useState<number | null>(section.assigned_to || null);
    const [dueDate, setDueDate] = useState(section.due_date || '');
    const [priority, setPriority] = useState<SectionPriority>(section.priority || 'normal');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');

    // Sync when section changes
    useEffect(() => {
        setAssignedTo(section.assigned_to || null);
        setDueDate(section.due_date || '');
        setPriority(section.priority || 'normal');
    }, [section.id]);

    const handleSaveDetails = async () => {
        setIsSaving(true);
        try {
            const response = await sectionsApi.updateSection(projectId, section.id, {
                assigned_to: assignedTo,
                due_date: dueDate || null,
                priority,
            });
            onUpdate(response.data.section);
            toast.success('Section details saved');
        } catch {
            toast.error('Failed to save details');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        setIsAddingComment(true);
        try {
            const response = await sectionsApi.addComment(section.id, newComment.trim());
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

    const handleAddTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter((t) => t !== tagToRemove));
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

    const isOverdue = dueDate && new Date(dueDate) < new Date() && section.status !== 'approved';
    const statusConfig = STATUS_CONFIG[section.status] || STATUS_CONFIG.draft;

    const tabs: { id: TabType; label: string; icon: typeof UserIcon; count?: number }[] = [
        { id: 'details', label: 'Details', icon: InformationCircleIcon },
        { id: 'comments', label: 'Comments', icon: ChatBubbleLeftIcon, count: section.comments?.length },
        { id: 'history', label: 'History', icon: ClockIcon },
        { id: 'sources', label: 'Sources', icon: LinkIcon },
    ];

    if (!isOpen) return null;

    return (
        <div className="w-[420px] h-full border-l border-border bg-white flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{section.section_type?.icon || '📄'}</span>
                    <div>
                        <h3 className="font-semibold text-text-primary text-sm truncate max-w-[220px]">
                            {section.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={clsx(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                statusConfig.bgColor,
                                statusConfig.color
                            )}>
                                {statusConfig.label}
                            </span>
                            {isOverdue && (
                                <span className="text-xs text-red-500 font-medium">Overdue</span>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-background transition-colors text-text-muted hover:text-text-primary"
                >
                    <ChevronDoubleRightIcon className="h-5 w-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-background">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative',
                                activeTab === tab.id
                                    ? 'text-primary border-b-2 border-primary bg-white'
                                    : 'text-text-muted hover:text-text-primary hover:bg-white/50'
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={clsx(
                                    'ml-1 px-1.5 py-0.5 rounded-full text-xs',
                                    activeTab === tab.id ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'details' && (
                    <div className="p-4 space-y-5">
                        {/* Status (Read-only) */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-text-muted mb-2">
                                <CheckCircleIcon className="h-4 w-4" />
                                Status
                            </label>
                            <div className={clsx(
                                'px-4 py-3 rounded-lg flex items-center gap-3',
                                statusConfig.bgColor
                            )}>
                                <statusConfig.icon className={clsx('h-5 w-5', statusConfig.color)} />
                                <span className={clsx('font-medium', statusConfig.color)}>
                                    {statusConfig.label}
                                </span>
                            </div>
                        </div>

                        {/* AI Confidence Score */}
                        {section.confidence_score !== null && section.confidence_score !== undefined && (
                            <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                                <label className="flex items-center gap-2 text-xs font-medium text-purple-700 mb-3">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                    AI Confidence Score
                                </label>

                                {/* Score Display */}
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="text-3xl font-bold text-purple-600">
                                        {Math.round(section.confidence_score * 100)}%
                                    </div>
                                    <div className="flex-1">
                                        <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                                            <div
                                                className={clsx(
                                                    'h-full rounded-full transition-all duration-500',
                                                    section.confidence_score >= 0.8 ? 'bg-green-500' :
                                                        section.confidence_score >= 0.6 ? 'bg-amber-500' :
                                                            'bg-red-500'
                                                )}
                                                style={{ width: `${section.confidence_score * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Score Explanation */}
                                <div className={clsx(
                                    'text-xs p-2 rounded',
                                    section.confidence_score >= 0.8 ? 'bg-green-50 text-green-700' :
                                        section.confidence_score >= 0.6 ? 'bg-amber-50 text-amber-700' :
                                            'bg-red-50 text-red-700'
                                )}>
                                    {section.confidence_score >= 0.8 ? (
                                        <>✅ <strong>High confidence</strong> - Content is well-supported by knowledge base sources.</>
                                    ) : section.confidence_score >= 0.6 ? (
                                        <>⚠️ <strong>Medium confidence</strong> - Some content may need verification.</>
                                    ) : (
                                        <>❌ <strong>Low confidence</strong> - Consider reviewing and editing this content.</>
                                    )}
                                </div>

                                {/* What affects score */}
                                <details className="mt-3">
                                    <summary className="text-xs text-purple-600 cursor-pointer hover:underline">
                                        What affects this score?
                                    </summary>
                                    <ul className="mt-2 text-xs text-text-muted space-y-1 pl-4">
                                        <li>• Relevance to knowledge base documents</li>
                                        <li>• Number of source citations found</li>
                                        <li>• Alignment with company information</li>
                                        <li>• Content freshness and accuracy</li>
                                    </ul>
                                </details>
                            </div>
                        )}

                        {/* Assignee */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-text-muted mb-2">
                                <UserIcon className="h-4 w-4" />
                                Assignee
                            </label>
                            <select
                                value={assignedTo || ''}
                                onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-4 py-3 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            >
                                <option value="">Unassigned</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Due Date */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-text-muted mb-2">
                                <CalendarIcon className={clsx('h-4 w-4', isOverdue && 'text-red-500')} />
                                Due Date
                                {isOverdue && (
                                    <span className="text-red-500 text-xs ml-auto">Overdue!</span>
                                )}
                            </label>
                            <input
                                type="datetime-local"
                                value={dueDate ? dueDate.slice(0, 16) : ''}
                                onChange={(e) => setDueDate(e.target.value)}
                                className={clsx(
                                    'w-full px-4 py-3 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 transition-all',
                                    isOverdue
                                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                        : 'border-border focus:border-primary focus:ring-primary/20'
                                )}
                            />
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-text-muted mb-2">
                                <FlagIcon className="h-4 w-4" />
                                Priority
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {(Object.keys(PRIORITY_CONFIG) as SectionPriority[]).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPriority(p)}
                                        className={clsx(
                                            'px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-center',
                                            priority === p
                                                ? `${PRIORITY_CONFIG[p].bgColor} ${PRIORITY_CONFIG[p].color} ring-2 ${PRIORITY_CONFIG[p].ringColor}`
                                                : 'bg-gray-50 text-text-secondary hover:bg-gray-100 border border-border'
                                        )}
                                    >
                                        {PRIORITY_CONFIG[p].label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-text-muted mb-2">
                                <TagIcon className="h-4 w-4" />
                                Tags
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="px-2.5 py-1 bg-primary-light text-primary rounded-full text-xs font-medium flex items-center gap-1"
                                    >
                                        {tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:text-red-500"
                                        >
                                            <XMarkIcon className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                    placeholder="Add tag..."
                                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                                <button
                                    onClick={handleAddTag}
                                    disabled={!newTag.trim()}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSaveDetails}
                            disabled={isSaving}
                            className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <CheckCircleIcon className="h-5 w-5" />
                            )}
                            Save Changes
                        </button>
                    </div>
                )}

                {activeTab === 'comments' && (
                    <div className="p-4 flex flex-col h-full">
                        {/* Comments List */}
                        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                            {section.comments && section.comments.length > 0 ? (
                                section.comments.map((comment: SectionComment) => (
                                    <div
                                        key={comment.id}
                                        className="bg-background rounded-lg p-3 group hover:shadow-sm transition-shadow"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                                                        {comment.user_name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-sm text-text-primary block">
                                                            {comment.user_name}
                                                        </span>
                                                        <span className="text-xs text-text-muted">
                                                            {formatDate(comment.created_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-text-secondary mt-2 pl-9">
                                                    {comment.text}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Delete comment"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <ChatBubbleLeftIcon className="h-12 w-12 text-text-muted mx-auto mb-3" />
                                    <p className="text-text-muted text-sm">No comments yet</p>
                                    <p className="text-text-muted text-xs mt-1">Be the first to add a comment</p>
                                </div>
                            )}
                        </div>

                        {/* Add Comment Input */}
                        <div className="border-t border-border pt-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                    placeholder="Write a comment..."
                                    className="flex-1 px-4 py-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                                <button
                                    onClick={handleAddComment}
                                    disabled={!newComment.trim() || isAddingComment}
                                    className={clsx(
                                        'px-4 py-3 rounded-lg transition-colors',
                                        newComment.trim()
                                            ? 'bg-primary text-white hover:bg-primary-dark'
                                            : 'bg-gray-100 text-text-muted cursor-not-allowed'
                                    )}
                                >
                                    {isAddingComment ? (
                                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                                    ) : (
                                        <PaperAirplaneIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="p-4">
                        <div className="text-center py-12">
                            <ClockIcon className="h-12 w-12 text-text-muted mx-auto mb-3" />
                            <p className="text-text-muted text-sm">Version history</p>
                            <p className="text-text-muted text-xs mt-1">Track changes and restore previous versions</p>
                            <button className="mt-4 btn-secondary text-sm">
                                View Full History
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'sources' && (
                    <div className="p-4">
                        <div className="py-4">
                            <div className="flex items-center gap-2 mb-4">
                                <LinkIcon className="h-5 w-5 text-text-muted" />
                                <span className="font-medium text-text-primary text-sm">Knowledge Sources</span>
                            </div>
                            <p className="text-text-muted text-xs mb-4">Documents and data used to generate this section</p>
                            {section.sources && section.sources.filter(s => typeof s === 'string' || !s.relevance || s.relevance > 0.01).length > 0 ? (
                                <div>
                                    {/* Source Count Header */}
                                    <p className="text-sm text-gray-600 mb-3">
                                        <span className="font-medium">{section.sources.filter(s => typeof s === 'string' || !s.relevance || s.relevance > 0.01).length}</span> source{section.sources.filter(s => typeof s === 'string' || !s.relevance || s.relevance > 0.01).length !== 1 ? 's' : ''} used
                                    </p>

                                    {/* Numbered Source Buttons */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {section.sources.filter(s => typeof s === 'string' || !s.relevance || s.relevance > 0.01).map((source, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedSource({ source, index: idx })}
                                                className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-primary-light hover:text-primary hover:border-primary transition-colors"
                                                title={typeof source === 'string' ? source : source.title || `Source ${idx + 1}`}
                                            >
                                                {idx + 1}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Source List with Details */}
                                    <div className="space-y-2 mt-4">
                                        {section.sources.filter(s => typeof s === 'string' || !s.relevance || s.relevance > 0.01).map((source, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedSource({ source, index: idx })}
                                                className="w-full p-3 bg-background rounded-lg border border-border hover:border-primary hover:shadow-sm transition-all text-left group"
                                            >
                                                <div className="flex items-start gap-2">
                                                    <div className="w-6 h-6 flex items-center justify-center bg-primary-light text-primary rounded text-xs font-bold flex-shrink-0">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-medium text-text-primary block truncate group-hover:text-primary">
                                                            {typeof source === 'string' ? source : source.title || 'Source'}
                                                        </span>
                                                        {typeof source !== 'string' && source.relevance && (
                                                            <div className="mt-1 flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-primary rounded-full"
                                                                        style={{ width: `${source.relevance * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs text-text-muted">
                                                                    {Math.round(source.relevance * 100)}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <LinkIcon className="h-10 w-10 text-text-muted mx-auto mb-2" />
                                    <p className="text-xs text-text-muted">No sources cited</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Source Info Modal */}
            {selectedSource && (
                <SourceInfoModal
                    source={typeof selectedSource.source === 'string'
                        ? { title: selectedSource.source, relevance: 0 }
                        : selectedSource.source
                    }
                    sourceIndex={selectedSource.index}
                    isOpen={!!selectedSource}
                    onClose={() => setSelectedSource(null)}
                />
            )}
        </div>
    );
}
