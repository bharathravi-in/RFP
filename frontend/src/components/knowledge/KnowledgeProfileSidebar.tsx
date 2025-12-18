import { useState, useEffect } from 'react';
import { XMarkIcon, DocumentTextIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import { Link } from 'react-router-dom';

interface KnowledgeItem {
    id: number;
    title: string;
    content: string;
    source_type: string;
    file_type?: string;
    created_at: string;
    geography?: string;
    client_type?: string;
    industry?: string;
}

interface KnowledgeProfile {
    id: number;
    name: string;
    geographies?: string[];
    industries?: string[];
    client_types?: string[];
}

interface Props {
    isOpen: boolean;
    profile: KnowledgeProfile | null;
    onClose: () => void;
}

export default function KnowledgeProfileSidebar({ isOpen, profile, onClose }: Props) {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && profile) {
            loadItems();
        }
    }, [isOpen, profile]);

    const loadItems = async () => {
        if (!profile) return;

        setIsLoading(true);
        try {
            const response = await api.get('/knowledge', {
                params: { knowledge_profile_id: profile.id }
            });
            setItems(response.data.items || []);
        } catch (error) {
            console.error('Failed to load items:', error);
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 z-40"
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className="fixed right-0 top-0 h-full w-96 bg-surface shadow-xl z-50 flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center">
                            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="font-semibold text-text-primary">{profile?.name}</h2>
                            <p className="text-sm text-text-muted">{items.length} knowledge items</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-background transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5 text-text-secondary" />
                    </button>
                </div>

                {/* Profile Details */}
                {profile && (
                    <div className="p-4 border-b border-border bg-background/50">
                        <div className="flex flex-wrap gap-2 text-xs">
                            {profile.geographies && profile.geographies.length > 0 && (
                                <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">
                                    🌍 {profile.geographies.slice(0, 3).join(', ')}
                                </span>
                            )}
                            {profile.industries && profile.industries.length > 0 && (
                                <span className="px-2 py-1 rounded bg-green-100 text-green-700">
                                    🏢 {profile.industries.slice(0, 3).join(', ')}
                                </span>
                            )}
                            {profile.client_types && profile.client_types.length > 0 && (
                                <span className="px-2 py-1 rounded bg-purple-100 text-purple-700">
                                    👥 {profile.client_types.slice(0, 2).join(', ')}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-8 text-text-muted">
                            <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p>No knowledge items linked to this profile</p>
                            <p className="text-sm mt-2">Upload documents with this profile selected</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary-light/10 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 rounded flex-shrink-0 bg-background flex items-center justify-center">
                                            <DocumentTextIcon className="h-4 w-4 text-text-secondary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-text-primary text-sm truncate">
                                                {item.title}
                                            </p>
                                            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                                                {item.content.slice(0, 100)}...
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-background text-text-muted">
                                                    {item.source_type}
                                                </span>
                                                {item.geography && (
                                                    <span className="text-xs text-text-muted">
                                                        📍 {item.geography}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-background/50">
                    <Link
                        to="/knowledge"
                        className="btn-secondary w-full flex items-center justify-center gap-2"
                    >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        View in Knowledge Base
                    </Link>
                </div>
            </div>
        </>
    );
}
