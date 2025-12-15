import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    XMarkIcon,
    ArrowDownTrayIcon,
    DocumentTextIcon,
    DocumentIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    preview: {
        type: 'text' | 'document';
        title: string;
        content: string;
        file_type?: string;
        file_name?: string;
        can_download?: boolean;
    } | null;
    onDownload?: () => void;
}

export default function FilePreviewModal({
    isOpen,
    onClose,
    preview,
    onDownload,
}: FilePreviewModalProps) {
    if (!preview) return null;

    const isMarkdown = preview.file_type?.includes('markdown') || preview.file_name?.endsWith('.md');
    const isPdf = preview.file_type?.includes('pdf');

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl max-h-[85vh] bg-surface rounded-2xl shadow-modal overflow-hidden flex flex-col">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                    <div className="flex items-center gap-3">
                                        {isPdf ? (
                                            <DocumentIcon className="h-6 w-6 text-error" />
                                        ) : (
                                            <DocumentTextIcon className="h-6 w-6 text-primary" />
                                        )}
                                        <div>
                                            <Dialog.Title className="text-lg font-semibold text-text-primary">
                                                {preview.title}
                                            </Dialog.Title>
                                            {preview.file_name && (
                                                <p className="text-sm text-text-muted">{preview.file_name}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {preview.can_download && onDownload && (
                                            <button
                                                onClick={onDownload}
                                                className="p-2 text-text-muted hover:text-primary hover:bg-primary-light rounded-lg transition-colors"
                                                title="Download file"
                                            >
                                                <ArrowDownTrayIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={onClose}
                                            className="p-2 text-text-muted hover:bg-background rounded-lg transition-colors"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {preview.type === 'text' ? (
                                        <div
                                            className={clsx(
                                                'prose prose-sm max-w-none',
                                                'prose-headings:text-text-primary',
                                                'prose-p:text-text-secondary',
                                                'prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded'
                                            )}
                                        >
                                            {isMarkdown ? (
                                                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(preview.content) }} />
                                            ) : (
                                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                                    {preview.content}
                                                </pre>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {isPdf ? (
                                                <div className="bg-gray-50 rounded-lg p-8 text-center">
                                                    <DocumentIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                                                    <p className="text-text-secondary mb-4">
                                                        PDF preview not available in browser.
                                                    </p>
                                                    {preview.can_download && onDownload && (
                                                        <button onClick={onDownload} className="btn-primary">
                                                            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                                            Download PDF
                                                        </button>
                                                    )}
                                                </div>
                                            ) : null}

                                            {/* Extracted text content */}
                                            {preview.content && (
                                                <div>
                                                    <h4 className="text-sm font-medium text-text-primary mb-2">
                                                        Extracted Content
                                                    </h4>
                                                    <div className="bg-background rounded-lg p-4 max-h-96 overflow-y-auto">
                                                        <pre className="whitespace-pre-wrap text-sm text-text-secondary font-sans">
                                                            {preview.content}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

// Simple markdown to HTML (basic formatting)
function formatMarkdown(text: string): string {
    return text
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br/>');
}
