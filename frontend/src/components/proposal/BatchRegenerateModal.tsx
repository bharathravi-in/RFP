import { useState } from 'react';
import { XMarkIcon, ArrowPathIcon, CheckIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { sectionsApi } from '@/api/client';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Section {
    id: number;
    title: string;
    status: string;
}

interface BatchRegenerateModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[];
    projectId: number;
    onComplete: () => void;
}

/**
 * Modal for batch regenerating multiple proposal sections.
 */
export default function BatchRegenerateModal({
    isOpen,
    onClose,
    sections,
    projectId,
    onComplete
}: BatchRegenerateModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState<Record<number, 'success' | 'error'>>({});

    const toggleSection = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === sections.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sections.map(s => s.id)));
        }
    };

    const handleRegenerate = async () => {
        if (selectedIds.size === 0) {
            toast.error('Select at least one section');
            return;
        }

        setIsProcessing(true);
        setProgress({ current: 0, total: selectedIds.size });
        setResults({});

        const ids = Array.from(selectedIds);
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < ids.length; i++) {
            const sectionId = ids[i];
            setProgress({ current: i + 1, total: ids.length });

            try {
                await sectionsApi.generateSection(sectionId);
                setResults(prev => ({ ...prev, [sectionId]: 'success' }));
                successCount++;
            } catch (error) {
                console.error(`Failed to regenerate section ${sectionId}:`, error);
                setResults(prev => ({ ...prev, [sectionId]: 'error' }));
                errorCount++;
            }
        }

        setIsProcessing(false);

        if (errorCount === 0) {
            toast.success(`Successfully regenerated ${successCount} sections`);
        } else {
            toast.error(`${errorCount} sections failed, ${successCount} succeeded`);
        }

        onComplete();
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
                onClick={onClose}
            >
                {/* Modal */}
                <div
                    className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Batch Regenerate</h2>
                            <p className="text-sm text-gray-500">Select sections to regenerate with AI</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" disabled={isProcessing}>
                            <XMarkIcon className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                        {/* Select All */}
                        <div className="flex items-center justify-between mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === sections.length}
                                    onChange={toggleAll}
                                    disabled={isProcessing}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm font-medium text-gray-700">Select All</span>
                            </label>
                            <span className="text-sm text-gray-500">
                                {selectedIds.size} of {sections.length} selected
                            </span>
                        </div>

                        {/* Sections List */}
                        <div className="space-y-2">
                            {sections.map((section) => {
                                const result = results[section.id];
                                return (
                                    <label
                                        key={section.id}
                                        className={clsx(
                                            'flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                                            selectedIds.has(section.id)
                                                ? 'border-primary bg-primary/5'
                                                : 'border-gray-200 hover:bg-gray-50',
                                            isProcessing && 'cursor-not-allowed opacity-60'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(section.id)}
                                            onChange={() => toggleSection(section.id)}
                                            disabled={isProcessing}
                                            className="rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {section.title}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Status: {section.status}
                                            </p>
                                        </div>
                                        {result === 'success' && (
                                            <CheckIcon className="h-5 w-5 text-success" />
                                        )}
                                        {result === 'error' && (
                                            <ExclamationCircleIcon className="h-5 w-5 text-error" />
                                        )}
                                    </label>
                                );
                            })}
                        </div>

                        {/* Progress */}
                        {isProcessing && (
                            <div className="mt-4 p-4 bg-primary/5 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-primary">Regenerating...</span>
                                    <span className="text-sm text-primary">
                                        {progress.current} / {progress.total}
                                    </span>
                                </div>
                                <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <button onClick={onClose} className="btn-secondary" disabled={isProcessing}>
                            {isProcessing ? 'Please wait...' : 'Cancel'}
                        </button>
                        <button
                            onClick={handleRegenerate}
                            disabled={selectedIds.size === 0 || isProcessing}
                            className="btn-primary flex items-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <ArrowPathIcon className="h-4 w-4" />
                                    Regenerate ({selectedIds.size})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
