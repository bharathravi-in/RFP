import { useState } from 'react';
import { XMarkIcon, EnvelopeIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { invitationsApi } from '@/api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInviteSent: () => void;
}

const roles = [
    { id: 'viewer', name: 'Viewer', description: 'Can view projects and answers' },
    { id: 'reviewer', name: 'Reviewer', description: 'Can review and approve answers' },
    { id: 'editor', name: 'Editor', description: 'Can edit projects and answers' },
    { id: 'admin', name: 'Admin', description: 'Full access to all features' },
];

export default function InviteMemberModal({ isOpen, onClose, onInviteSent }: InviteMemberModalProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('viewer');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('Email is required');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        try {
            const response = await invitationsApi.create({ email, role });
            toast.success('Invitation sent successfully!');
            setEmail('');
            setRole('viewer');
            onInviteSent();
            onClose();

            // Show the invite link for demo (in production, this would be sent via email)
            if (response.data.invite_link) {
                console.log('Invite link:', response.data.invite_link);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to send invitation');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full shadow-xl animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <UserPlusIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-text-primary">Invite Team Member</h2>
                            <p className="text-sm text-text-secondary">Send an invitation to join your organization</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <XMarkIcon className="h-5 w-5 text-text-secondary" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input w-full pl-10"
                                placeholder="colleague@company.com"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Role
                        </label>
                        <div className="space-y-2">
                            {roles.map((r) => (
                                <label
                                    key={r.id}
                                    className={clsx(
                                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                                        role === r.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-gray-300"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="role"
                                            value={r.id}
                                            checked={role === r.id}
                                            onChange={(e) => setRole(e.target.value)}
                                            className="h-4 w-4 text-primary focus:ring-primary"
                                        />
                                        <div>
                                            <p className="font-medium text-text-primary">{r.name}</p>
                                            <p className="text-xs text-text-secondary">{r.description}</p>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary flex-1"
                        >
                            {isLoading ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </form>

                {/* Info footer */}
                <div className="px-6 pb-6">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-700">
                            The invited person will receive an email with a link to join your organization.
                            Invitations expire after 7 days.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
