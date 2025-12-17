import { useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
    XMarkIcon,
    CloudArrowUpIcon,
    DocumentIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface UploadFile {
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
}

interface FileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    folderId: number;
    folderName: string;
    onUpload: (file: File) => Promise<void>;
}

export default function FileUploadModal({
    isOpen,
    onClose,
    folderId,
    folderName,
    onUpload,
}: FileUploadModalProps) {
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;

        const uploadFiles: UploadFile[] = Array.from(newFiles).map((file) => ({
            file,
            status: 'pending' as const,
            progress: 0,
        }));

        setFiles((prev) => [...prev, ...uploadFiles]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setIsUploading(true);

        // Upload files concurrently with individual progress tracking
        const uploadPromises = files.map(async (uploadFile, index) => {
            // Mark this file as uploading
            setFiles((prev) =>
                prev.map((f, i) =>
                    i === index
                        ? { ...f, status: 'uploading' as const, progress: 50 }
                        : f
                )
            );

            try {
                await onUpload(uploadFile.file);

                // Mark this file as success
                setFiles((prev) =>
                    prev.map((f, i) =>
                        i === index
                            ? { ...f, status: 'success' as const, progress: 100 }
                            : f
                    )
                );
                return { success: true };
            } catch (error: any) {
                // Mark this file as error
                setFiles((prev) =>
                    prev.map((f, i) =>
                        i === index
                            ? {
                                ...f,
                                status: 'error' as const,
                                error: error.message || 'Upload failed',
                            }
                            : f
                    )
                );
                return { success: false };
            }
        });

        // Wait for all uploads to complete
        const results = await Promise.allSettled(uploadPromises);

        setIsUploading(false);

        // Check if all files were successful
        const allSuccess = results.every(
            (result) => result.status === 'fulfilled' && result.value.success
        );

        // Close after delay if all successful
        if (allSuccess) {
            setTimeout(() => {
                onClose();
                setFiles([]);
            }, 1000);
        }
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
                                    <div>
                                        <Dialog.Title className="text-lg font-semibold text-text-primary">
                                            Upload Files
                                        </Dialog.Title>
                                        <p className="text-sm text-text-muted">to {folderName}</p>
                                    </div>
                                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-background">
                                        <XMarkIcon className="h-5 w-5 text-text-muted" />
                                    </button>
                                </div>

                                {/* Drop zone */}
                                <div className="p-6">
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onClick={() => inputRef.current?.click()}
                                        className={clsx(
                                            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                                            isDragging
                                                ? 'border-primary bg-primary-light'
                                                : 'border-border hover:border-primary-300'
                                        )}
                                    >
                                        <CloudArrowUpIcon className="h-10 w-10 mx-auto text-text-muted mb-3" />
                                        <p className="text-sm text-text-secondary">
                                            Drop files here or click to browse
                                        </p>
                                        <p className="text-xs text-text-muted mt-1">
                                            PDF, DOCX, XLSX, TXT, CSV up to 50MB
                                        </p>
                                        <input
                                            ref={inputRef}
                                            type="file"
                                            multiple
                                            onChange={(e) => handleFiles(e.target.files)}
                                            className="hidden"
                                            accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.md"
                                        />
                                    </div>

                                    {/* File list */}
                                    {files.length > 0 && (
                                        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                                            {files.map((file, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-3 p-3 bg-background rounded-lg"
                                                >
                                                    {file.status === 'success' ? (
                                                        <CheckCircleIcon className="h-5 w-5 text-success flex-shrink-0" />
                                                    ) : file.status === 'error' ? (
                                                        <ExclamationCircleIcon className="h-5 w-5 text-error flex-shrink-0" />
                                                    ) : (
                                                        <DocumentIcon className="h-5 w-5 text-text-muted flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-text-primary truncate">
                                                            {file.file.name}
                                                        </p>
                                                        <p className="text-xs text-text-muted">
                                                            {(file.file.size / 1024).toFixed(1)} KB
                                                            {file.error && (
                                                                <span className="text-error ml-2">{file.error}</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    {file.status === 'pending' && (
                                                        <button
                                                            onClick={() => removeFile(index)}
                                                            className="text-text-muted hover:text-error"
                                                        >
                                                            <XMarkIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
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
                                        onClick={handleUpload}
                                        disabled={files.length === 0 || isUploading}
                                        className="btn-primary"
                                    >
                                        {isUploading
                                            ? 'Uploading...'
                                            : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
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
