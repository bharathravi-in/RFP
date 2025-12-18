import { useState, useCallback, useEffect } from 'react';
import { projectsApi } from '@/api/client';
import api from '@/api/client';
import { Project } from '@/types';
import toast from 'react-hot-toast';
import {
    XMarkIcon,
    BookOpenIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface EditProjectModalProps {
    project: Project;
    onClose: () => void;
    onUpdated: (project: Project) => void;
}

const clientTypes = [
    { code: 'government', name: 'Government' },
    { code: 'private', name: 'Private Sector' },
    { code: 'enterprise', name: 'Enterprise' },
    { code: 'public_sector', name: 'Public Sector' },
    { code: 'ngo', name: 'NGO' },
    { code: 'smb', name: 'SMB' },
];

export default function EditProjectModal({
    project,
    onClose,
    onUpdated,
}: EditProjectModalProps) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || '');
    const [clientName, setClientName] = useState(project.client_name || '');
    const [clientType, setClientType] = useState(project.client_type || '');
    const [dueDate, setDueDate] = useState(
        project.due_date ? project.due_date.split('T')[0] : ''
    );
    const [status, setStatus] = useState(project.status || 'draft');
    const [isLoading, setIsLoading] = useState(false);

    // Knowledge Profiles
    const [availableProfiles, setAvailableProfiles] = useState<{ id: number; name: string; description?: string }[]>([]);
    const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>(
        project.knowledge_profiles?.map((p: any) => p.id) || []
    );

    // Fetch knowledge profiles
    useEffect(() => {
        api.get('/knowledge/profiles').then(res => {
            setAvailableProfiles(res.data.profiles || []);
        }).catch(() => { });
    }, []);

    const handleProfileToggle = useCallback((profileId: number) => {
        setSelectedProfileIds((prev) =>
            prev.includes(profileId)
                ? prev.filter((id) => id !== profileId)
                : [...prev, profileId]
        );
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Project name is required');
            return;
        }

        setIsLoading(true);
        try {
            const response = await projectsApi.update(project.id, {
                name,
                description,
                status,
                due_date: dueDate || null,
                client_name: clientName || undefined,
                client_type: clientType || undefined,
                knowledge_profile_ids: selectedProfileIds,
            });
            toast.success('Project updated!');
            onUpdated(response.data.project);
            onClose();
        } catch {
            toast.error('Failed to update project');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-modal w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-text-primary">Edit Project</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-background rounded-lg transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <span className="text-lg">📋</span>
                            Basic Information
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Project Name *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="input"
                                    placeholder="e.g., Enterprise Security RFP"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as 'draft' | 'in_progress' | 'review' | 'completed')}
                                    className="input"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="review">In Review</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="input resize-none"
                                placeholder="Project description and goals..."
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* Client Information */}
                    <div className="space-y-4 border-t border-border pt-4">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <span className="text-lg">🏢</span>
                            Client Information
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Client Name
                                </label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="input"
                                    placeholder="Name of the client/buyer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Client Type
                                </label>
                                <select
                                    value={clientType}
                                    onChange={(e) => setClientType(e.target.value)}
                                    className="input"
                                >
                                    <option value="">Select client type</option>
                                    {clientTypes.map((type) => (
                                        <option key={type.code} value={type.code}>
                                            {type.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-4 border-t border-border pt-4">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            Timeline
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="input max-w-xs"
                            />
                        </div>
                    </div>

                    {/* Knowledge Profiles */}
                    {availableProfiles.length > 0 && (
                        <div className="space-y-4 border-t border-border pt-4">
                            <h3 className="font-semibold text-text-primary flex items-center gap-2">
                                <BookOpenIcon className="h-5 w-5" />
                                Knowledge Profiles
                                <span className="text-xs text-text-muted font-normal ml-1">(scope AI answers)</span>
                            </h3>

                            <div className="grid grid-cols-1 gap-2">
                                {availableProfiles.map((profile) => (
                                    <label
                                        key={profile.id}
                                        className={clsx(
                                            'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border',
                                            selectedProfileIds.includes(profile.id)
                                                ? 'border-primary bg-primary-light'
                                                : 'border-border hover:bg-background'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedProfileIds.includes(profile.id)}
                                            onChange={() => handleProfileToggle(profile.id)}
                                            className="checkbox mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-text-primary">{profile.name}</span>
                                            {profile.description && (
                                                <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{profile.description}</p>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-text-muted">
                                Selected profiles filter which knowledge items are used for AI-generated answers
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-6 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 btn-primary"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
