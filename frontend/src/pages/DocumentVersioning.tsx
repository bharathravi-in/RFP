import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { versionsApi, projectsApi } from '@/api/client';
import { Project, ProposalVersion } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    ArrowLeftIcon,
    DocumentTextIcon,
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
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Version Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Draft v1, Final Review, Client Version"
                            className="input w-full"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Description (optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Notes about this version..."
                            className="input w-full h-24 resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                            disabled={isCreating}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex-1"
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Saving...
                                </span>
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
                            className="btn-secondary flex-1"
                            disabled={isRestoring}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="btn-primary flex-1 bg-amber-600 hover:bg-amber-700"
                            disabled={isRestoring}
                        >
                            {isRestoring ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Restoring...
                                </span>
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
                            className="btn-secondary flex-1"
                            disabled={isBranching}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="btn-primary flex-1"
                            disabled={isBranching}
                        >
                            {isBranching ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Creating Draft...
                                </span>
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

export default function DocumentVersioning() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
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
    // Compare mode state
    const [compareMode, setCompareMode] = useState(false);
    const [selectedForCompare, setSelectedForCompare] = useState<ProposalVersion[]>([]);
    const [showCompareModal, setShowCompareModal] = useState(false);
    // Branch mode state (Edit as Draft)
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [versionToBranch, setVersionToBranch] = useState<ProposalVersion | null>(null);
    const [isBranching, setIsBranching] = useState(false);
    // View mode: list or timeline
    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline');

    const loadData = useCallback(async () => {
        if (!id) return;

        try {
            const [projectRes, versionsRes] = await Promise.all([
                projectsApi.get(Number(id)),
                versionsApi.list(Number(id)),
            ]);
            setProject(projectRes.data.project);
            setVersions(versionsRes.data.versions || []);

            // Select first version by default
            if (versionsRes.data.versions?.length > 0 && !selectedVersion) {
                setSelectedVersion(versionsRes.data.versions[0]);
            }
        } catch {
            toast.error('Failed to load versions');
            navigate('/projects');
        } finally {
            setIsLoading(false);
        }
    }, [id, navigate, selectedVersion]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateVersion = async (title: string, description: string) => {
        if (!id) return;

        setIsCreating(true);
        try {
            const response = await versionsApi.create(Number(id), { title, description });
            toast.success('Version saved successfully!');
            setShowCreateModal(false);

            // Reload versions and select the new one
            const versionsRes = await versionsApi.list(Number(id));
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

            // Reload versions
            if (id) {
                const versionsRes = await versionsApi.list(Number(id));
                setVersions(versionsRes.data.versions || []);

                // Clear selection if deleted version was selected
                if (selectedVersion?.id === versionId) {
                    setSelectedVersion(versionsRes.data.versions?.[0] || null);
                    setPreviewKey((k) => k + 1);
                }
            }
        } catch {
            toast.error('Failed to delete version');
        }
    };

    const handleRestoreVersion = async () => {
        if (!versionToRestore || !id) return;

        setIsRestoring(true);
        try {
            const response = await versionsApi.restore(versionToRestore.id);
            toast.success(response.data.message || `Restored to version ${versionToRestore.version_number}`);
            setShowRestoreModal(false);
            setVersionToRestore(null);

            // Reload versions to show the new backup
            const versionsRes = await versionsApi.list(Number(id));
            setVersions(versionsRes.data.versions || []);

            // Navigate to proposal builder to see restored sections
            toast.success('Redirecting to Proposal Builder...');
            setTimeout(() => navigate(`/projects/${id}/proposal`), 1500);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to restore version');
        } finally {
            setIsRestoring(false);
        }
    };

    const handleBranchVersion = async () => {
        if (!versionToBranch || !id) return;

        setIsBranching(true);
        try {
            const response = await versionsApi.branch(versionToBranch.id, 'replace');
            toast.success(response.data.message || `Created editable draft from version ${versionToBranch.version_number}`);
            setShowBranchModal(false);
            setVersionToBranch(null);

            // Navigate to proposal builder to edit the draft
            toast.success('Redirecting to Proposal Builder...');
            setTimeout(() => navigate(`/projects/${id}/proposal`), 1000);
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
        <>
            <div className="h-[calc(100vh-80px)] flex flex-col animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(`/projects/${id}/proposal`)}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                        >
                            <ArrowLeftIcon className="h-5 w-5 text-text-secondary" />
                        </button>
                        <div>
                            <h1 className="text-xl font-semibold text-text-primary">
                                Document Versions
                            </h1>
                            <p className="text-sm text-text-secondary">{project?.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {compareMode ? (
                            <>
                                <span className="text-sm text-text-secondary">
                                    {selectedForCompare.length}/2 selected
                                </span>
                                <button
                                    onClick={() => {
                                        if (selectedForCompare.length === 2) {
                                            setShowCompareModal(true);
                                        }
                                    }}
                                    disabled={selectedForCompare.length !== 2}
                                    className={clsx(
                                        'btn-primary flex items-center gap-2',
                                        selectedForCompare.length !== 2 && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <ArrowsRightLeftIcon className="h-5 w-5" />
                                    Compare
                                </button>
                                <button
                                    onClick={() => {
                                        setCompareMode(false);
                                        setSelectedForCompare([]);
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                {versions.length >= 2 && (
                                    <button
                                        onClick={() => setCompareMode(true)}
                                        className="btn-secondary flex items-center gap-2"
                                    >
                                        <ArrowsRightLeftIcon className="h-5 w-5" />
                                        Compare
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                    Save New Version
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Split View */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar - Version List */}
                    <div className="w-80 border-r border-border bg-gray-50 overflow-y-auto">
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <DocumentDuplicateIcon className="h-5 w-5 text-text-secondary" />
                                    <h2 className="font-medium text-text-primary">
                                        Saved Versions ({versions.length})
                                    </h2>
                                </div>
                                {/* View Toggle */}
                                <div className="flex items-center gap-1 bg-white rounded-lg border border-border p-0.5">
                                    <button
                                        onClick={() => setViewMode('timeline')}
                                        className={clsx(
                                            'p-1.5 rounded transition-colors',
                                            viewMode === 'timeline'
                                                ? 'bg-primary text-white'
                                                : 'text-text-muted hover:bg-gray-100'
                                        )}
                                        title="Timeline View"
                                    >
                                        <Squares2X2Icon className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={clsx(
                                            'p-1.5 rounded transition-colors',
                                            viewMode === 'list'
                                                ? 'bg-primary text-white'
                                                : 'text-text-muted hover:bg-gray-100'
                                        )}
                                        title="List View"
                                    >
                                        <ListBulletIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {viewMode === 'timeline' ? (
                                <VersionTimeline
                                    versions={versions}
                                    selectedVersion={selectedVersion}
                                    onSelect={(version) => {
                                        setSelectedVersion(version);
                                        setPreviewKey((k) => k + 1);
                                    }}
                                    onRestore={(version) => {
                                        setVersionToRestore(version);
                                        setShowRestoreModal(true);
                                    }}
                                    onBranch={(version) => {
                                        setVersionToBranch(version);
                                        setShowBranchModal(true);
                                    }}
                                    onDownload={handleDownload}
                                    onDelete={(version) => handleDeleteVersion(version.id)}
                                />
                            ) : versions.length === 0 ? (
                                <div className="text-center py-12">
                                    <DocumentTextIcon className="h-12 w-12 text-text-muted mx-auto mb-3" />
                                    <p className="text-text-secondary text-sm">
                                        No versions saved yet
                                    </p>
                                    <p className="text-text-muted text-xs mt-1">
                                        Click "Save New Version" to create a snapshot
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {versions.map((version) => (
                                        <div
                                            key={version.id}
                                            onClick={() => {
                                                setSelectedVersion(version);
                                                setPreviewKey((k) => k + 1);
                                            }}
                                            className={clsx(
                                                'p-3 rounded-lg cursor-pointer transition-all border',
                                                selectedVersion?.id === version.id
                                                    ? 'bg-primary-light border-primary shadow-sm'
                                                    : 'bg-white border-border hover:border-primary/50 hover:shadow-sm'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {compareMode && (
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedForCompare.some(v => v.id === version.id)}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    if (e.target.checked) {
                                                                        if (selectedForCompare.length < 2) {
                                                                            setSelectedForCompare([...selectedForCompare, version]);
                                                                        }
                                                                    } else {
                                                                        setSelectedForCompare(selectedForCompare.filter(v => v.id !== version.id));
                                                                    }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                disabled={!selectedForCompare.some(v => v.id === version.id) && selectedForCompare.length >= 2}
                                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                            />
                                                        )}
                                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-white">
                                                            v{version.version_number}
                                                        </span>
                                                        <h3 className="font-medium text-text-primary truncate text-sm">
                                                            {version.title}
                                                        </h3>
                                                    </div>
                                                    {version.description && (
                                                        <p className="text-xs text-text-muted mt-1 line-clamp-2">
                                                            {version.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                                                        <span className="flex items-center gap-1">
                                                            <ClockIcon className="h-3 w-3" />
                                                            {formatDate(version.created_at)}
                                                        </span>
                                                        <span>
                                                            {formatFileSize(version.file_size)}
                                                        </span>
                                                    </div>
                                                    {version.creator_name && (
                                                        <p className="text-xs text-text-muted mt-1">
                                                            by {version.creator_name}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {version.can_restore && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setVersionToRestore(version);
                                                                setShowRestoreModal(true);
                                                            }}
                                                            className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                                                            title="Restore this version"
                                                        >
                                                            <ArrowPathIcon className="h-4 w-4 text-amber-600" />
                                                        </button>
                                                    )}
                                                    {version.can_restore && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setVersionToBranch(version);
                                                                setShowBranchModal(true);
                                                            }}
                                                            className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                                                            title="Edit as Draft"
                                                        >
                                                            <PencilSquareIcon className="h-4 w-4 text-primary" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownload(version);
                                                        }}
                                                        className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                                                        title="Download"
                                                    >
                                                        <ArrowDownTrayIcon className="h-4 w-4 text-text-secondary" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteVersion(version.id);
                                                        }}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="h-4 w-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Document Preview */}
                    <div className="flex-1 overflow-hidden bg-gray-100">
                        {selectedVersion ? (
                            <iframe
                                key={previewKey}
                                src={`${versionsApi.getPreviewUrl(selectedVersion.id)}?token=${localStorage.getItem('access_token')}`}
                                className="w-full h-full border-0"
                                title="Document Preview"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                <DocumentTextIcon className="h-16 w-16 text-text-muted mb-4" />
                                <h3 className="text-lg font-medium text-text-secondary">
                                    No Version Selected
                                </h3>
                                <p className="text-text-muted mt-2 max-w-sm">
                                    {versions.length > 0
                                        ? 'Select a version from the list to preview'
                                        : 'Save a version to preview your proposal document'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Version Modal */}
            <CreateVersionModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateVersion}
                isCreating={isCreating}
            />

            {/* Restore Version Modal */}
            <RestoreVersionModal
                isOpen={showRestoreModal}
                onClose={() => {
                    setShowRestoreModal(false);
                    setVersionToRestore(null);
                }}
                onConfirm={handleRestoreVersion}
                version={versionToRestore}
                isRestoring={isRestoring}
            />

            {/* Branch Version Modal (Edit as Draft) */}
            <BranchVersionModal
                isOpen={showBranchModal}
                onClose={() => {
                    setShowBranchModal(false);
                    setVersionToBranch(null);
                }}
                onConfirm={handleBranchVersion}
                version={versionToBranch}
                isBranching={isBranching}
            />

            {/* Version Comparison Modal */}
            {selectedForCompare.length === 2 && (
                <VersionComparison
                    isOpen={showCompareModal}
                    onClose={() => {
                        setShowCompareModal(false);
                        setCompareMode(false);
                        setSelectedForCompare([]);
                    }}
                    versionA={selectedForCompare[0]}
                    versionB={selectedForCompare[1]}
                />
            )}
        </>
    );
}
