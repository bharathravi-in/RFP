import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/client';
import { Project, ProjectOutcome } from '@/types';
import toast from 'react-hot-toast';
import {
    PlusIcon,
    FolderIcon,
    MagnifyingGlassIcon,
    EllipsisHorizontalIcon,
    TrophyIcon,
    XCircleIcon,
    ClockIcon,
    FlagIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import EditProjectModal from '@/components/modals/EditProjectModal';
import ProjectOutcomeModal from '@/components/ProjectOutcomeModal';

const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'review', label: 'In Review' },
    { value: 'completed', label: 'Completed' },
];

const outcomeFilters = [
    { value: 'all', label: 'All Outcomes' },
    { value: 'won', label: '🏆 Won' },
    { value: 'lost', label: '❌ Lost' },
    { value: 'pending', label: '⏳ Pending' },
];

const OUTCOME_BADGE_CONFIG: Record<ProjectOutcome, { label: string; icon: typeof TrophyIcon; bgColor: string; textColor: string }> = {
    won: { label: 'Won', icon: TrophyIcon, bgColor: 'bg-green-100', textColor: 'text-green-700' },
    lost: { label: 'Lost', icon: XCircleIcon, bgColor: 'bg-red-100', textColor: 'text-red-700' },
    pending: { label: 'Pending', icon: ClockIcon, bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    abandoned: { label: 'Abandoned', icon: FlagIcon, bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
};

export default function Projects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [outcomeFilter, setOutcomeFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [outcomeProject, setOutcomeProject] = useState<Project | null>(null);

    const loadProjects = useCallback(async () => {
        try {
            const response = await projectsApi.list();
            setProjects(response.data.projects || []);
        } catch {
            toast.error('Failed to load projects');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const filteredProjects = projects.filter((project) => {
        const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
        const matchesOutcome = outcomeFilter === 'all' || project.outcome === outcomeFilter;
        return matchesSearch && matchesStatus && matchesOutcome;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return 'badge-success';
            case 'review':
                return 'badge-warning';
            case 'in_progress':
                return 'badge-primary';
            default:
                return 'badge-neutral';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="section-title">Projects</h1>
                    <p className="section-subtitle">
                        Manage your RFP, RFI, and questionnaire responses
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary self-start sm:self-auto">
                    <PlusIcon className="h-5 w-5" />
                    <span className="hidden xs:inline">New Project</span>
                    <span className="xs:hidden">New</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                    />
                </div>
                <div className="flex items-center gap-1 bg-surface border border-border rounded-button p-1 overflow-x-auto no-scrollbar">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={clsx(
                                'px-3 py-1.5 rounded-badge text-sm font-medium transition-all whitespace-nowrap',
                                statusFilter === filter.value
                                    ? 'bg-primary text-white'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                            )}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 bg-surface border border-border rounded-button p-1">
                    {outcomeFilters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setOutcomeFilter(filter.value)}
                            className={clsx(
                                'px-3 py-1.5 rounded-badge text-sm font-medium transition-all whitespace-nowrap',
                                outcomeFilter === filter.value
                                    ? 'bg-amber-500 text-white'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                            )}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Projects Grid */}
            {isLoading ? (
                <div className="cards-grid">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="card animate-pulse">
                            <div className="h-4 skeleton w-3/4 mb-4" />
                            <div className="h-3 skeleton w-1/2 mb-6" />
                            <div className="h-2 skeleton w-full" />
                        </div>
                    ))}
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="card text-center py-12">
                    <FolderIcon className="h-12 w-12 text-text-muted mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-text-primary mb-2">No projects found</h3>
                    <p className="text-text-secondary mb-6">
                        {searchQuery || statusFilter !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Get started by creating your first project'}
                    </p>
                    {!searchQuery && statusFilter === 'all' && (
                        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                            <PlusIcon className="h-5 w-5" />
                            Create Project
                        </button>
                    )}
                </div>
            ) : (
                <div className="cards-grid">
                    {filteredProjects.map((project) => (
                        <div
                            key={project.id}
                            className="group relative bg-surface border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-300"
                        >
                            {/* Gradient Header */}
                            <div className="h-2 bg-gradient-to-r from-primary via-primary-dark to-primary" />

                            {/* Card Content */}
                            <Link
                                to={`/projects/${project.id}`}
                                className="block p-6"
                            >
                                {/* Icon and Title */}
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <FolderIcon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-lg text-text-primary group-hover:text-primary transition-colors mb-1 truncate">
                                            {project.name}
                                        </h3>
                                        <p className="text-xs text-text-muted">
                                            {project.question_count || 0} questions
                                        </p>
                                    </div>
                                </div>

                                {/* Description */}
                                {project.description && (
                                    <p className="text-sm text-text-secondary line-clamp-2 mb-4 min-h-[40px]">
                                        {project.description}
                                    </p>
                                )}

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-text-muted">Progress</span>
                                        <span className="text-xs font-semibold text-primary">
                                            {Math.round(project.completion_percent)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-background rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all duration-500"
                                            style={{ width: `${project.completion_percent}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Footer with Status and Outcome */}
                                <div className="flex items-center justify-between pt-4 border-t border-border">
                                    <div className="flex items-center gap-2">
                                        <span className={`badge ${getStatusBadge(project.status)} text-xs`}>
                                            {project.status.replace('_', ' ')}
                                        </span>
                                        {project.outcome && project.outcome !== 'pending' && (
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                                                OUTCOME_BADGE_CONFIG[project.outcome]?.bgColor,
                                                OUTCOME_BADGE_CONFIG[project.outcome]?.textColor
                                            )}>
                                                {OUTCOME_BADGE_CONFIG[project.outcome]?.label}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setOutcomeProject(project);
                                        }}
                                        className="text-xs text-text-muted hover:text-primary transition-colors"
                                    >
                                        {project.outcome === 'pending' || !project.outcome ? 'Mark Outcome' : 'Update'}
                                    </button>
                                </div>
                            </Link>

                            {/* Edit Menu Button - Top Right */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setEditingProject(project);
                                }}
                                className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 hover:bg-background/80 backdrop-blur-sm rounded-lg transition-all z-10 shadow-sm"
                                title="Edit project"
                            >
                                <EllipsisHorizontalIcon className="h-5 w-5 text-text-secondary hover:text-text-primary" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Project Modal */}
            {showCreateModal && (
                <CreateProjectModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(project) => {
                        setProjects([project, ...projects]);
                        setShowCreateModal(false);
                    }}
                />
            )}

            {/* Edit Project Modal */}
            {editingProject && (
                <EditProjectModal
                    project={editingProject}
                    onClose={() => setEditingProject(null)}
                    onUpdated={(updatedProject) => {
                        setProjects(
                            projects.map((p) =>
                                p.id === updatedProject.id ? updatedProject : p
                            )
                        );
                        setEditingProject(null);
                    }}
                />
            )}

            {/* Project Outcome Modal */}
            {outcomeProject && (
                <ProjectOutcomeModal
                    project={outcomeProject}
                    isOpen={!!outcomeProject}
                    onClose={() => setOutcomeProject(null)}
                    onUpdate={(updatedProject) => {
                        setProjects(
                            projects.map((p) =>
                                p.id === updatedProject.id ? updatedProject : p
                            )
                        );
                        setOutcomeProject(null);
                    }}
                />
            )}
        </div>
    );
}

// Create Project Modal Component
function CreateProjectModal({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (project: Project) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [clientName, setClientName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Knowledge Profiles
    const [availableProfiles, setAvailableProfiles] = useState<{ id: number; name: string; description?: string }[]>([]);
    const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([]);

    // Fetch profiles from API
    useEffect(() => {
        import('@/api/client').then(({ default: api }) => {
            api.get('/knowledge/profiles').then(res => {
                setAvailableProfiles(res.data.profiles || []);
            }).catch(() => { });
        });
    }, []);

    const handleProfileToggle = (profileId: number) => {
        setSelectedProfileIds((prev) =>
            prev.includes(profileId)
                ? prev.filter((id) => id !== profileId)
                : [...prev, profileId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Project name is required');
            return;
        }
        if (!clientName.trim()) {
            toast.error('Client name is required');
            return;
        }
        if (selectedProfileIds.length === 0) {
            toast.error('Please select at least one Knowledge Profile');
            return;
        }

        setIsLoading(true);
        try {
            const response = await projectsApi.create({
                name,
                description,
                client_name: clientName,
                knowledge_profile_ids: selectedProfileIds,
            });
            toast.success('Project created!');
            onCreated(response.data.project);
        } catch {
            toast.error('Failed to create project');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-modal w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-semibold text-text-primary mb-6">Create New Project</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Info */}
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
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Client Name *
                        </label>
                        <input
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="input"
                            placeholder="e.g., Department of Health"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Description <span className="text-text-muted">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input min-h-[80px] resize-none"
                            placeholder="Brief description of this project..."
                        />
                    </div>

                    {/* Knowledge Profile Selection - Required */}
                    <div className="border-t border-border pt-4 mt-4">
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Knowledge Profile *
                        </label>
                        <p className="text-xs text-text-muted mb-3">
                            Select profiles to scope AI-generated answers to matching knowledge
                        </p>
                        {availableProfiles.length === 0 ? (
                            <div className="text-sm text-text-muted bg-background p-3 rounded-lg">
                                No knowledge profiles available. Create one in Settings → Knowledge Profiles.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto bg-background p-3 rounded-lg">
                                {availableProfiles.map((profile) => (
                                    <label
                                        key={profile.id}
                                        className={clsx(
                                            'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border',
                                            selectedProfileIds.includes(profile.id)
                                                ? 'border-primary bg-primary/10'
                                                : 'border-transparent hover:bg-surface'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedProfileIds.includes(profile.id)}
                                            onChange={() => handleProfileToggle(profile.id)}
                                            className="checkbox"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-text-primary">{profile.name}</span>
                                            {profile.description && (
                                                <p className="text-xs text-text-muted truncate">{profile.description}</p>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                        {selectedProfileIds.length > 0 && (
                            <p className="text-xs text-primary mt-2">
                                {selectedProfileIds.length} profile{selectedProfileIds.length > 1 ? 's' : ''} selected
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                            {isLoading ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


