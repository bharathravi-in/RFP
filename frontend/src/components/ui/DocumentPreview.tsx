import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import {
    DocumentTextIcon,
    ArrowDownTrayIcon,
    XMarkIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { documentsApi } from '@/api/client';

interface DocumentPreviewProps {
    documentId: number;
    fileName?: string;
    fileType?: string;
    className?: string;
    onClose?: () => void;
    showControls?: boolean;
    minHeight?: string;
}

/**
 * Reusable Document Preview Component
 * Supports PDF (native), DOCX, XLSX, PPTX (via backend conversion)
 */
export default function DocumentPreview({
    documentId,
    fileName = 'Document',
    fileType = 'pdf',
    className = '',
    onClose,
    showControls = true,
    minHeight = '600px',
}: DocumentPreviewProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const previewUrl = documentsApi.getPreviewUrl(documentId);
    const downloadUrl = documentsApi.getDownloadUrl(documentId);

    // Get auth token for iframe src
    const token = localStorage.getItem('access_token');
    const authenticatedUrl = `${previewUrl}?token=${token}`;

    const handleLoad = () => {
        setIsLoading(false);
    };

    const handleError = () => {
        setIsLoading(false);
        setError('Failed to load document preview');
    };

    const handleDownload = () => {
        // Create a temporary link to trigger download with auth
        const link = document.createElement('a');
        link.href = `${downloadUrl}?token=${token}`;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
        return colors[type.toLowerCase()] || 'text-gray-500';
    };

    return (
        <div
            ref={containerRef}
            className={clsx(
                'bg-surface rounded-xl border border-border overflow-hidden flex flex-col',
                isFullscreen && 'fixed inset-0 z-50 rounded-none',
                className
            )}
        >
            {/* Header */}
            {showControls && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated">
                    <div className="flex items-center gap-3">
                        <DocumentTextIcon className={clsx('h-5 w-5', getFileTypeColor(fileType))} />
                        <div>
                            <h3 className="text-sm font-medium text-text-primary truncate max-w-[200px]">
                                {fileName}
                            </h3>
                            <span className="text-xs text-text-muted uppercase">{fileType}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-primary transition-colors"
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
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-error transition-colors"
                                title="Close"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="relative flex-1" style={{ minHeight }}>
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
                {error && (
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

                {/* Preview iframe */}
                <iframe
                    src={authenticatedUrl}
                    className={clsx(
                        'w-full h-full border-0',
                        (isLoading || error) && 'invisible'
                    )}
                    style={{ minHeight }}
                    onLoad={handleLoad}
                    onError={handleError}
                    title={`Preview: ${fileName}`}
                />
            </div>
        </div>
    );
}

// Modal wrapper for document preview
interface DocumentPreviewModalProps extends Omit<DocumentPreviewProps, 'onClose'> {
    isOpen: boolean;
    onClose: () => void;
}

export function DocumentPreviewModal({
    isOpen,
    onClose,
    ...props
}: DocumentPreviewModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
            <div className="w-full max-w-5xl max-h-[90vh] flex flex-col">
                <DocumentPreview
                    {...props}
                    onClose={onClose}
                    className="flex-1"
                    minHeight="calc(90vh - 60px)"
                />
            </div>
        </div>
    );
}
