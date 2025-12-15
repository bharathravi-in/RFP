import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/client';
import { Project } from '@/types';
import toast from 'react-hot-toast';
import {
    PlusIcon,
    FolderIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'review', label: 'In Review' },
    { value: 'completed', label: 'Completed' },
];

export default function Projects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const response = await projectsApi.list();
            setProjects(response.data.projects || []);
        } catch {
            toast.error('Failed to load projects');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProjects = projects.filter((project) => {
        const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
        return matchesSearch && matchesStatus;
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-text-primary">Projects</h1>
                    <p className="mt-1 text-text-secondary">
                        Manage your RFP, RFI, and questionnaire responses
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                    <PlusIcon className="h-5 w-5" />
                    New Project
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                    />
                </div>
                <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={clsx(
                                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                                statusFilter === filter.value
                                    ? 'bg-primary text-white'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-background'
                            )}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Projects Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="card animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                            <div className="h-3 bg-gray-200 rounded w-1/2 mb-6" />
                            <div className="h-2 bg-gray-200 rounded w-full" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project) => (
                        <Link
                            key={project.id}
                            to={`/projects/${project.id}`}
                            className="card group hover:border-primary transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center">
                                    <FolderIcon className="h-5 w-5 text-primary" />
                                </div>
                                <span className={`badge ${getStatusBadge(project.status)}`}>
                                    {project.status.replace('_', ' ')}
                                </span>
                            </div>
                            <h3 className="font-semibold text-text-primary group-hover:text-primary transition-colors mb-2">
                                {project.name}
                            </h3>
                            {project.description && (
                                <p className="text-sm text-text-secondary line-clamp-2 mb-4">
                                    {project.description}
                                </p>
                            )}
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-muted">
                                    {project.question_count || 0} questions
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-text-primary">
                                        {Math.round(project.completion_percent)}%
                                    </span>
                                    <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all"
                                            style={{ width: `${project.completion_percent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Link>
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
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Project name is required');
            return;
        }

        setIsLoading(true);
        try {
            const response = await projectsApi.create({ name, description });
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
            <div className="bg-surface rounded-2xl shadow-modal w-full max-w-md p-6 animate-scale-in">
                <h2 className="text-xl font-semibold text-text-primary mb-6">Create New Project</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Project Name
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
                            Description <span className="text-text-muted">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input min-h-[100px] resize-none"
                            placeholder="Brief description of this project..."
                        />
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
