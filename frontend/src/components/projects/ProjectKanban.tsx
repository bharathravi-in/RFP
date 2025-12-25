import { useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/client';
import { Project } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    FolderIcon,
    CalendarIcon,
} from '@heroicons/react/24/outline';

interface ProjectKanbanProps {
    projects: Project[];
    onProjectUpdate: (updatedProject: Project) => void;
}

type ProjectStatus = 'draft' | 'in_progress' | 'review' | 'completed';

const COLUMNS: { status: ProjectStatus; label: string; color: string; bgColor: string }[] = [
    { status: 'draft', label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    { status: 'in_progress', label: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    { status: 'review', label: 'In Review', color: 'text-amber-700', bgColor: 'bg-amber-100' },
    { status: 'completed', label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' },
];

export default function ProjectKanban({ projects, onProjectUpdate }: ProjectKanbanProps) {
    const [draggedProject, setDraggedProject] = useState<Project | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<ProjectStatus | null>(null);

    const getProjectsByStatus = (status: ProjectStatus): Project[] => {
        return projects.filter(p => (p.status || 'draft') === status);
    };

    const handleDragStart = (e: React.DragEvent, project: Project) => {
        setDraggedProject(project);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', project.id.toString());
    };

    const handleDragEnd = () => {
        setDraggedProject(null);
        setDragOverColumn(null);
    };

    const handleDragOver = (e: React.DragEvent, status: ProjectStatus) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(status);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: ProjectStatus) => {
        e.preventDefault();
        setDragOverColumn(null);

        if (!draggedProject) return;

        const currentStatus = (draggedProject.status || 'draft') as ProjectStatus;
        if (currentStatus === newStatus) {
            setDraggedProject(null);
            return;
        }

        try {
            const response = await projectsApi.update(draggedProject.id, { status: newStatus });
            toast.success(`Moved to ${COLUMNS.find(c => c.status === newStatus)?.label}`);
            onProjectUpdate(response.data.project);
        } catch {
            toast.error('Failed to update project status');
        }

        setDraggedProject(null);
    };

    const formatDueDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays <= 7) return `${diffDays} days`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
            {COLUMNS.map((column) => {
                const columnProjects = getProjectsByStatus(column.status);
                const isDropTarget = dragOverColumn === column.status;

                return (
                    <div
                        key={column.status}
                        className="flex-shrink-0 w-72"
                        onDragOver={(e) => handleDragOver(e, column.status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, column.status)}
                    >
                        {/* Column Header */}
                        <div className={clsx(
                            'flex items-center justify-between px-3 py-2 rounded-t-lg',
                            column.bgColor
                        )}>
                            <h3 className={clsx('font-semibold text-sm', column.color)}>
                                {column.label}
                            </h3>
                            <span className={clsx(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                column.bgColor,
                                column.color
                            )}>
                                {columnProjects.length}
                            </span>
                        </div>

                        {/* Column Content */}
                        <div
                            className={clsx(
                                'min-h-[400px] bg-background rounded-b-lg border-2 transition-colors p-2 space-y-2',
                                isDropTarget
                                    ? 'border-primary border-dashed bg-primary/5'
                                    : 'border-border'
                            )}
                        >
                            {columnProjects.length === 0 ? (
                                <div className="flex items-center justify-center h-24 text-text-muted text-sm">
                                    {isDropTarget ? 'Drop here' : 'No projects'}
                                </div>
                            ) : (
                                columnProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, project)}
                                        onDragEnd={handleDragEnd}
                                        className={clsx(
                                            'bg-surface rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all',
                                            draggedProject?.id === project.id && 'opacity-50 scale-95'
                                        )}
                                    >
                                        <Link
                                            to={`/projects/${project.id}`}
                                            className="block"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {/* Project Name */}
                                            <div className="flex items-start gap-2 mb-2">
                                                <FolderIcon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                                <h4 className="font-medium text-sm text-text-primary line-clamp-2 hover:text-primary transition-colors">
                                                    {project.name}
                                                </h4>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="mb-2">
                                                <div className="flex justify-between text-xs text-text-muted mb-1">
                                                    <span>Progress</span>
                                                    <span>{Math.round(project.completion_percent || 0)}%</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all"
                                                        style={{ width: `${project.completion_percent || 0}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Footer */}
                                            <div className="flex items-center justify-between text-xs text-text-muted">
                                                <span>{project.question_count || 0} questions</span>
                                                {project.due_date && (
                                                    <span className={clsx(
                                                        'flex items-center gap-1',
                                                        formatDueDate(project.due_date) === 'Overdue' && 'text-red-600 font-medium'
                                                    )}>
                                                        <CalendarIcon className="h-3 w-3" />
                                                        {formatDueDate(project.due_date)}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
