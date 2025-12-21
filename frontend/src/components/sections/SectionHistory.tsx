import { useState, useEffect } from 'react';
import { ClockIcon, ArrowPathIcon, XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { sectionsApi } from '@/api/client';
import { SectionVersion } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface SectionHistoryProps {
    sectionId: number;
    currentVersion: number;
    isOpen: boolean;
    onClose: () => void;
    onRestore: () => void;
}

export default function SectionHistory({
    sectionId,
    currentVersion,
    isOpen,
    onClose,
    onRestore
}: SectionHistoryProps) {
    const [history, setHistory] = useState<SectionVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<SectionVersion | null>(null);

    useEffect(() => {
        if (isOpen && sectionId) {
            loadHistory();
        }
    }, [isOpen, sectionId]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const response = await sectionsApi.getHistory(sectionId);
            setHistory(response.data.history || []);
        } catch (error) {
            console.error('Failed to load section history:', error);
            toast.error('Failed to load section history');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (version: SectionVersion) => {
        if (!confirm(`Restore to version ${version.version_number}? Your current content will be saved as a backup.`)) {
            return;
        }

        setRestoring(true);
        try {
            await sectionsApi.restoreVersion(sectionId, version.version_number);
            toast.success(`Restored to version ${version.version_number}`);
            onRestore();
            onClose();
        } catch (error) {
            console.error('Failed to restore version:', error);
            toast.error('Failed to restore version');
        } finally {
            setRestoring(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getChangeTypeColor = (changeType: string) => {
        switch (changeType) {
            case 'generate': return 'bg-emerald-100 text-emerald-700';
            case 'regenerate': return 'bg-blue-100 text-blue-700';
            case 'restore': return 'bg-amber-100 text-amber-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getChangeTypeLabel = (changeType: string) => {
        switch (changeType) {
            case 'generate': return 'AI Generated';
            case 'regenerate': return 'Regenerated';
            case 'restore': return 'Restored';
            default: return 'Edited';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <ClockIcon className="h-6 w-6 text-primary" />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Section History</h2>
                            <p className="text-sm text-gray-500">Current version: v{currentVersion}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <DocumentTextIcon className="h-12 w-12 text-gray-300 mb-3" />
                            <p className="text-gray-500">No version history yet</p>
                            <p className="text-sm text-gray-400 mt-1">
                                History is saved when you edit or generate content
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {history.map((version) => (
                                <div
                                    key={version.id}
                                    className={clsx(
                                        'p-4 hover:bg-gray-50 transition-colors cursor-pointer',
                                        selectedVersion?.id === version.id && 'bg-primary-light'
                                    )}
                                    onClick={() => setSelectedVersion(
                                        selectedVersion?.id === version.id ? null : version
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-gray-900">
                                                    Version {version.version_number}
                                                </span>
                                                <span className={clsx(
                                                    'text-xs px-2 py-0.5 rounded-full',
                                                    getChangeTypeColor(version.change_type)
                                                )}>
                                                    {getChangeTypeLabel(version.change_type)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                {formatDate(version.created_at)}
                                                {version.changed_by_name && (
                                                    <span> by {version.changed_by_name}</span>
                                                )}
                                            </p>
                                            {version.change_summary && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {version.change_summary}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRestore(version);
                                            }}
                                            disabled={restoring}
                                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                                        >
                                            <ArrowPathIcon className="h-4 w-4" />
                                            Restore
                                        </button>
                                    </div>

                                    {/* Preview content when selected */}
                                    {selectedVersion?.id === version.id && version.content && (
                                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <p className="text-xs font-medium text-gray-500 mb-2">Content Preview</p>
                                            <div className="text-sm text-gray-700 max-h-40 overflow-y-auto whitespace-pre-wrap">
                                                {version.content.substring(0, 500)}
                                                {version.content.length > 500 && '...'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                        Click on a version to preview · Restoring creates a backup of current content
                    </p>
                </div>
            </div>
        </div>
    );
}
