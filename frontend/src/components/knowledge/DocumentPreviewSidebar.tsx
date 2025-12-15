import { useState, useEffect } from 'react';
import {
    XMarkIcon,
    ArrowDownTrayIcon,
    ClipboardDocumentIcon,
    CheckIcon,
    TrashIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface PreviewData {
    type: 'text' | 'document';
    title: string;
    content: string;
    file_type?: string;
    file_name?: string;
    can_download?: boolean;
}

interface DocumentPreviewSidebarProps {
    isOpen: boolean;
    preview: PreviewData | null;
    pdfUrl?: string | null;
    onClose: () => void;
    onDownload: () => void;
    onDelete?: () => void;
}

export default function DocumentPreviewSidebar({
    isOpen,
    preview,
    pdfUrl,
    onClose,
    onDownload,
    onDelete,
}: DocumentPreviewSidebarProps) {
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<'pdf' | 'text'>('pdf');

    if (!isOpen || !preview) return null;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(preview.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isPdf = preview.file_type?.includes('pdf');

    return (
        <div className="w-[500px] border-l border-border bg-surface flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-text-muted uppercase tracking-wide">Preview</span>
                </div>

                <div className="flex items-center gap-2">
                    {isPdf && preview.content && (
                        <div className="flex bg-background rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('pdf')}
                                className={`px-2 py-1 text-xs rounded ${viewMode === 'pdf'
                                        ? 'bg-surface text-text-primary shadow-sm'
                                        : 'text-text-muted hover:text-text-primary'
                                    }`}
                            >
                                PDF
                            </button>
                            <button
                                onClick={() => setViewMode('text')}
                                className={`px-2 py-1 text-xs rounded ${viewMode === 'text'
                                        ? 'bg-surface text-text-primary shadow-sm'
                                        : 'text-text-muted hover:text-text-primary'
                                    }`}
                            >
                                Text
                            </button>
                        </div>
                    )}
                    <button onClick={onClose} className="p-1.5 hover:bg-background rounded-lg">
                        <XMarkIcon className="h-4 w-4 text-text-muted" />
                    </button>
                </div>
            </div>

            {/* Title */}
            <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-text-primary truncate">{preview.title}</h3>
                {preview.file_name && preview.file_name !== preview.title && (
                    <p className="text-xs text-text-muted mt-0.5">{preview.file_name}</p>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {isPdf && pdfUrl && viewMode === 'pdf' ? (
                    <iframe
                        src={pdfUrl}
                        className="w-full h-full border-0"
                        title={preview.title}
                    />
                ) : (
                    <div className="h-full overflow-y-auto p-4">
                        <div className="prose prose-sm max-w-none">
                            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                                {preview.content || 'No content available'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/50">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
                    >
                        {copied ? (
                            <>
                                <CheckIcon className="h-4 w-4 text-success" />
                                <span>Copied</span>
                            </>
                        ) : (
                            <>
                                <ClipboardDocumentIcon className="h-4 w-4" />
                                <span>Copy</span>
                            </>
                        )}
                    </button>

                    {preview.can_download && (
                        <button
                            onClick={onDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            <span>Download</span>
                        </button>
                    )}
                </div>

                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-error hover:bg-error/10 rounded-lg transition-colors"
                    >
                        <TrashIcon className="h-4 w-4" />
                        <span>Delete</span>
                    </button>
                )}
            </div>
        </div>
    );
}
