import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
    XMarkIcon,
    LinkIcon,
    CloudArrowUpIcon,
    FolderIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface FilePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (files: FileInfo[]) => void;
    accept?: string;
    multiple?: boolean;
}

interface FileInfo {
    id: string;
    name: string;
    type: string;
    size: number;
    url?: string;
    source: 'local' | 'google_drive' | 'url';
}

type TabType = 'upload' | 'drive' | 'url';

export default function FilePickerModal({
    isOpen,
    onClose,
    onSelect,
    accept = '.pdf,.docx,.xlsx',
    multiple = true,
}: FilePickerModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('upload');
    const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
    const [urlInput, setUrlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const tabs = [
        { id: 'upload' as TabType, label: 'Upload', icon: CloudArrowUpIcon },
        { id: 'drive' as TabType, label: 'Google Drive', icon: FolderIcon },
        { id: 'url' as TabType, label: 'From URL', icon: LinkIcon },
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileInfos: FileInfo[] = Array.from(files).map((file) => ({
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            size: file.size,
            source: 'local' as const,
        }));

        setSelectedFiles((prev) => (multiple ? [...prev, ...fileInfos] : fileInfos));
    };

    const handleUrlAdd = () => {
        if (!urlInput.trim()) return;

        const urlFile: FileInfo = {
            id: crypto.randomUUID(),
            name: urlInput.split('/').pop() || 'document',
            type: 'application/octet-stream',
            size: 0,
            url: urlInput,
            source: 'url',
        };

        setSelectedFiles((prev) => [...prev, urlFile]);
        setUrlInput('');
    };

    const handleGoogleDrivePicker = async () => {
        // This would integrate with Google Picker API
        // For now, show a placeholder
        alert('Google Drive integration coming soon!');
    };

    const handleSubmit = () => {
        onSelect(selectedFiles);
        setSelectedFiles([]);
        onClose();
    };

    const removeFile = (id: string) => {
        setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
    };

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
                                    <Dialog.Title className="text-lg font-semibold text-text-primary">
                                        Add Documents
                                    </Dialog.Title>
                                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-background">
                                        <XMarkIcon className="h-5 w-5 text-text-muted" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-border">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={clsx(
                                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                                                activeTab === tab.id
                                                    ? 'text-primary border-b-2 border-primary'
                                                    : 'text-text-muted hover:text-text-secondary'
                                            )}
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    {activeTab === 'upload' && (
                                        <div className="space-y-4">
                                            <label className="block border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                                                <CloudArrowUpIcon className="h-10 w-10 mx-auto text-text-muted mb-3" />
                                                <p className="text-sm text-text-secondary">
                                                    Click to upload or drag and drop
                                                </p>
                                                <p className="text-xs text-text-muted mt-1">
                                                    PDF, DOCX, XLSX up to 50MB
                                                </p>
                                                <input
                                                    type="file"
                                                    accept={accept}
                                                    multiple={multiple}
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    )}

                                    {activeTab === 'drive' && (
                                        <div className="text-center py-8">
                                            <FolderIcon className="h-12 w-12 mx-auto text-text-muted mb-4" />
                                            <button
                                                onClick={handleGoogleDrivePicker}
                                                className="btn-primary"
                                            >
                                                Connect Google Drive
                                            </button>
                                            <p className="text-xs text-text-muted mt-3">
                                                Select files from your Google Drive
                                            </p>
                                        </div>
                                    )}

                                    {activeTab === 'url' && (
                                        <div className="space-y-4">
                                            <div className="flex gap-2">
                                                <input
                                                    type="url"
                                                    value={urlInput}
                                                    onChange={(e) => setUrlInput(e.target.value)}
                                                    placeholder="https://example.com/document.pdf"
                                                    className="input flex-1"
                                                />
                                                <button onClick={handleUrlAdd} className="btn-primary">
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Selected Files */}
                                    {selectedFiles.length > 0 && (
                                        <div className="mt-6 space-y-2">
                                            <h4 className="text-sm font-medium text-text-primary">
                                                Selected ({selectedFiles.length})
                                            </h4>
                                            {selectedFiles.map((file) => (
                                                <div
                                                    key={file.id}
                                                    className="flex items-center justify-between p-3 bg-background rounded-lg"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <FolderIcon className="h-5 w-5 text-text-muted flex-shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-text-primary truncate">
                                                                {file.name}
                                                            </p>
                                                            <p className="text-xs text-text-muted">{file.source}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFile(file.id)}
                                                        className="text-text-muted hover:text-error"
                                                    >
                                                        <XMarkIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-background">
                                    <button onClick={onClose} className="btn-secondary">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={selectedFiles.length === 0 || isLoading}
                                        className="btn-primary"
                                    >
                                        {isLoading ? 'Processing...' : `Add ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
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
