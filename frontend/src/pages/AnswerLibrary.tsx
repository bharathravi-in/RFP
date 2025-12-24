import { useState, useEffect } from 'react';
import { answerLibraryApi } from '@/api/client';
import { AnswerLibraryItem } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    MagnifyingGlassIcon,
    BookmarkIcon,
    TrashIcon,
    PencilIcon,
    ClipboardDocumentIcon,
    FunnelIcon,
    XMarkIcon,
    CheckIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';

export default function AnswerLibrary() {
    const [items, setItems] = useState<AnswerLibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([]);
    const [showTagCloud, setShowTagCloud] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ question_text: '', answer_text: '', category: '', tags: '' });

    useEffect(() => {
        loadItems();
        loadCategories();
        loadAllTags();
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => {
            loadItems();
        }, 300);
        return () => clearTimeout(debounce);
    }, [search, selectedCategory, selectedTag]);

    const loadItems = async () => {
        try {
            const params: { search?: string; category?: string; tag?: string } = {};
            if (search) params.search = search;
            if (selectedCategory) params.category = selectedCategory;
            if (selectedTag) params.tag = selectedTag;

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
        } catch {
            // Ignore
        }
    };

    const loadAllTags = async () => {
        try {
            const response = await answerLibraryApi.getAllTags();
            setAllTags(response.data.tags || []);
        } catch {
            // Ignore
        }
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

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-surface border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-light rounded-lg">
                                <BookmarkSolidIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-text-primary">Answer Library</h1>
                                <p className="text-text-secondary text-sm">
                                    Saved answers for quick reuse across proposals
                                </p>
                            </div>
                        </div>
                        <div className="text-sm text-text-muted">
                            {items.length} saved {items.length === 1 ? 'answer' : 'answers'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[250px] relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search questions or answers..."
                            className="input w-full pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <FunnelIcon className="h-4 w-4 text-text-muted" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="input py-2"
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowTagCloud(!showTagCloud)}
                        className={clsx(
                            'px-3 py-2 text-sm rounded-lg border transition-colors',
                            showTagCloud
                                ? 'bg-primary text-white border-primary'
                                : 'border-border text-text-secondary hover:bg-surface'
                        )}
                    >
                        🏷️ Tags {allTags.length > 0 && `(${allTags.length})`}
                    </button>
                </div>

                {/* Tag Cloud */}
                {showTagCloud && allTags.length > 0 && (
                    <div className="mt-4 p-4 bg-surface border border-border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-text-primary">Filter by Tag</span>
                            {selectedTag && (
                                <button
                                    onClick={() => setSelectedTag('')}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Clear filter
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {allTags.slice(0, 30).map(({ tag, count }) => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                                    className={clsx(
                                        'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-all',
                                        selectedTag === tag
                                            ? 'bg-primary text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    )}
                                >
                                    {tag}
                                    <span className={clsx(
                                        'text-xs',
                                        selectedTag === tag ? 'text-white/70' : 'text-gray-400'
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16 bg-surface rounded-xl border border-dashed border-border">
                        <BookmarkIcon className="h-16 w-16 mx-auto text-text-muted mb-4" />
                        <h3 className="text-lg font-medium text-text-primary mb-2">
                            {search || selectedCategory ? 'No matching answers' : 'No saved answers yet'}
                        </h3>
                        <p className="text-text-secondary max-w-md mx-auto">
                            {search || selectedCategory
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Approve answers in Q&A sections and click "Save to Library" to build your reusable answer collection.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="card p-5 hover:shadow-md transition-shadow"
                            >
                                {editingId === item.id ? (
                                    // Edit Mode
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Question</label>
                                            <textarea
                                                value={editForm.question_text}
                                                onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                                                className="input w-full h-20 resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Answer</label>
                                            <textarea
                                                value={editForm.answer_text}
                                                onChange={(e) => setEditForm({ ...editForm, answer_text: e.target.value })}
                                                className="input w-full h-32 resize-none"
                                            />
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium mb-1">Category</label>
                                                <input
                                                    type="text"
                                                    value={editForm.category}
                                                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                                    className="input w-full"
                                                    placeholder="e.g., security, pricing"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
                                                <input
                                                    type="text"
                                                    value={editForm.tags}
                                                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                                                    className="input w-full"
                                                    placeholder="e.g., compliance, soc2"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={cancelEdit} className="btn-secondary">Cancel</button>
                                            <button onClick={saveEdit} className="btn-primary flex items-center gap-2">
                                                <CheckIcon className="h-4 w-4" />
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <>
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-medium text-text-primary mb-1">
                                                    {item.question_text}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                                    {item.category && (
                                                        <span className="px-2 py-0.5 bg-primary-light text-primary rounded-full">
                                                            {item.category}
                                                        </span>
                                                    )}
                                                    {item.tags?.map((tag) => (
                                                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    <span>•</span>
                                                    <span>Used {item.times_used}x</span>
                                                    {/* Freshness indicator */}
                                                    <span>•</span>
                                                    {(() => {
                                                        const now = new Date();
                                                        const updated = new Date(item.updated_at || item.created_at);
                                                        const daysOld = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
                                                        let colorClass = 'text-green-600 bg-green-100';
                                                        let label = 'Fresh';
                                                        if (daysOld > 90) {
                                                            colorClass = 'text-red-600 bg-red-100';
                                                            label = 'Stale';
                                                        } else if (daysOld > 30) {
                                                            colorClass = 'text-yellow-600 bg-yellow-100';
                                                            label = 'Review';
                                                        }
                                                        return (
                                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${colorClass}`}>
                                                                {label}
                                                            </span>
                                                        );
                                                    })()}
                                                    {item.source_project_name && (
                                                        <>
                                                            <span>•</span>
                                                            <span>From: {item.source_project_name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleCopy(item.answer_text)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 text-text-muted hover:text-text-primary"
                                                    title="Copy answer"
                                                >
                                                    <ClipboardDocumentIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => startEdit(item)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 text-text-muted hover:text-text-primary"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-600"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <p className="text-text-secondary text-sm whitespace-pre-wrap line-clamp-4">
                                                {item.answer_text}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
