import { useState } from 'react';
import clsx from 'clsx';
import {
    XMarkIcon,
    DocumentTextIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

export interface SourceInfo {
    title: string;
    relevance: number;
    snippet?: string;
    page_number?: number;
    file_name?: string;
    content?: string;
}

interface SourceInfoModalProps {
    source: SourceInfo;
    sourceIndex: number;
    isOpen: boolean;
    onClose: () => void;
}

type SourceTab = 'content' | 'metadata';

export default function SourceInfoModal({
    source,
    sourceIndex,
    isOpen,
    onClose,
}: SourceInfoModalProps) {
    const [activeTab, setActiveTab] = useState<SourceTab>('content');

    if (!isOpen) return null;

    const fileName = source.file_name || source.title || 'Unknown Source';
    const pageNumber = source.page_number || 'N/A';
    const relevancePercent = Math.round((source.relevance || 0) * 100);
    const textContent = source.content || source.snippet || 'No text content available.';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col animate-fade-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Source Information
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Details about this source document
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-4 border-b border-gray-200 -mx-6 px-6">
                        <button
                            onClick={() => setActiveTab('content')}
                            className={clsx(
                                'px-4 py-2.5 text-sm font-medium transition-colors relative',
                                activeTab === 'content'
                                    ? 'text-primary'
                                    : 'text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <DocumentTextIcon className="h-4 w-4" />
                                Text Content
                            </div>
                            {activeTab === 'content' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('metadata')}
                            className={clsx(
                                'px-4 py-2.5 text-sm font-medium transition-colors relative',
                                activeTab === 'metadata'
                                    ? 'text-primary'
                                    : 'text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <InformationCircleIcon className="h-4 w-4" />
                                Metadata
                            </div>
                            {activeTab === 'metadata' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'content' && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-gray-700">Text:</span>
                                <span className="text-xs text-gray-500">
                                    {fileName} {pageNumber !== 'N/A' && `- Page ${pageNumber}`}
                                </span>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                    {textContent}
                                </pre>
                            </div>
                        </div>
                    )}

                    {activeTab === 'metadata' && (
                        <div className="space-y-6">
                            {/* File Name */}
                            <div>
                                <label className="text-sm text-gray-500 block mb-1">File Name</label>
                                <p className="text-base font-medium text-gray-900">{fileName}</p>
                            </div>

                            {/* Page Number */}
                            {pageNumber !== 'N/A' && (
                                <div>
                                    <label className="text-sm text-gray-500 block mb-1">Page Number</label>
                                    <p className="text-base font-medium text-gray-900">{pageNumber}</p>
                                </div>
                            )}

                            {/* Relevance */}
                            <div>
                                <label className="text-sm text-gray-500 block mb-2">Relevance</label>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-500"
                                            style={{ width: `${relevancePercent}%` }}
                                        />
                                    </div>
                                    <span className="text-sm text-gray-600 font-medium">
                                        {relevancePercent}% match
                                    </span>
                                </div>
                            </div>

                            {/* Info Note */}
                            <div className="mt-6 pt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-500">
                                    This source was used to generate the answer. You can view the full document in your project files.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
