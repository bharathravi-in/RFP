import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '@/api/client';
import clsx from 'clsx';
import {
    MagnifyingGlassIcon,
    XMarkIcon,
    FolderIcon,
    BookmarkIcon,
    BookOpenIcon,
    ArrowRightIcon,
    CommandLineIcon,
} from '@heroicons/react/24/outline';

interface SearchResult {
    type: 'project' | 'answer' | 'knowledge';
    id: number;
    title: string;
    description: string;
    score: number;
    url: string;
    metadata?: {
        status?: string;
        category?: string;
        tags?: string[];
        times_used?: number;
        completion?: number;
    };
}

interface SmartSearchProps {
    onClose: () => void;
}

export default function SmartSearch({ onClose }: SmartSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [categories, setCategories] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Search debounce
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await searchApi.smart(query, {
                    categories: categories.length > 0 ? categories : undefined,
                    limit: 15,
                });
                setResults(response.data.results || []);
                setSelectedIndex(0);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [query, categories]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    navigate(results[selectedIndex].url);
                    onClose();
                }
                break;
            case 'Escape':
                onClose();
                break;
        }
    }, [results, selectedIndex, navigate, onClose]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'project':
                return FolderIcon;
            case 'answer':
                return BookmarkIcon;
            case 'knowledge':
                return BookOpenIcon;
            default:
                return FolderIcon;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'project':
                return 'Project';
            case 'answer':
                return 'Answer';
            case 'knowledge':
                return 'Knowledge';
            default:
                return type;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'project':
                return 'bg-blue-100 text-blue-700';
            case 'answer':
                return 'bg-purple-100 text-purple-700';
            case 'knowledge':
                return 'bg-green-100 text-green-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const toggleCategory = (cat: string) => {
        setCategories((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        );
    };

    return (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="fixed inset-0 flex items-start justify-center pt-20 px-4 pointer-events-none">
                <div
                    className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden pointer-events-auto"
                    onKeyDown={handleKeyDown}
                >
                    {/* Search Input */}
                    <div className="flex items-center border-b border-border">
                        <MagnifyingGlassIcon className="h-5 w-5 text-text-muted ml-4" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search projects, answers, knowledge..."
                            className="w-full px-4 py-4 text-lg focus:outline-none bg-transparent text-text-primary placeholder:text-text-muted"
                        />
                        <div className="flex items-center gap-2 pr-4">
                            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs text-text-muted bg-gray-100 rounded">
                                ESC
                            </kbd>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-100 rounded-lg md:hidden"
                            >
                                <XMarkIcon className="h-5 w-5 text-text-muted" />
                            </button>
                        </div>
                    </div>

                    {/* Category Filters */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-gray-50">
                        <span className="text-xs text-text-muted">Filter:</span>
                        {['projects', 'answers', 'knowledge'].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className={clsx(
                                    'px-2 py-1 text-xs rounded-full transition-colors capitalize',
                                    categories.includes(cat)
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-200 text-text-secondary hover:bg-gray-300'
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Results */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                        ) : query.length < 2 ? (
                            <div className="py-12 text-center">
                                <CommandLineIcon className="h-10 w-10 mx-auto text-text-muted mb-3" />
                                <p className="text-text-secondary">
                                    Start typing to search...
                                </p>
                                <p className="text-xs text-text-muted mt-2">
                                    Try natural language like "security compliance for government"
                                </p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="py-12 text-center">
                                <MagnifyingGlassIcon className="h-10 w-10 mx-auto text-text-muted mb-3" />
                                <p className="text-text-secondary">
                                    No results for "{query}"
                                </p>
                                <p className="text-xs text-text-muted mt-1">
                                    Try different keywords or remove filters
                                </p>
                            </div>
                        ) : (
                            <div className="py-2">
                                {results.map((result, index) => {
                                    const TypeIcon = getTypeIcon(result.type);
                                    return (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            onClick={() => {
                                                navigate(result.url);
                                                onClose();
                                            }}
                                            className={clsx(
                                                'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                                                index === selectedIndex
                                                    ? 'bg-primary-50'
                                                    : 'hover:bg-gray-50'
                                            )}
                                        >
                                            <div className={clsx('p-2 rounded-lg', getTypeColor(result.type))}>
                                                <TypeIcon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-medium text-text-primary truncate">
                                                        {result.title}
                                                    </span>
                                                    <span className={clsx(
                                                        'text-[10px] px-1.5 py-0.5 rounded',
                                                        getTypeColor(result.type)
                                                    )}>
                                                        {getTypeLabel(result.type)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-text-secondary truncate">
                                                    {result.description}
                                                </p>
                                                {result.metadata?.tags && result.metadata.tags.length > 0 && (
                                                    <div className="flex gap-1 mt-1">
                                                        {result.metadata.tags.slice(0, 3).map((tag) => (
                                                            <span
                                                                key={tag}
                                                                className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-text-muted rounded"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <ArrowRightIcon className="h-4 w-4 text-text-muted flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 bg-gray-50 border-t border-border flex items-center justify-between text-xs text-text-muted">
                        <div className="flex items-center gap-4">
                            <span className="hidden sm:flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↑</kbd>
                                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↓</kbd>
                                Navigate
                            </span>
                            <span className="hidden sm:flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↵</kbd>
                                Select
                            </span>
                        </div>
                        <span>
                            {results.length > 0 && `${results.length} results`}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
