import { useState, useEffect } from 'react';
import { knowledgeApi } from '@/api/client';
import { KnowledgeItem } from '@/types';
import toast from 'react-hot-toast';
import {
    PlusIcon,
    BookOpenIcon,
    MagnifyingGlassIcon,
    TagIcon,
    TrashIcon,
    PencilIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function KnowledgeBase() {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            const response = await knowledgeApi.list();
            setItems(response.data.items || []);
        } catch {
            toast.error('Failed to load knowledge base');
        } finally {
            setIsLoading(false);
        }
    };

    // Get all unique tags
    const allTags = [...new Set(items.flatMap(item => item.tags))];

    const filteredItems = items.filter(item => {
        const matchesSearch =
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = !selectedTag || item.tags.includes(selectedTag);
        return matchesSearch && matchesTag;
    });

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            await knowledgeApi.delete(id);
            setItems(items.filter(item => item.id !== id));
            toast.success('Item deleted');
        } catch {
            toast.error('Failed to delete item');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-text-primary">Knowledge Base</h1>
                    <p className="mt-1 text-text-secondary">
                        Manage your organization's knowledge for AI-powered answers
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                    <PlusIcon className="h-5 w-5" />
                    Add Knowledge
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary-light">
                            <BookOpenIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-semibold text-text-primary">{items.length}</p>
                            <p className="text-sm text-text-secondary">Total Items</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-success-light">
                            <DocumentTextIcon className="h-5 w-5 text-success" />
                        </div>
                        <div>
                            <p className="text-2xl font-semibold text-text-primary">
                                {items.filter(i => i.source_type === 'document').length}
                            </p>
                            <p className="text-sm text-text-secondary">From Documents</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-100">
                            <TagIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-semibold text-text-primary">{allTags.length}</p>
                            <p className="text-sm text-text-secondary">Tags</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search knowledge..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                    />
                </div>
                {allTags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setSelectedTag(null)}
                            className={clsx(
                                'badge cursor-pointer transition-colors',
                                !selectedTag ? 'badge-primary' : 'badge-neutral hover:bg-primary-light'
                            )}
                        >
                            All
                        </button>
                        {allTags.slice(0, 5).map(tag => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                className={clsx(
                                    'badge cursor-pointer transition-colors',
                                    selectedTag === tag ? 'badge-primary' : 'badge-neutral hover:bg-primary-light'
                                )}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Items Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="card animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                            <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-2/3" />
                        </div>
                    ))}
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="card text-center py-12">
                    <BookOpenIcon className="h-12 w-12 text-text-muted mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-text-primary mb-2">No knowledge items</h3>
                    <p className="text-text-secondary mb-6">
                        {searchQuery || selectedTag
                            ? 'Try adjusting your filters'
                            : 'Add knowledge to power your AI answers'}
                    </p>
                    {!searchQuery && !selectedTag && (
                        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                            <PlusIcon className="h-5 w-5" />
                            Add Knowledge
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => (
                        <div key={item.id} className="card group">
                            <div className="flex items-start justify-between mb-3">
                                <span className={`badge ${item.source_type === 'document' ? 'badge-primary' :
                                        item.source_type === 'csv' ? 'badge-success' :
                                            'badge-neutral'
                                    }`}>
                                    {item.source_type}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setEditingItem(item)}
                                        className="p-1.5 rounded-lg hover:bg-background text-text-muted hover:text-text-primary"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-1.5 rounded-lg hover:bg-error-light text-text-muted hover:text-error"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-semibold text-text-primary mb-2">{item.title}</h3>
                            <p className="text-sm text-text-secondary line-clamp-3 mb-3">{item.content}</p>
                            {item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {item.tags.map(tag => (
                                        <span key={tag} className="text-xs text-text-muted bg-background px-2 py-0.5 rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || editingItem) && (
                <KnowledgeModal
                    item={editingItem}
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingItem(null);
                    }}
                    onSaved={(item) => {
                        if (editingItem) {
                            setItems(items.map(i => i.id === item.id ? item : i));
                        } else {
                            setItems([item, ...items]);
                        }
                        setShowCreateModal(false);
                        setEditingItem(null);
                    }}
                />
            )}
        </div>
    );
}

function KnowledgeModal({
    item,
    onClose,
    onSaved,
}: {
    item: KnowledgeItem | null;
    onClose: () => void;
    onSaved: (item: KnowledgeItem) => void;
}) {
    const [title, setTitle] = useState(item?.title || '');
    const [content, setContent] = useState(item?.content || '');
    const [tags, setTags] = useState(item?.tags?.join(', ') || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            toast.error('Title and content are required');
            return;
        }

        setIsLoading(true);
        const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

        try {
            let response;
            if (item) {
                response = await knowledgeApi.update(item.id, { title, content, tags: tagArray });
            } else {
                response = await knowledgeApi.create({ title, content, tags: tagArray });
            }
            toast.success(item ? 'Knowledge updated!' : 'Knowledge added!');
            onSaved(response.data.item);
        } catch {
            toast.error('Failed to save knowledge');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-modal w-full max-w-lg p-6 animate-scale-in">
                <h2 className="text-xl font-semibold text-text-primary mb-6">
                    {item ? 'Edit Knowledge' : 'Add Knowledge'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">Title</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input"
                            placeholder="e.g., Company Security Policy"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="input min-h-[150px] resize-none"
                            placeholder="Enter the knowledge content..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Tags <span className="text-text-muted">(comma-separated)</span>
                        </label>
                        <input
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="input"
                            placeholder="security, compliance, policy"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                            {isLoading ? 'Saving...' : item ? 'Update' : 'Add Knowledge'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
