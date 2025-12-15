import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, FolderPlusIcon } from '@heroicons/react/24/outline';

interface CreateFolderModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentFolderName?: string;
    onSubmit: (data: { name: string; description?: string; color?: string }) => Promise<void>;
}

const FOLDER_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
];

export default function CreateFolderModal({
    isOpen,
    onClose,
    parentFolderName,
    onSubmit,
}: CreateFolderModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState(FOLDER_COLORS[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await onSubmit({ name: name.trim(), description: description.trim() || undefined, color });
            setName('');
            setDescription('');
            setColor(FOLDER_COLORS[0]);
            onClose();
        } finally {
            setIsSubmitting(false);
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
                            <Dialog.Panel className="w-full max-w-md bg-surface rounded-2xl shadow-modal overflow-hidden">
                                <form onSubmit={handleSubmit}>
                                    {/* Header */}
                                    <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                                        <FolderPlusIcon className="h-6 w-6 text-primary" />
                                        <div>
                                            <Dialog.Title className="text-lg font-semibold text-text-primary">
                                                Create Folder
                                            </Dialog.Title>
                                            {parentFolderName && (
                                                <p className="text-sm text-text-muted">in {parentFolderName}</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="ml-auto p-1.5 rounded-lg hover:bg-background"
                                        >
                                            <XMarkIcon className="h-5 w-5 text-text-muted" />
                                        </button>
                                    </div>

                                    {/* Form */}
                                    <div className="p-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-text-primary mb-1.5">
                                                Folder Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="e.g., Company Policies"
                                                className="input w-full"
                                                autoFocus
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-text-primary mb-1.5">
                                                Description
                                            </label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Optional description"
                                                rows={2}
                                                className="input w-full resize-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-text-primary mb-2">
                                                Color
                                            </label>
                                            <div className="flex gap-2 flex-wrap">
                                                {FOLDER_COLORS.map((c) => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => setColor(c)}
                                                        className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                                                            }`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-background">
                                        <button type="button" onClick={onClose} className="btn-secondary">
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!name.trim() || isSubmitting}
                                            className="btn-primary"
                                        >
                                            {isSubmitting ? 'Creating...' : 'Create Folder'}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
