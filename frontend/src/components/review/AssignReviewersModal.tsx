import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
    XMarkIcon,
    UserPlusIcon,
    UserIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface AssignReviewersModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectName: string;
    currentReviewers: User[];
    availableUsers: User[];
    onAssign: (userIds: number[]) => void;
}

export default function AssignReviewersModal({
    isOpen,
    onClose,
    projectName,
    currentReviewers,
    availableUsers,
    onAssign,
}: AssignReviewersModalProps) {
    const [selectedIds, setSelectedIds] = useState<number[]>(
        currentReviewers.map((r) => r.id)
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredUsers = availableUsers.filter(
        (user) =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleUser = (userId: number) => {
        setSelectedIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onAssign(selectedIds);
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
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary-light rounded-lg">
                                            <UserPlusIcon className="h-5 w-5 text-primary" />
                                        </div>
                                        <Dialog.Title className="text-lg font-semibold text-text-primary">
                                            Assign Reviewers
                                        </Dialog.Title>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-1.5 rounded-lg hover:bg-background transition-colors"
                                    >
                                        <XMarkIcon className="h-5 w-5 text-text-muted" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <p className="text-sm text-text-secondary mb-4">
                                        Select team members to review <strong>{projectName}</strong>
                                    </p>

                                    {/* Search */}
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by name or email..."
                                        className="input w-full mb-4"
                                    />

                                    {/* User List */}
                                    <div className="max-h-60 overflow-y-auto space-y-2">
                                        {filteredUsers.length === 0 ? (
                                            <p className="text-sm text-text-muted text-center py-4">
                                                No users found
                                            </p>
                                        ) : (
                                            filteredUsers.map((user) => (
                                                <button
                                                    key={user.id}
                                                    onClick={() => toggleUser(user.id)}
                                                    className={clsx(
                                                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                                                        selectedIds.includes(user.id)
                                                            ? 'border-primary bg-primary-light'
                                                            : 'border-border hover:border-primary-200'
                                                    )}
                                                >
                                                    <div className="p-2 bg-background rounded-full">
                                                        <UserIcon className="h-4 w-4 text-text-secondary" />
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <p className="text-sm font-medium text-text-primary">
                                                            {user.name}
                                                        </p>
                                                        <p className="text-xs text-text-muted">{user.email}</p>
                                                    </div>
                                                    {selectedIds.includes(user.id) && (
                                                        <CheckIcon className="h-5 w-5 text-primary" />
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>

                                    {/* Selected Count */}
                                    <p className="text-sm text-text-muted mt-4">
                                        {selectedIds.length} reviewer{selectedIds.length !== 1 && 's'} selected
                                    </p>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center gap-3 px-6 py-4 border-t border-border bg-background">
                                    <div className="flex-1" />
                                    <button onClick={onClose} className="btn-secondary">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="btn-primary"
                                    >
                                        {isSubmitting ? 'Assigning...' : 'Assign Reviewers'}
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
