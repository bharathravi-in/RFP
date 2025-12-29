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
    ViewColumnsIcon,
    Squares2X2Icon,
    CalendarIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import EditProjectModal from '@/components/modals/EditProjectModal';
import ProjectOutcomeModal from '@/components/ProjectOutcomeModal';
import ProjectKanban from '@/components/projects/ProjectKanban';

const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'review', label: 'Review' },
    { value: 'completed', label: 'Done' },
];

const OUTCOME_BADGE_CONFIG: Record<ProjectOutcome, { label: string; icon: typeof TrophyIcon; bgColor: string; textColor: string }> = {
    won: { label: 'Won', icon: TrophyIcon, bgColor: 'bg-green-100', textColor: 'text-green-700' },
    lost: { label: 'Lost', icon: XCircleIcon, bgColor: 'bg-red-100', textColor: 'text-red-700' },
    pending: { label: 'Pending', icon: ClockIcon, bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    abandoned: { label: 'Abandoned', icon: FlagIcon, bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    review: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
};

export default function Projects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [outcomeProject, setOutcomeProject] = useState<Project | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

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
        return matchesSearch && matchesStatus;
    });

    const formatDueDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Today';
        if (diffDays <= 7) return `${diffDays}d left`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Stats
    const stats = {
        total: projects.length,
        draft: projects.filter(p => p.status === 'draft').length,
        inProgress: projects.filter(p => p.status === 'in_progress').length,
        review: projects.filter(p => p.status === 'review').length,
        completed: projects.filter(p => p.status === 'completed').length,
    };

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-text-primary">Projects</h1>
                    <p className="text-sm text-text-muted">
                        {stats.total} total • {stats.inProgress + stats.review} active
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                    <PlusIcon className="h-5 w-5" />
                    New Project
                </button>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-9 py-2 text-sm"
                    />
                </div>

                {/* Status Pills */}
                <div className="flex items-center gap-1 bg-background rounded-lg p-1">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={clsx(
                                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                                statusFilter === filter.value
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                            )}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-background rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                            'p-1.5 rounded-md transition-all',
                            viewMode === 'grid'
                                ? 'bg-primary text-white'
                                : 'text-text-muted hover:text-text-primary'
                        )}
                        title="Grid View"
                    >
                        <Squares2X2Icon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('kanban')}
                        className={clsx(
                            'p-1.5 rounded-md transition-all',
                            viewMode === 'kanban'
                                ? 'bg-primary text-white'
                                : 'text-text-muted hover:text-text-primary'
                        )}
                        title="Kanban View"
                    >
                        <ViewColumnsIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'kanban' ? (
                <ProjectKanban
                    projects={filteredProjects}
                    onProjectUpdate={(updatedProject) => {
                        setProjects(
                            projects.map((p) =>
                                p.id === updatedProject.id ? updatedProject : p
                            )
                        );
                    }}
                />
            ) : isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="card animate-pulse p-4">
                            <div className="h-4 skeleton w-3/4 mb-3" />
                            <div className="h-3 skeleton w-1/2 mb-4" />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProjects.map((project) => {
                        const status = project.status || 'draft';
                        const statusColor = STATUS_COLORS[status] || STATUS_COLORS.draft;
                        const progress = Math.round(project.completion_percent || 0);
                        const dueDate = formatDueDate(project.due_date);

                        return (
                            <div
                                key={project.id}
                                className="group relative bg-surface border border-border rounded-lg overflow-hidden hover:shadow-md hover:border-primary/30 transition-all min-h-[140px]"
                            >
                                {/* Progress Bar at Top */}
                                <div className="h-1 bg-gray-100">
                                    <div
                                        className={clsx(
                                            'h-full transition-all duration-500',
                                            progress === 100 ? 'bg-green-500' : 'bg-primary'
                                        )}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <Link to={`/projects/${project.id}`} className="block p-4">
                                    {/* Header Row */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors line-clamp-2 flex-1">
                                            {project.name}
                                        </h3>
                                        <span className={clsx(
                                            'flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium',
                                            statusColor.bg,
                                            statusColor.text
                                        )}>
                                            {status.replace('_', ' ')}
                                        </span>
                                    </div>

                                    {/* Meta Row */}
                                    <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
                                        <span className="flex items-center gap-1">
                                            <DocumentTextIcon className="h-3.5 w-3.5" />
                                            {project.question_count || 0} questions
                                        </span>
                                        {dueDate && (
                                            <span className={clsx(
                                                'flex items-center gap-1',
                                                dueDate === 'Overdue' && 'text-red-600 font-medium'
                                            )}>
                                                <CalendarIcon className="h-3.5 w-3.5" />
                                                {dueDate}
                                            </span>
                                        )}
                                    </div>

                                    {/* Progress + Outcome Row */}
                                    <div className="flex items-center justify-between">
                                        <span className={clsx(
                                            'text-sm font-semibold',
                                            progress === 100 ? 'text-green-600' : 'text-primary'
                                        )}>
                                            {progress}%
                                        </span>

                                        {project.outcome && project.outcome !== 'pending' ? (
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded text-xs font-medium',
                                                OUTCOME_BADGE_CONFIG[project.outcome]?.bgColor,
                                                OUTCOME_BADGE_CONFIG[project.outcome]?.textColor
                                            )}>
                                                {OUTCOME_BADGE_CONFIG[project.outcome]?.label}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setOutcomeProject(project);
                                                }}
                                                className="text-xs text-text-muted hover:text-primary transition-colors"
                                            >
                                                Set outcome
                                            </button>
                                        )}
                                    </div>
                                </Link>

                                {/* Action Menu - Bottom right corner */}
                                <div className="absolute bottom-2 right-2">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setOpenMenuId(openMenuId === project.id ? null : project.id);
                                        }}
                                        className="p-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-all"
                                        title="Project actions"
                                    >
                                        <EllipsisHorizontalIcon className="h-4 w-4 text-gray-500" />
                                    </button>
                                    {openMenuId === project.id && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={(e) => { e.preventDefault(); setOpenMenuId(null); }}
                                            />
                                            <div className="absolute right-0 bottom-full mb-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setEditingProject(project);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (confirm('Are you sure you want to delete this project?')) {
                                                            projectsApi.delete(project.id).then(() => {
                                                                setProjects(projects.filter(p => p.id !== project.id));
                                                                toast.success('Project deleted');
                                                            }).catch(() => toast.error('Failed to delete'));
                                                        }
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            {showCreateModal && (
                <CreateProjectModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(project) => {
                        setProjects([project, ...projects]);
                        setShowCreateModal(false);
                    }}
                />
            )}

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
    const [dueDate, setDueDate] = useState('');
    const [estimatedValue, setEstimatedValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [availableProfiles, setAvailableProfiles] = useState<{ id: number; name: string; description?: string }[]>([]);
    const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([]);

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
        if (!dueDate) {
            toast.error('Due date is required');
            return;
        }

        setIsLoading(true);
        try {
            const response = await projectsApi.create({
                name,
                description,
                client_name: clientName,
                due_date: dueDate,
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-xl shadow-modal w-full max-w-md p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Create New Project</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-1.5">
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
                        <label className="block text-sm font-medium text-text-primary mb-1.5">
                            Client Name *
                        </label>
                        <input
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="input"
                            placeholder="e.g., Department of Health"
                        />
                    </div>

                    {/* Due Date and Value Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-1.5">
                                Due Date *
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="input"
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-1.5">
                                Est. Value <span className="text-text-muted font-normal">($)</span>
                            </label>
                            <input
                                type="number"
                                value={estimatedValue}
                                onChange={(e) => setEstimatedValue(e.target.value)}
                                className="input"
                                placeholder="50000"
                                min="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-1.5">
                            Description <span className="text-text-muted font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input min-h-[60px] resize-none"
                            placeholder="Brief description..."
                        />
                    </div>

                    <div className="border-t border-border pt-4">
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Knowledge Profile *
                        </label>
                        {availableProfiles.length === 0 ? (
                            <div className="text-sm text-text-muted bg-background p-3 rounded-lg">
                                No profiles available. Create one in Settings.
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {availableProfiles.map((profile) => (
                                    <label
                                        key={profile.id}
                                        className={clsx(
                                            'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                                            selectedProfileIds.includes(profile.id)
                                                ? 'bg-primary/10 border border-primary'
                                                : 'bg-background hover:bg-surface border border-transparent'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedProfileIds.includes(profile.id)}
                                            onChange={() => handleProfileToggle(profile.id)}
                                            className="checkbox"
                                        />
                                        <span className="text-sm text-text-primary">{profile.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                            {isLoading ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
