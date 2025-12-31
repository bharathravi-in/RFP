import { useState, useEffect } from 'react';
import {
    ClockIcon,
    ArrowPathIcon,
    XMarkIcon,
    DocumentDuplicateIcon,
    CheckCircleIcon,
    ArrowUturnLeftIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import { sectionsApi } from '@/api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface TemplateVersion {
    id: number;
    version_number: number;
    name: string;
    content: string;
    variables: string[];
    description?: string;
    created_at: string;
    created_by_name?: string;
    change_summary?: string;
    is_current: boolean;
}

interface TemplateVersionHistoryProps {
    templateId: number;
    templateName: string;
    isOpen: boolean;
    onClose: () => void;
    onRestore?: (versionId: number) => void;
}

export default function TemplateVersionHistory({
    templateId,
    templateName,
    isOpen,
    onClose,
    onRestore,
}: TemplateVersionHistoryProps) {
    const [versions, setVersions] = useState<TemplateVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null);
    const [restoring, setRestoring] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadVersions();
        }
    }, [isOpen, templateId]);

    const loadVersions = async () => {
        try {
            setLoading(true);
            // For now, use mock data - would integrate with API
            // const response = await sectionsApi.getTemplateHistory(templateId);
            // setVersions(response.data.versions);

            // Mock versions for demonstration
            setVersions([
                {
                    id: 1,
                    version_number: 3,
                    name: templateName,
                    content: 'Current template content with all latest updates.',
                    variables: ['{{company_name}}', '{{project_name}}'],
                    description: 'Added company_name variable',
                    created_at: new Date().toISOString(),
                    created_by_name: 'Current User',
                    change_summary: 'Added new variable for company name',
                    is_current: true,
                },
                {
                    id: 2,
                    version_number: 2,
                    name: templateName,
                    content: 'Previous version content.',
                    variables: ['{{project_name}}'],
                    created_at: new Date(Date.now() - 86400000).toISOString(),
                    created_by_name: 'Jane Doe',
                    change_summary: 'Updated formatting',
                    is_current: false,
                },
                {
                    id: 3,
                    version_number: 1,
                    name: templateName,
                    content: 'Original template content.',
                    variables: ['{{project_name}}'],
                    created_at: new Date(Date.now() - 172800000).toISOString(),
                    created_by_name: 'John Smith',
                    change_summary: 'Initial version',
                    is_current: false,
                },
            ]);
        } catch (error) {
            console.error('Failed to load template versions:', error);
            toast.error('Failed to load version history');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (version: TemplateVersion) => {
        if (version.is_current) {
            toast.error('This is already the current version');
            return;
        }

        if (!confirm(`Restore template to version ${version.version_number}? This will create a new version with the restored content.`)) {
            return;
        }

        try {
            setRestoring(true);
            // Would integrate with API
            // await sectionsApi.restoreTemplateVersion(templateId, version.version_number);

            toast.success(`Restored to version ${version.version_number}`);
            onRestore?.(version.id);
            await loadVersions();
        } catch (error) {
            console.error('Failed to restore version:', error);
            toast.error('Failed to restore version');
        } finally {
            setRestoring(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <ClockIcon className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-bold text-text-primary">Version History</h2>
                        </div>
                        <p className="text-sm text-text-muted mt-1">{templateName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-background rounded-lg transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5 text-text-muted" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Version List */}
                    <div className="w-1/2 border-r border-border overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-48">
                                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary opacity-50" />
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
                                <DocumentDuplicateIcon className="h-12 w-12 mb-2" />
                                <p>No version history</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {versions.map((version) => (
                                    <div
                                        key={version.id}
                                        onClick={() => setSelectedVersion(version)}
                                        className={clsx(
                                            'p-4 cursor-pointer hover:bg-background transition-colors',
                                            selectedVersion?.id === version.id && 'bg-primary/5 border-l-2 border-l-primary'
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-text-primary">
                                                v{version.version_number}
                                            </span>
                                            {version.is_current && (
                                                <span className="flex items-center gap-1 text-xs bg-success-light text-success px-2 py-0.5 rounded-full">
                                                    <CheckCircleIcon className="h-3 w-3" />
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-text-muted">
                                            {formatDate(version.created_at)}
                                            {version.created_by_name && ` by ${version.created_by_name}`}
                                        </p>
                                        {version.change_summary && (
                                            <p className="text-sm text-text-secondary mt-1 line-clamp-1">
                                                {version.change_summary}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Preview Pane */}
                    <div className="w-1/2 flex flex-col">
                        {selectedVersion ? (
                            <>
                                <div className="p-4 border-b border-border bg-background/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold text-text-primary">
                                            Version {selectedVersion.version_number}
                                        </h3>
                                        {!selectedVersion.is_current && (
                                            <button
                                                onClick={() => handleRestore(selectedVersion)}
                                                disabled={restoring}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                                            >
                                                <ArrowUturnLeftIcon className="h-4 w-4" />
                                                Restore
                                            </button>
                                        )}
                                    </div>
                                    {selectedVersion.variables.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {selectedVersion.variables.map((v) => (
                                                <span
                                                    key={v}
                                                    className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded"
                                                >
                                                    {v}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto">
                                    <pre className="text-sm text-text-secondary whitespace-pre-wrap font-mono bg-background p-4 rounded-lg">
                                        {selectedVersion.content}
                                    </pre>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted">
                                <EyeIcon className="h-12 w-12 mb-2" />
                                <p>Select a version to preview</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-border bg-background/50 text-center">
                    <p className="text-xs text-text-muted">
                        Click a version to preview • Restoring creates a new version with the old content
                    </p>
                </div>
            </div>
        </div>
    );
}
