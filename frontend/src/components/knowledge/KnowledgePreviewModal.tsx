import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import {
    DocumentTextIcon,
    ArrowDownTrayIcon,
    XMarkIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    ExclamationTriangleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import api from '@/api/client';

interface KnowledgePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: number;
    itemTitle?: string;
    fileType?: string;
    onDownload?: () => void;
    onDelete?: () => void;
}

/**
 * Modal for previewing Knowledge Base documents
 * Uses /preview/{item_id}/view endpoint for HTML preview
 */
export default function KnowledgePreviewModal({
    isOpen,
    onClose,
    itemId,
    itemTitle = 'Document',
    fileType = '',
    onDownload,
    onDelete,
}: KnowledgePreviewModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Build preview URL with auth token
    useEffect(() => {
        if (!isOpen || !itemId) return;

        setIsLoading(true);
        setError(null);

        // Get auth token
        const token = localStorage.getItem('access_token');

        // Build the preview URL with token as query param
        const url = `/api/preview/${itemId}/view?token=${token}`;
        setPreviewUrl(url);
    }, [isOpen, itemId]);

    // Handle iframe load
    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    const handleIframeError = () => {
        setIsLoading(false);
        setError('Failed to load document preview');
    };

    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            setPreviewUrl(null);
            setError(null);
            setIsLoading(true);
        }
    }, [isOpen]);

    const handleDownload = async () => {
        try {
            const response = await api.get(`/preview/${itemId}/download`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', itemTitle);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            onDownload?.();
        } catch (err) {
            console.error('Failed to download:', err);
        }
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            onDelete?.();
            onClose();
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Get file type icon color
    const getFileTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            pdf: 'text-red-500',
            docx: 'text-blue-500',
            doc: 'text-blue-500',
            xlsx: 'text-green-500',
            xls: 'text-green-500',
            pptx: 'text-orange-500',
            ppt: 'text-orange-500',
        };
        const ext = type.split('/').pop()?.toLowerCase() || type.toLowerCase();
        return colors[ext] || 'text-gray-500';
    };

    const getFileTypeLabel = (type: string) => {
        if (!type) return '';
        if (type.includes('pdf')) return 'PDF';
        if (type.includes('word') || type.includes('docx')) return 'DOCX';
        if (type.includes('presentation') || type.includes('ppt')) return 'PPT';
        if (type.includes('spreadsheet') || type.includes('xls')) return 'XLS';
        if (type.includes('text')) return 'TXT';
        return type.split('/').pop()?.toUpperCase() || '';
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                ref={containerRef}
                className={clsx(
                    'bg-surface rounded-xl border border-border overflow-hidden flex flex-col w-full max-w-5xl',
                    isFullscreen ? 'fixed inset-0 z-50 rounded-none max-w-none' : 'max-h-[90vh]'
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated">
                    <div className="flex items-center gap-3">
                        <DocumentTextIcon className={clsx('h-5 w-5', getFileTypeColor(fileType))} />
                        <div>
                            <h3 className="text-sm font-medium text-text-primary truncate max-w-[300px]">
                                {itemTitle}
                            </h3>
                            {fileType && (
                                <span className="text-xs text-text-muted uppercase">
                                    {getFileTypeLabel(fileType)}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-success transition-colors"
                            title="Download"
                        >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-primary transition-colors"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? (
                                <ArrowsPointingInIcon className="h-5 w-5" />
                            ) : (
                                <ArrowsPointingOutIcon className="h-5 w-5" />
                            )}
                        </button>
                        {onDelete && (
                            <button
                                onClick={handleDelete}
                                className="p-2 rounded-lg hover:bg-red-50 text-text-secondary hover:text-error transition-colors"
                                title="Delete"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-text-primary transition-colors"
                            title="Close"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="relative flex-1 overflow-hidden" style={{ minHeight: '500px' }}>
                    {/* Loading State */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                            <div className="flex flex-col items-center gap-3">
                                <div className="h-8 w-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                                <span className="text-sm text-text-secondary">Loading preview...</span>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                            <div className="flex flex-col items-center gap-3 text-center p-6">
                                <ExclamationTriangleIcon className="h-12 w-12 text-amber-500" />
                                <div>
                                    <p className="text-sm font-medium text-text-primary">{error}</p>
                                    <p className="text-xs text-text-muted mt-1">
                                        Try downloading the file instead.
                                    </p>
                                </div>
                                <button onClick={handleDownload} className="btn-secondary btn-sm mt-2">
                                    <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                                    Download
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Document Preview in iframe */}
                    {previewUrl && (
                        <iframe
                            src={previewUrl}
                            className={clsx(
                                'w-full h-full border-0',
                                isLoading && 'invisible'
                            )}
                            style={{ minHeight: '500px' }}
                            title={`Preview: ${itemTitle}`}
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
