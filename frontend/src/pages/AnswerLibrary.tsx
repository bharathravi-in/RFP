import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { answerLibraryApi } from '@/api/client';
import { AnswerLibraryItem } from '@/types';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    MagnifyingGlassIcon,
    BookmarkIcon,
    TrashIcon,
    PencilIcon,
    ClipboardDocumentIcon,
    XMarkIcon,
    CheckIcon,
    ArrowPathIcon,
    ShieldCheckIcon,
    ArchiveBoxIcon,
    ClockIcon,
    TagIcon,
    FolderIcon,
    ChevronDownIcon,
    EyeIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import FreshnessAlerts from '@/components/library/FreshnessAlerts';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    under_review: { label: 'Under Review', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    draft: { label: 'Draft', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    archived: { label: 'Archived', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

export default function AnswerLibrary() {
    const { user } = useAuthStore();
    const canApprove = user?.role === 'admin' || user?.role === 'reviewer';

    const [items, setItems] = useState<AnswerLibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [selectedTag, setSelectedTag] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ question_text: '', answer_text: '', category: '', tags: '' });
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        loadItems();
        loadCategories();
        loadAllTags();
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => loadItems(), 300);
        return () => clearTimeout(debounce);
    }, [search, selectedCategory, selectedTag, selectedStatus]);

    const loadItems = async () => {
        try {
            const params: { search?: string; category?: string; tag?: string; status?: string } = {};
            if (search) params.search = search;
            if (selectedCategory) params.category = selectedCategory;
            if (selectedTag) params.tag = selectedTag;
            if (selectedStatus) params.status = selectedStatus;

            const response = await answerLibraryApi.list(params);
            setItems(response.data.items || []);
        } catch {
            toast.error('Failed to load library');
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const response = await answerLibraryApi.getCategories();
            setCategories(response.data.categories || []);
        } catch { /* Ignore */ }
    };

    const loadAllTags = async () => {
        try {
            const response = await answerLibraryApi.getAllTags();
            setAllTags(response.data.tags || []);
        } catch { /* Ignore */ }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this library item?')) return;
        try {
            await answerLibraryApi.delete(id);
            toast.success('Item deleted');
            loadItems();
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleApprove = async (id: number) => {
        try {
            await answerLibraryApi.approve(id);
            toast.success('Answer approved');
            loadItems();
        } catch {
            toast.error('Failed to approve');
        }
    };

    const handleArchive = async (id: number) => {
        if (!confirm('Archive this answer?')) return;
        try {
            await answerLibraryApi.archive(id);
            toast.success('Answer archived');
            loadItems();
        } catch {
            toast.error('Failed to archive');
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const startEdit = (item: AnswerLibraryItem) => {
        setEditingId(item.id);
        setEditForm({
            question_text: item.question_text,
            answer_text: item.answer_text,
            category: item.category || '',
            tags: (item.tags || []).join(', '),
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ question_text: '', answer_text: '', category: '', tags: '' });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await answerLibraryApi.update(editingId, {
                question_text: editForm.question_text,
                answer_text: editForm.answer_text,
                category: editForm.category || undefined,
                tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()) : [],
            });
            toast.success('Item updated');
            setEditingId(null);
            loadItems();
        } catch {
            toast.error('Failed to update');
        }
    };

    const getFreshness = (item: AnswerLibraryItem): 'fresh' | 'stale' | 'expired' => {
        const now = new Date();
        const nextReview = item.next_review_due ? new Date(item.next_review_due) : null;
        if (nextReview && nextReview < now) return 'expired';
        const updated = new Date(item.updated_at || item.created_at);
        const daysOld = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
        return daysOld > 90 ? 'stale' : 'fresh';
    };

    const clearFilters = () => {
        setSearch('');
        setSelectedCategory('');
        setSelectedStatus('');
        setSelectedTag('');
    };

    const hasFilters = search || selectedCategory || selectedStatus || selectedTag;

    // Stats
    const stats = {
        total: items.length,
        approved: items.filter(i => i.status === 'approved').length,
        pending: items.filter(i => i.status === 'under_review').length,
    };

    return (
        <div className="h-[calc(100vh-64px)] flex bg-gray-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
                {/* Logo/Title */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BookmarkSolidIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-gray-900">Answer Library</h1>
                            <p className="text-xs text-gray-500">{stats.total} items</p>
                        </div>
                    </div>
                </div>

                {/* Status Filters */}
                <div className="p-4 border-b border-gray-100">
                    <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">Status</h3>
                    <div className="space-y-1">
                        {[
                            { value: '', label: 'All Items', count: items.length },
                            { value: 'approved', label: 'Approved', count: items.filter(i => i.status === 'approved').length },
                            { value: 'under_review', label: 'Under Review', count: items.filter(i => i.status === 'under_review').length },
                            { value: 'draft', label: 'Drafts', count: items.filter(i => i.status === 'draft').length },
                            { value: 'archived', label: 'Archived', count: items.filter(i => i.status === 'archived').length },
                        ].map((status) => (
                            <button
                                key={status.value}
                                onClick={() => setSelectedStatus(status.value)}
                                className={clsx(
                                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                                    selectedStatus === status.value
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-gray-600 hover:bg-gray-100'
                                )}
                            >
                                <span>{status.label}</span>
                                <span className="text-xs text-gray-400">{status.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                    <div className="p-4 border-b border-gray-100">
                        <h3 className="text-xs font-medium text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <FolderIcon className="h-4 w-4" />
                            Categories
                        </h3>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                                    className={clsx(
                                        'w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors truncate',
                                        selectedCategory === cat
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tags */}
                {allTags.length > 0 && (
                    <div className="p-4 flex-1 overflow-y-auto">
                        <h3 className="text-xs font-medium text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <TagIcon className="h-4 w-4" />
                            Tags
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            {allTags.slice(0, 15).map(({ tag, count }) => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                                    className={clsx(
                                        'px-2 py-1 rounded-full text-xs transition-colors',
                                        selectedTag === tag
                                            ? 'bg-primary text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    )}
                                >
                                    {tag}
                                    <span className="ml-1 opacity-60">{count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Freshness Alerts */}
                {items.length > 0 && (
                    <div className="p-4 border-t border-gray-100">
                        <FreshnessAlerts
                            libraryItems={items.map(i => ({ id: i.id, question_text: i.question_text, answer_text: i.answer_text }))}
                            onUpdate={() => loadItems()}
                        />
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
                    <div className="flex items-center gap-4 flex-1">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search questions and answers..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
                            />
                        </div>

                        {/* Active Filters */}
                        {hasFilters && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Filters:</span>
                                {selectedCategory && (
                                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs flex items-center gap-1">
                                        {selectedCategory}
                                        <XMarkIcon className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory('')} />
                                    </span>
                                )}
                                {selectedTag && (
                                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs flex items-center gap-1">
                                        #{selectedTag}
                                        <XMarkIcon className="h-3 w-3 cursor-pointer" onClick={() => setSelectedTag('')} />
                                    </span>
                                )}
                                <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-primary">
                                    Clear all
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-green-500"></span>
                            <span className="text-gray-600">{stats.approved} Approved</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                            <span className="text-gray-600">{stats.pending} Pending</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <ArrowPathIcon className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-gray-500">Loading library...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                <BookmarkIcon className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                {hasFilters ? 'No matching items' : 'Library is empty'}
                            </h3>
                            <p className="text-gray-500 mb-4 max-w-sm">
                                {hasFilters
                                    ? 'Try adjusting your filters'
                                    : 'Start by approving answers from your proposals'}
                            </p>
                            {hasFilters && (
                                <button onClick={clearFilters} className="btn-secondary text-sm">
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => {
                                const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                                const freshness = getFreshness(item);
                                const isExpanded = expandedId === item.id;
                                const isEditing = editingId === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className={clsx(
                                            'bg-white rounded-xl border transition-all',
                                            isEditing
                                                ? 'border-primary shadow-lg ring-2 ring-primary/10'
                                                : 'border-gray-200 hover:shadow-md hover:border-gray-300'
                                        )}
                                    >
                                        {isEditing ? (
                                            /* Edit Mode */
                                            <div className="p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                                        <PencilIcon className="h-5 w-5 text-primary" />
                                                        Edit Answer
                                                    </h3>
                                                    <button onClick={cancelEdit} className="p-1 hover:bg-gray-100 rounded">
                                                        <XMarkIcon className="h-5 w-5 text-gray-500" />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                                                        <textarea
                                                            value={editForm.question_text}
                                                            onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary h-24 resize-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                                                        <textarea
                                                            value={editForm.answer_text}
                                                            onChange={(e) => setEditForm({ ...editForm, answer_text: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary h-24 resize-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.category}
                                                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                            placeholder="e.g., Security"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.tags}
                                                            onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                            placeholder="compliance, api, security"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={cancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                                                        Cancel
                                                    </button>
                                                    <button onClick={saveEdit} className="btn-primary text-sm">
                                                        <CheckIcon className="h-4 w-4" />
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* View Mode */
                                            <>
                                                <div className="p-4">
                                                    <div className="flex items-start gap-4">
                                                        {/* Document Icon */}
                                                        <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                                                            <DocumentTextIcon className="h-6 w-6 text-gray-500" />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                                                                        {item.question_text}
                                                                    </h4>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        {/* Status Badge */}
                                                                        <span className={clsx(
                                                                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                                                                            status.bg, status.text
                                                                        )}>
                                                                            <span className={clsx('h-1.5 w-1.5 rounded-full', status.dot)}></span>
                                                                            {status.label}
                                                                        </span>

                                                                        {/* Freshness */}
                                                                        {freshness === 'expired' && (
                                                                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                                                                                Expired
                                                                            </span>
                                                                        )}
                                                                        {freshness === 'stale' && (
                                                                            <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded-full text-xs font-medium">
                                                                                Needs Review
                                                                            </span>
                                                                        )}

                                                                        {/* Category */}
                                                                        {item.category && (
                                                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                                                                                {item.category}
                                                                            </span>
                                                                        )}

                                                                        {/* Usage Stats */}
                                                                        <span className="text-xs text-gray-400">
                                                                            Used {item.times_used}× • V{item.version_number}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Actions */}
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                                                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                                                                        title="View answer"
                                                                    >
                                                                        <EyeIcon className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCopy(item.answer_text)}
                                                                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                                                                        title="Copy answer"
                                                                    >
                                                                        <ClipboardDocumentIcon className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => startEdit(item)}
                                                                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                                                                        title="Edit"
                                                                    >
                                                                        <PencilIcon className="h-4 w-4" />
                                                                    </button>
                                                                    {canApprove && item.status !== 'approved' && (
                                                                        <button
                                                                            onClick={() => handleApprove(item.id)}
                                                                            className="p-2 rounded-lg hover:bg-green-100 text-green-600"
                                                                            title="Approve"
                                                                        >
                                                                            <ShieldCheckIcon className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                    {canApprove && (
                                                                        <button
                                                                            onClick={() => handleArchive(item.id)}
                                                                            className="p-2 rounded-lg hover:bg-orange-100 text-orange-600"
                                                                            title="Archive"
                                                                        >
                                                                            <ArchiveBoxIcon className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleDelete(item.id)}
                                                                        className="p-2 rounded-lg hover:bg-red-100 text-red-500"
                                                                        title="Delete"
                                                                    >
                                                                        <TrashIcon className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded Answer */}
                                                {isExpanded && (
                                                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                                            {item.answer_text}
                                                        </p>
                                                        {item.tags && item.tags.length > 0 && (
                                                            <div className="mt-3 flex items-center gap-2">
                                                                <TagIcon className="h-4 w-4 text-gray-400" />
                                                                {item.tags.map((tag) => (
                                                                    <span key={tag} className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                                                            <span>Created by {item.creator_name || 'System'}</span>
                                                            {item.reviewed_by_name && (
                                                                <span className="flex items-center gap-1 text-green-600">
                                                                    <ShieldCheckIcon className="h-3 w-3" />
                                                                    Reviewed by {item.reviewed_by_name}
                                                                </span>
                                                            )}
                                                            <span>Updated {new Date(item.updated_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
