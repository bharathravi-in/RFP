import { useState } from 'react';
import {
    EyeIcon,
    ArrowDownTrayIcon,
    EllipsisVerticalIcon,
    TrashIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { documentsApi } from '@/api/client';
import { DocumentPreviewModal } from '@/components/ui/DocumentPreview';
import toast from 'react-hot-toast';

interface DocumentActionsProps {
    documentId: number;
    fileName: string;
    fileType: string;
    onDelete?: () => void;
    onReparse?: () => void;
    showDelete?: boolean;
    showReparse?: boolean;
    compact?: boolean;
}

/**
 * Reusable Document Actions Component
 * Provides preview, download, and more options for documents
 */
export default function DocumentActions({
    documentId,
    fileName,
    fileType,
    onDelete,
    onReparse,
    showDelete = true,
    showReparse = false,
    compact = false,
}: DocumentActionsProps) {
    const [showPreview, setShowPreview] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isReparsing, setIsReparsing] = useState(false);

    const handleDownload = () => {
        const token = localStorage.getItem('access_token');
        const downloadUrl = `${documentsApi.getDownloadUrl(documentId)}`;

        // Open in new tab with auth - the backend will handle authentication
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowMenu(false);
    };

    const handleDelete = async () => {
        if (!onDelete) return;

        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
            return;
        }

        setIsDeleting(true);
        try {
            await documentsApi.delete(documentId);
            toast.success('Document deleted');
            onDelete();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete document');
        } finally {
            setIsDeleting(false);
            setShowMenu(false);
        }
    };

    const handleReparse = async () => {
        if (!onReparse) return;

        setIsReparsing(true);
        try {
            await documentsApi.parse(documentId);
            toast.success('Document re-parsed successfully');
            onReparse();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to re-parse document');
        } finally {
            setIsReparsing(false);
            setShowMenu(false);
        }
    };

    // Get file type color
    const getFileTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            pdf: 'text-red-500 bg-red-50',
            docx: 'text-blue-500 bg-blue-50',
            doc: 'text-blue-500 bg-blue-50',
            xlsx: 'text-green-500 bg-green-50',
            xls: 'text-green-500 bg-green-50',
            pptx: 'text-orange-500 bg-orange-50',
            ppt: 'text-orange-500 bg-orange-50',
        };
        return colors[type.toLowerCase()] || 'text-gray-500 bg-gray-50';
    };

    if (compact) {
        return (
            <>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowPreview(true)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-primary transition-colors"
                        title="Preview"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleDownload}
                        className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-primary transition-colors"
                        title="Download"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                    {(showDelete || showReparse) && (
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
                                title="More options"
                            >
                                <EllipsisVerticalIcon className="h-4 w-4" />
                            </button>
                            {showMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowMenu(false)}
                                    />
                                    <div className="absolute right-0 mt-1 w-40 bg-surface rounded-lg shadow-lg border border-border z-20 py-1">
                                        {showReparse && (
                                            <button
                                                onClick={handleReparse}
                                                disabled={isReparsing}
                                                className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-gray-50 text-text-primary"
                                            >
                                                <ArrowPathIcon className={clsx("h-4 w-4", isReparsing && "animate-spin")} />
                                                {isReparsing ? 'Re-parsing...' : 'Re-parse'}
                                            </button>
                                        )}
                                        {showDelete && (
                                            <button
                                                onClick={handleDelete}
                                                disabled={isDeleting}
                                                className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-red-50 text-red-600"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                {isDeleting ? 'Deleting...' : 'Delete'}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <DocumentPreviewModal
                    isOpen={showPreview}
                    onClose={() => setShowPreview(false)}
                    documentId={documentId}
                    fileName={fileName}
                    fileType={fileType}
                />
            </>
        );
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowPreview(true)}
                    className="btn-secondary btn-sm"
                >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    Preview
                </button>
                <button
                    onClick={handleDownload}
                    className="btn-secondary btn-sm"
                >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                    Download
                </button>
                {(showDelete || showReparse) && (
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="btn-secondary btn-sm px-2"
                            title="More options"
                        >
                            <EllipsisVerticalIcon className="h-4 w-4" />
                        </button>
                        {showMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowMenu(false)}
                                />
                                <div className="absolute right-0 mt-1 w-44 bg-surface rounded-lg shadow-lg border border-border z-20 py-1">
                                    {showReparse && (
                                        <button
                                            onClick={handleReparse}
                                            disabled={isReparsing}
                                            className="w-full px-4 py-2.5 text-sm text-left flex items-center gap-2 hover:bg-gray-50 text-text-primary"
                                        >
                                            <ArrowPathIcon className={clsx("h-4 w-4", isReparsing && "animate-spin")} />
                                            {isReparsing ? 'Re-parsing...' : 'Re-parse Document'}
                                        </button>
                                    )}
                                    {showDelete && (
                                        <button
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="w-full px-4 py-2.5 text-sm text-left flex items-center gap-2 hover:bg-red-50 text-red-600"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                            {isDeleting ? 'Deleting...' : 'Delete Document'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <DocumentPreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                documentId={documentId}
                fileName={fileName}
                fileType={fileType}
            />
        </>
    );
}
