import { useState, useEffect, useCallback } from 'react';
import { versionsApi, projectsApi } from '@/api/client';
import { Project, ProposalVersion } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    PlusIcon,
    TrashIcon,
    ArrowDownTrayIcon,
    ClockIcon,
    DocumentDuplicateIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    ArrowsRightLeftIcon,
    PencilSquareIcon,
    Squares2X2Icon,
    ListBulletIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';
import VersionComparison from '@/components/versions/VersionComparison';
import VersionTimeline from '@/components/versions/VersionTimeline';

// Create Version Modal Component
function CreateVersionModal({
    isOpen,
    onClose,
    onSubmit,
    isCreating,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (title: string, description: string) => void;
    isCreating: boolean;
}) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }
        onSubmit(title, description);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">
                <div className="bg-gradient-to-r from-primary to-purple-600 px-6 py-4">
                    <h2 className="text-lg font-semibold text-white">Save New Version</h2>
                    <p className="text-white/80 text-sm mt-1">
                        Create a snapshot of the current proposal
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Version Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Draft v1, Final Review, Client Version"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description (optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Notes about this version..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm h-24 resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                            disabled={isCreating}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <>
                                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Saving...
                                </>
                            ) : (
                                'Save Version'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Restore Version Confirmation Modal
function RestoreVersionModal({
    isOpen,
    onClose,
    onConfirm,
    version,
    isRestoring,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    version: ProposalVersion | null;
    isRestoring: boolean;
}) {
    if (!isOpen || !version) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <ExclamationTriangleIcon className="h-6 w-6 text-white" />
                        <h2 className="text-lg font-semibold text-white">Restore Version</h2>
                    </div>
                    <p className="text-white/80 text-sm mt-1">
                        Restore to v{version.version_number}: {version.title}
                    </p>
                </div>
                <div className="p-6">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-amber-800">
                            <strong>Warning:</strong> This will replace all current proposal sections with the content from this version.
                        </p>
                        <p className="text-sm text-amber-700 mt-2">
                            A backup of your current state will be automatically created before restoring.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                            disabled={isRestoring}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            disabled={isRestoring}
                        >
                            {isRestoring ? (
                                <>
                                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Restoring...
                                </>
                            ) : (
                                'Restore Version'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Branch Version Modal (Edit as Draft)
function BranchVersionModal({
    isOpen,
    onClose,
    onConfirm,
    version,
    isBranching,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    version: ProposalVersion | null;
    isBranching: boolean;
}) {
    if (!isOpen || !version) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">
                <div className="bg-gradient-to-r from-primary to-indigo-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <PencilSquareIcon className="h-6 w-6 text-white" />
                        <h2 className="text-lg font-semibold text-white">Edit as Draft</h2>
                    </div>
                    <p className="text-white/80 text-sm mt-1">
                        v{version.version_number}: {version.title}
                    </p>
                </div>
                <div className="p-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-blue-800">
                            <strong>This will:</strong> Replace your current proposal sections with the content from this version, allowing you to continue editing from this point.
                        </p>
                        <p className="text-sm text-blue-700 mt-2">
                            All sections will be reset to "draft" status for editing.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                            disabled={isBranching}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            disabled={isBranching}
                        >
                            {isBranching ? (
                                <>
                                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Creating Draft...
                                </>
                            ) : (
                                'Edit This Version'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface VersionHistoryProps {
    projectId: number;
    onRestoreSuccess?: () => void;
}

export default function VersionHistory({ projectId, onRestoreSuccess }: VersionHistoryProps) {
    const [project, setProject] = useState<Project | null>(null);
    const [versions, setVersions] = useState<ProposalVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<ProposalVersion | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [versionToRestore, setVersionToRestore] = useState<ProposalVersion | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [compareMode, setCompareMode] = useState(false);
    const [selectedForCompare, setSelectedForCompare] = useState<ProposalVersion[]>([]);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [versionToBranch, setVersionToBranch] = useState<ProposalVersion | null>(null);
    const [isBranching, setIsBranching] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline');

    const loadData = useCallback(async () => {
        if (!projectId) return;

        try {
            const [projectRes, versionsRes] = await Promise.all([
                projectsApi.get(projectId),
                versionsApi.list(projectId),
            ]);
            setProject(projectRes.data.project);
            setVersions(versionsRes.data.versions || []);

            if (versionsRes.data.versions?.length > 0 && !selectedVersion) {
                setSelectedVersion(versionsRes.data.versions[0]);
            }
        } catch {
            toast.error('Failed to load versions');
        } finally {
            setIsLoading(false);
        }
    }, [projectId, selectedVersion]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateVersion = async (title: string, description: string) => {
        setIsCreating(true);
        try {
            const response = await versionsApi.create(projectId, { title, description });
            toast.success('Version saved successfully!');
            setShowCreateModal(false);
            const versionsRes = await versionsApi.list(projectId);
            setVersions(versionsRes.data.versions || []);
            setSelectedVersion(response.data.version);
            setPreviewKey((k) => k + 1);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create version');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteVersion = async (versionId: number) => {
        if (!confirm('Are you sure you want to delete this version?')) return;

        try {
            await versionsApi.delete(versionId);
            toast.success('Version deleted');
            const versionsRes = await versionsApi.list(projectId);
            setVersions(versionsRes.data.versions || []);
            if (selectedVersion?.id === versionId) {
                setSelectedVersion(versionsRes.data.versions?.[0] || null);
                setPreviewKey((k) => k + 1);
            }
        } catch {
            toast.error('Failed to delete version');
        }
    };

    const handleRestoreVersion = async () => {
        if (!versionToRestore) return;

        setIsRestoring(true);
        try {
            const response = await versionsApi.restore(versionToRestore.id);
            toast.success(response.data.message || `Restored to version ${versionToRestore.version_number}`);
            setShowRestoreModal(false);
            setVersionToRestore(null);
            const versionsRes = await versionsApi.list(projectId);
            setVersions(versionsRes.data.versions || []);
            if (onRestoreSuccess) onRestoreSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to restore version');
        } finally {
            setIsRestoring(false);
        }
    };

    const handleBranchVersion = async () => {
        if (!versionToBranch) return;

        setIsBranching(true);
        try {
            const response = await versionsApi.branch(versionToBranch.id, 'replace');
            toast.success(response.data.message || `Created editable draft from version ${versionToBranch.version_number}`);
            setShowBranchModal(false);
            setVersionToBranch(null);
            if (onRestoreSuccess) onRestoreSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create draft from version');
        } finally {
            setIsBranching(false);
        }
    };

    const handleDownload = async (version: ProposalVersion) => {
        const url = versionsApi.getDownloadUrl(version.id);
        const token = localStorage.getItem('access_token');

        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${project?.name || 'proposal'}_v${version.version_number}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch {
            toast.error('Failed to download');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
                    <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
                </div>
                <div className="flex items-center gap-3">
                    {compareMode ? (
                        <>
                            <span className="text-sm text-gray-500">
                                {selectedForCompare.length}/2 selected
                            </span>
                            <button
                                onClick={() => selectedForCompare.length === 2 && setShowCompareModal(true)}
                                disabled={selectedForCompare.length !== 2}
                                className={clsx(
                                    'px-3 py-1.5 bg-primary text-white rounded text-sm font-medium flex items-center gap-2 transition-opacity',
                                    selectedForCompare.length !== 2 && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <ArrowsRightLeftIcon className="h-4 w-4" />
                                Compare
                            </button>
                            <button
                                onClick={() => {
                                    setCompareMode(false);
                                    setSelectedForCompare([]);
                                }}
                                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            {versions.length >= 2 && (
                                <button
                                    onClick={() => setCompareMode(true)}
                                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                                >
                                    <ArrowsRightLeftIcon className="h-4 w-4" />
                                    Compare
                                </button>
                            )}
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-3 py-1.5 bg-primary text-white rounded text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Save Version
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex overflow-hidden bg-gray-50">
                {/* Left Sidebar - Version List */}
                <div className="w-80 border-r border-gray-200 overflow-y-auto bg-white">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Versions ({versions.length})
                            </span>
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewMode('timeline')}
                                    className={clsx(
                                        'p-1.5 rounded transition-all',
                                        viewMode === 'timeline' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'
                                    )}
                                >
                                    <Squares2X2Icon className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={clsx(
                                        'p-1.5 rounded transition-all',
                                        viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'
                                    )}
                                >
                                    <ListBulletIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {viewMode === 'timeline' ? (
                            <VersionTimeline
                                versions={versions}
                                selectedVersion={selectedVersion}
                                onSelect={(v) => { setSelectedVersion(v); setPreviewKey(k => k + 1); }}
                                onRestore={(v) => { setVersionToRestore(v); setShowRestoreModal(true); }}
                                onBranch={(v) => { setVersionToBranch(v); setShowBranchModal(true); }}
                                onDownload={handleDownload}
                                onDelete={(v) => handleDeleteVersion(v.id)}
                            />
                        ) : (
                            <div className="space-y-2">
                                {versions.map((version) => (
                                    <div
                                        key={version.id}
                                        onClick={() => { setSelectedVersion(version); setPreviewKey(k => k + 1); }}
                                        className={clsx(
                                            'p-3 rounded-lg cursor-pointer border transition-all',
                                            selectedVersion?.id === version.id
                                                ? 'bg-blue-50 border-blue-200'
                                                : 'bg-white border-gray-200 hover:border-blue-100'
                                        )}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {compareMode && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedForCompare.some(v => v.id === version.id)}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                if (e.target.checked) {
                                                                    if (selectedForCompare.length < 2) setSelectedForCompare([...selectedForCompare, version]);
                                                                } else {
                                                                    setSelectedForCompare(selectedForCompare.filter(v => v.id !== version.id));
                                                                }
                                                            }}
                                                            disabled={!selectedForCompare.some(v => v.id === version.id) && selectedForCompare.length >= 2}
                                                            className="h-4 w-4 rounded border-gray-300 text-primary"
                                                        />
                                                    )}
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded uppercase">
                                                        v{version.version_number}
                                                    </span>
                                                    <h3 className="text-sm font-semibold text-gray-900 truncate">{version.title}</h3>
                                                </div>
                                                <p className="text-[11px] text-gray-500 mb-2 line-clamp-2">{version.description || 'No description'}</p>
                                                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                                    <span className="flex items-center gap-1"><ClockIcon className="h-3 w-3" />{formatDate(version.created_at)}</span>
                                                    <span>{formatFileSize(version.file_size)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Preview */}
                <div className="flex-1 overflow-hidden bg-gray-100">
                    {selectedVersion ? (
                        <iframe
                            key={previewKey}
                            src={`${versionsApi.getPreviewUrl(selectedVersion.id)}?token=${localStorage.getItem('access_token')}`}
                            className="w-full h-full border-0"
                            title="Version Preview"
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <DocumentTextIcon className="h-12 w-12 text-gray-300 mb-3" />
                            <h3 className="text-sm font-medium text-gray-900">No version selected</h3>
                            <p className="text-xs text-gray-500 mt-1">Select a version to preview its content</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <CreateVersionModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSubmit={handleCreateVersion} isCreating={isCreating} />
            <RestoreVersionModal isOpen={showRestoreModal} onClose={() => { setShowRestoreModal(false); setVersionToRestore(null); }} onConfirm={handleRestoreVersion} version={versionToRestore} isRestoring={isRestoring} />
            <BranchVersionModal isOpen={showBranchModal} onClose={() => { setShowBranchModal(false); setVersionToBranch(null); }} onConfirm={handleBranchVersion} version={versionToBranch} isBranching={isBranching} />
            {selectedForCompare.length === 2 && (
                <VersionComparison
                    isOpen={showCompareModal}
                    onClose={() => { setShowCompareModal(false); setCompareMode(false); setSelectedForCompare([]); }}
                    versionA={selectedForCompare[0]}
                    versionB={selectedForCompare[1]}
                />
            )}
        </div>
    );
}
