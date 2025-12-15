import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
    XMarkIcon,
    DocumentTextIcon,
    DocumentIcon,
    TableCellsIcon,
    ArrowDownTrayIcon,
    EyeIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { exportApi } from '@/api/client';
import { Project, Question } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    questions: Question[];
}

type ExportFormat = 'pdf' | 'docx' | 'xlsx';

const formatOptions = [
    {
        id: 'pdf' as ExportFormat,
        name: 'PDF',
        description: 'Portable Document Format',
        icon: DocumentTextIcon,
    },
    {
        id: 'docx' as ExportFormat,
        name: 'Word',
        description: 'Microsoft Word Document',
        icon: DocumentIcon,
    },
    {
        id: 'xlsx' as ExportFormat,
        name: 'Excel',
        description: 'Spreadsheet format',
        icon: TableCellsIcon,
    },
];

export default function ExportModal({
    isOpen,
    onClose,
    project,
    questions,
}: ExportModalProps) {
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
    const [includeOptions, setIncludeOptions] = useState({
        answers: true,
        sources: true,
        sections: true,
        metadata: false,
    });
    const [isExporting, setIsExporting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);

        try {
            let response;
            switch (selectedFormat) {
                case 'pdf':
                    response = await exportApi.pdf(project.id);
                    break;
                case 'docx':
                    response = await exportApi.docx(project.id);
                    break;
                case 'xlsx':
                    response = await exportApi.xlsx(project.id);
                    break;
            }

            // Download the file
            const blob = new Blob([response.data], {
                type: selectedFormat === 'pdf' ? 'application/pdf' :
                    selectedFormat === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.name.replace(/\s+/g, '_')}.${selectedFormat}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`Exported as ${selectedFormat.toUpperCase()}`);
            onClose();
        } catch {
            toast.error('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const approvedCount = questions.filter(q => q.status === 'approved').length;
    const answeredCount = questions.filter(q => q.status === 'answered' || q.status === 'approved').length;

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
                            <Dialog.Panel className="w-full max-w-lg bg-surface rounded-2xl shadow-modal overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                    <Dialog.Title className="text-xl font-semibold text-text-primary">
                                        Export Project
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="p-1.5 rounded-lg hover:bg-background transition-colors"
                                    >
                                        <XMarkIcon className="h-5 w-5 text-text-muted" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6 space-y-6">
                                    {/* Project Summary */}
                                    <div className="bg-background rounded-lg p-4">
                                        <h3 className="font-medium text-text-primary">{project.name}</h3>
                                        <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                                            <span>{questions.length} questions</span>
                                            <span>{answeredCount} answered</span>
                                            <span className="text-success">{approvedCount} approved</span>
                                        </div>
                                        {approvedCount < answeredCount && (
                                            <p className="text-xs text-warning mt-2">
                                                ⚠️ {answeredCount - approvedCount} answers pending review
                                            </p>
                                        )}
                                    </div>

                                    {/* Format Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary mb-3">
                                            Export Format
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {formatOptions.map((format) => (
                                                <button
                                                    key={format.id}
                                                    onClick={() => setSelectedFormat(format.id)}
                                                    className={clsx(
                                                        'flex flex-col items-center p-4 rounded-xl border-2 transition-all',
                                                        selectedFormat === format.id
                                                            ? 'border-primary bg-primary-light'
                                                            : 'border-border hover:border-primary-200'
                                                    )}
                                                >
                                                    <format.icon className={clsx(
                                                        'h-8 w-8 mb-2',
                                                        selectedFormat === format.id ? 'text-primary' : 'text-text-secondary'
                                                    )} />
                                                    <span className={clsx(
                                                        'font-medium',
                                                        selectedFormat === format.id ? 'text-primary' : 'text-text-primary'
                                                    )}>
                                                        {format.name}
                                                    </span>
                                                    <span className="text-xs text-text-muted mt-1">
                                                        {format.description}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Include Options */}
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary mb-3">
                                            Include in Export
                                        </label>
                                        <div className="space-y-2">
                                            {[
                                                { key: 'answers', label: 'Include answers' },
                                                { key: 'sources', label: 'Include source citations' },
                                                { key: 'sections', label: 'Group by sections' },
                                                { key: 'metadata', label: 'Include metadata (dates, reviewers)' },
                                            ].map((option) => (
                                                <label key={option.key} className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={includeOptions[option.key as keyof typeof includeOptions]}
                                                        onChange={(e) => setIncludeOptions({
                                                            ...includeOptions,
                                                            [option.key]: e.target.checked
                                                        })}
                                                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                                    />
                                                    <span className="text-sm text-text-primary">{option.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center gap-3 px-6 py-4 border-t border-border bg-background">
                                    <button
                                        onClick={() => setShowPreview(true)}
                                        className="btn-secondary"
                                    >
                                        <EyeIcon className="h-4 w-4" />
                                        Preview
                                    </button>
                                    <div className="flex-1" />
                                    <button onClick={onClose} className="btn-secondary">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleExport}
                                        disabled={isExporting}
                                        className="btn-primary"
                                    >
                                        {isExporting ? (
                                            <>
                                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Exporting...
                                            </>
                                        ) : (
                                            <>
                                                <ArrowDownTrayIcon className="h-4 w-4" />
                                                Export {selectedFormat.toUpperCase()}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
