import { useState, useEffect, useCallback } from 'react';
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
} from '@heroicons/react/24/outline';
import api from '@/api/client';
import ExcelViewer, { ExcelViewerModal } from '@/components/ui/ExcelViewer';

interface KnowledgePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: number;
    itemTitle?: string;
    fileType?: string;
    onDownload?: () => void;
    onDelete?: () => void;
}

// Office file types and their brand colors
type FileCategory = 'word' | 'excel' | 'powerpoint' | 'pdf' | 'unknown';

const FILE_CONFIGS: Record<FileCategory, { color: string; icon: typeof DocumentTextIcon; label: string }> = {
    word: { color: '#185ABD', icon: DocumentTextIcon, label: 'Word' },
    excel: { color: '#217346', icon: TableCellsIcon, label: 'Excel' },
    powerpoint: { color: '#B7472A', icon: PresentationChartBarIcon, label: 'PowerPoint' },
    pdf: { color: '#DC2626', icon: DocumentTextIcon, label: 'PDF' },
    unknown: { color: '#6B7280', icon: DocumentTextIcon, label: 'Document' },
};

// Detect file category from filename or MIME type
function detectFileCategory(fileName: string, mimeType?: string): FileCategory {
    const name = fileName?.toLowerCase() || '';
    const mime = mimeType?.toLowerCase() || '';

    if (name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('word')) return 'word';
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('spreadsheet') || mime.includes('excel')) return 'excel';
    if (name.endsWith('.pptx') || name.endsWith('.ppt') || mime.includes('presentation') || mime.includes('powerpoint')) return 'powerpoint';
    if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
    return 'unknown';
}

/**
 * Modal for previewing Knowledge Base documents
 * 
 * Uses:
 * - ExcelViewer for Excel files (with sheet tabs via xlsx library)
 * - Backend HTML conversion for Word, PowerPoint, PDF
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
    const [viewerUrl, setViewerUrl] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [excelData, setExcelData] = useState<Blob | null>(null);

    const fileCategory = detectFileCategory(itemTitle, fileType);
    const config = FILE_CONFIGS[fileCategory];
    const IconComponent = config.icon;
    const isExcel = fileCategory === 'excel';

    // Fetch Excel file as blob or set iframe URL
    useEffect(() => {
        if (!isOpen || !itemId) return;

        setIsLoading(true);
        setError(null);
        setViewerUrl('');
        setExcelData(null);

        const token = localStorage.getItem('access_token');

        if (isExcel) {
            // Fetch Excel file as blob for ExcelViewer
            api.get(`/preview/${itemId}/download`, {
                responseType: 'blob',
            })
                .then((response) => {
                    setExcelData(response.data);
                    setIsLoading(false);
                })
                .catch((err) => {
                    console.error('Failed to fetch Excel file:', err);
                    setError('Failed to load Excel file');
                    setIsLoading(false);
                });
        } else {
            // Use backend HTML conversion for other files
            setViewerUrl(`/api/preview/${itemId}/view?token=${token}`);
        }
    }, [isOpen, itemId, isExcel]);

    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            setViewerUrl('');
            setExcelData(null);
            setError(null);
            setIsLoading(true);
        }
    }, [isOpen]);

    const handleDownload = useCallback(async () => {
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
    }, [itemId, itemTitle, onDownload]);

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            onDelete?.();
            onClose();
        }
    };

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
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

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    const handleIframeError = () => {
        setIsLoading(false);
        setError('Failed to load document preview');
    };

    if (!isOpen) return null;

    // Use ExcelViewer for Excel files
    if (isExcel) {
        if (isLoading || !excelData) {
            return (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-4">
                        <div className="h-10 w-10 border-4 border-[#217346]/30 border-t-[#217346] rounded-full animate-spin" />
                        <span className="text-gray-600">Loading Excel spreadsheet...</span>
                    </div>
                </div>
            );
        }

        return (
            <ExcelViewerModal
                isOpen={isOpen}
                onClose={onClose}
                fileData={excelData}
                fileName={itemTitle}
                onDownload={handleDownload}
            />
        );
    }

    // Default preview for Word, PowerPoint, PDF, etc.
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className={clsx(
                    'bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-2xl w-full max-w-6xl',
                    isFullscreen ? 'fixed inset-0 z-50 rounded-none max-w-none max-h-none' : 'max-h-[90vh]'
                )}
            >
                {/* Header with brand color */}
                <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ backgroundColor: config.color }}
                >
                    <div className="flex items-center gap-3">
                        <IconComponent className="h-5 w-5 text-white" />
                        <span className="text-white font-medium truncate max-w-[300px]">
                            {itemTitle}
                        </span>
                        <span className="text-white/70 text-xs px-2 py-0.5 bg-white/15 rounded">
                            {config.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleDownload}
                            className="p-2 rounded hover:bg-white/20 text-white transition-colors"
                            title="Download"
                        >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
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
                        <button
                            onClick={onClose}
                            className="p-2 rounded hover:bg-white/20 text-white transition-colors"
                            title="Close"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Viewer info bar */}
                <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                    <span>Document Preview</span>
                </div>

                {/* Content area */}
                <div className="relative flex-1 overflow-hidden bg-[#525659]" style={{ minHeight: '600px' }}>
                    {/* Loading State */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#525659] z-10">
                            <div className="flex flex-col items-center gap-3">
                                <div
                                    className="h-10 w-10 border-4 rounded-full animate-spin"
                                    style={{
                                        borderColor: `${config.color}40`,
                                        borderTopColor: config.color
                                    }}
                                />
                                <span className="text-sm text-white">
                                    Loading {config.label} document...
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
                                        Try downloading the file instead.
                                    </p>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                                    style={{ backgroundColor: config.color }}
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    Download
                                </button>
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
                            style={{ minHeight: '600px' }}
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
                            title={`Preview: ${itemTitle}`}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
