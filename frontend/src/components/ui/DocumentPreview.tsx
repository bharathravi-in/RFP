import { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import {
    DocumentTextIcon,
    TableCellsIcon,
    PresentationChartBarIcon,
    ArrowDownTrayIcon,
    XMarkIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

// Viewer types in priority order
type ViewerType = 'microsoft' | 'google' | 'pdf' | 'backend' | 'none';

// File type categories
type FileCategory = 'word' | 'excel' | 'powerpoint' | 'pdf' | 'unknown';

interface FileCategoryConfig {
    category: FileCategory;
    brandColor: string;
    icon: React.ElementType;
    label: string;
}

const FILE_CONFIGS: Record<FileCategory, FileCategoryConfig> = {
    word: {
        category: 'word',
        brandColor: '#185ABD',
        icon: DocumentTextIcon,
        label: 'Word',
    },
    excel: {
        category: 'excel',
        brandColor: '#217346',
        icon: TableCellsIcon,
        label: 'Excel',
    },
    powerpoint: {
        category: 'powerpoint',
        brandColor: '#B7472A',
        icon: PresentationChartBarIcon,
        label: 'PowerPoint',
    },
    pdf: {
        category: 'pdf',
        brandColor: '#DC2626',
        icon: DocumentTextIcon,
        label: 'PDF',
    },
    unknown: {
        category: 'unknown',
        brandColor: '#6B7280',
        icon: DocumentTextIcon,
        label: 'Document',
    },
};

// Microsoft Office supported extensions
const OFFICE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

/**
 * Detect file category from filename or MIME type
 */
function detectFileCategory(fileName: string, mimeType?: string): FileCategory {
    const name = fileName?.toLowerCase() || '';
    const mime = mimeType?.toLowerCase() || '';

    if (name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('word')) {
        return 'word';
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('spreadsheet') || mime.includes('excel')) {
        return 'excel';
    }
    if (name.endsWith('.pptx') || name.endsWith('.ppt') || mime.includes('presentation') || mime.includes('powerpoint')) {
        return 'powerpoint';
    }
    if (name.endsWith('.pdf') || mime.includes('pdf')) {
        return 'pdf';
    }
    return 'unknown';
}

/**
 * Get file extension from filename
 */
function getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * Check if file is supported by Microsoft Office Online Viewer
 */
function isMicrosoftSupported(fileName: string): boolean {
    const ext = getFileExtension(fileName);
    return OFFICE_EXTENSIONS.includes(ext);
}

/**
 * Generate Microsoft Office Online Viewer URL
 * Note: Requires publicly accessible file URL
 */
function getMicrosoftViewerUrl(fileUrl: string): string {
    const encodedUrl = encodeURIComponent(fileUrl);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
}

/**
 * Generate Google Docs Viewer URL
 * Note: Requires publicly accessible file URL
 */
function getGoogleViewerUrl(fileUrl: string): string {
    const encodedUrl = encodeURIComponent(fileUrl);
    return `https://docs.google.com/gview?url=${encodedUrl}&embedded=true`;
}

interface DocumentPreviewProps {
    /** Public URL of the file for Microsoft/Google viewers */
    fileUrl?: string;
    /** Backend preview URL (e.g., /api/preview/123/view) */
    backendPreviewUrl?: string;
    /** File name for display and type detection */
    fileName?: string;
    /** MIME type of the file */
    fileType?: string;
    /** Callback when close button is clicked */
    onClose?: () => void;
    /** Callback when download button is clicked */
    onDownload?: () => void;
    /** Show controls (toolbar) */
    showControls?: boolean;
    /** CSS class name */
    className?: string;
    /** Minimum height */
    minHeight?: string;
    /** Force specific viewer */
    forceViewer?: ViewerType;
}

/**
 * Unified Document Preview Component
 * 
 * Priority Order:
 * 1. Microsoft Office Online Viewer (for Office files with public URL)
 * 2. Google Docs Viewer (fallback for Office files)
 * 3. PDF Native Viewer (for PDFs)
 * 4. Backend HTML conversion (for local/private files)
 * 
 * @example With public URL (Microsoft/Google viewer)
 * ```tsx
 * <DocumentPreview
 *   fileUrl="https://example.com/document.docx"
 *   fileName="document.docx"
 *   onClose={() => setShowPreview(false)}
 * />
 * ```
 * 
 * @example With backend preview (local files)
 * ```tsx
 * <DocumentPreview
 *   backendPreviewUrl="/api/preview/123/view?token=xxx"
 *   fileName="document.docx"
 *   onClose={() => setShowPreview(false)}
 * />
 * ```
 */
export default function DocumentPreview({
    fileUrl,
    backendPreviewUrl,
    fileName = 'Document',
    fileType,
    onClose,
    onDownload,
    showControls = true,
    className = '',
    minHeight = '600px',
    forceViewer,
}: DocumentPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentViewer, setCurrentViewer] = useState<ViewerType>('none');
    const [viewerUrl, setViewerUrl] = useState<string>('');
    const [retryCount, setRetryCount] = useState(0);

    const fileCategory = detectFileCategory(fileName, fileType);
    const config = FILE_CONFIGS[fileCategory];
    const IconComponent = config.icon;

    // Determine which viewer to use and build URL
    useEffect(() => {
        setIsLoading(true);
        setError(null);

        let viewer: ViewerType = 'none';
        let url = '';

        if (forceViewer) {
            viewer = forceViewer;
        } else if (fileCategory === 'pdf') {
            // PDF: Use native viewer or backend
            viewer = 'pdf';
            url = fileUrl || backendPreviewUrl || '';
        } else if (fileUrl && isMicrosoftSupported(fileName)) {
            // Office file with public URL: Try Microsoft viewer first
            if (retryCount === 0) {
                viewer = 'microsoft';
                url = getMicrosoftViewerUrl(fileUrl);
            } else if (retryCount === 1) {
                // Fallback to Google viewer
                viewer = 'google';
                url = getGoogleViewerUrl(fileUrl);
            } else {
                // Final fallback to backend
                viewer = 'backend';
                url = backendPreviewUrl || '';
            }
        } else if (backendPreviewUrl) {
            // No public URL: Use backend conversion
            viewer = 'backend';
            url = backendPreviewUrl;
        }

        setCurrentViewer(viewer);
        setViewerUrl(url);

        if (!url && viewer !== 'none') {
            setError('No preview URL available');
            setIsLoading(false);
        }
    }, [fileUrl, backendPreviewUrl, fileName, fileCategory, forceViewer, retryCount]);

    const handleIframeLoad = useCallback(() => {
        setIsLoading(false);
    }, []);

    const handleIframeError = useCallback(() => {
        setIsLoading(false);

        // Try fallback viewers
        if (currentViewer === 'microsoft' && fileUrl) {
            setRetryCount(1); // Switch to Google viewer
        } else if (currentViewer === 'google' && backendPreviewUrl) {
            setRetryCount(2); // Switch to backend
        } else {
            setError('Failed to load document preview');
        }
    }, [currentViewer, fileUrl, backendPreviewUrl]);

    const handleRetry = useCallback(() => {
        setRetryCount(0);
        setError(null);
        setIsLoading(true);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Get viewer label for display
    const getViewerLabel = () => {
        switch (currentViewer) {
            case 'microsoft': return 'Microsoft Office Online';
            case 'google': return 'Google Docs Viewer';
            case 'pdf': return 'PDF Viewer';
            case 'backend': return 'Document Preview';
            default: return '';
        }
    };

    return (
        <div
            ref={containerRef}
            className={clsx(
                'bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-xl',
                isFullscreen && 'fixed inset-0 z-50 rounded-none',
                className
            )}
        >
            {/* Microsoft Office-style Toolbar */}
            {showControls && (
                <div className="flex flex-col border-b border-gray-200">
                    {/* Top bar with brand color */}
                    <div
                        className="flex items-center justify-between px-4 py-2.5"
                        style={{ backgroundColor: config.brandColor }}
                    >
                        <div className="flex items-center gap-3">
                            <IconComponent className="h-5 w-5 text-white" />
                            <span className="text-white font-medium truncate max-w-[250px]">
                                {fileName}
                            </span>
                            <span className="text-white/70 text-xs px-2 py-0.5 bg-white/15 rounded">
                                {config.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {onDownload && (
                                <button
                                    onClick={onDownload}
                                    className="p-2 rounded hover:bg-white/20 text-white transition-colors"
                                    title="Download"
                                >
                                    <ArrowDownTrayIcon className="h-5 w-5" />
                                </button>
                            )}
                            <button
                                onClick={toggleFullscreen}
                                className="p-2 rounded hover:bg-white/20 text-white transition-colors"
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
                                    className="p-2 rounded hover:bg-white/20 text-white transition-colors"
                                    title="Close"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Secondary bar with viewer info */}
                    <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 text-xs text-gray-500">
                        <span>Powered by {getViewerLabel()}</span>
                        {currentViewer !== 'backend' && backendPreviewUrl && (
                            <button
                                onClick={() => setRetryCount(2)}
                                className="text-blue-600 hover:underline"
                            >
                                Switch to local preview
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Document Content */}
            <div
                className="relative flex-1 overflow-hidden bg-[#525659]"
                style={{ minHeight }}
            >
                {/* Loading State */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#525659] z-10">
                        <div className="flex flex-col items-center gap-3">
                            <div
                                className="h-10 w-10 border-4 rounded-full animate-spin"
                                style={{
                                    borderColor: `${config.brandColor}40`,
                                    borderTopColor: config.brandColor
                                }}
                            />
                            <span className="text-sm text-white">
                                Loading {config.label} document...
                            </span>
                            <span className="text-xs text-white/60">
                                Using {getViewerLabel()}
                            </span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#525659] z-10">
                        <div className="flex flex-col items-center gap-4 text-center p-6 bg-white rounded-lg shadow-lg max-w-sm">
                            <ExclamationTriangleIcon className="h-12 w-12 text-amber-500" />
                            <div>
                                <p className="text-sm font-medium text-gray-900">{error}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {currentViewer === 'microsoft' || currentViewer === 'google'
                                        ? 'File must be publicly accessible for external viewers.'
                                        : 'The document format may not be supported.'
                                    }
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleRetry}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    <ArrowPathIcon className="h-4 w-4" />
                                    Retry
                                </button>
                                {onDownload && (
                                    <button
                                        onClick={onDownload}
                                        className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                                        style={{ backgroundColor: config.brandColor }}
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                        Download
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Document Preview iframe */}
                {viewerUrl && (
                    <iframe
                        key={viewerUrl}
                        src={viewerUrl}
                        className={clsx(
                            'w-full h-full border-0 bg-white',
                            (isLoading || error) && 'invisible'
                        )}
                        style={{ minHeight }}
                        onLoad={handleIframeLoad}
                        onError={handleIframeError}
                        title={`Preview: ${fileName}`}
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    />
                )}

                {/* No URL available */}
                {!viewerUrl && !isLoading && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#525659]">
                        <div className="text-center p-6 bg-white rounded-lg shadow-lg">
                            <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-900">Preview not available</p>
                            <p className="text-xs text-gray-500 mt-1">
                                No preview URL provided for this document.
                            </p>
                            {onDownload && (
                                <button
                                    onClick={onDownload}
                                    className="mt-4 flex items-center gap-1.5 px-4 py-2 mx-auto text-white rounded-lg hover:opacity-90 transition-colors"
                                    style={{ backgroundColor: config.brandColor }}
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    Download
                                </button>
                            )}
                        </div>
                    </div>
                )}
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
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-6xl max-h-[90vh] flex flex-col">
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

// Utility exports
export {
    detectFileCategory,
    isMicrosoftSupported,
    getMicrosoftViewerUrl,
    getGoogleViewerUrl,
    OFFICE_EXTENSIONS
};
export type { ViewerType, FileCategory };
