import { useState } from 'react';
import { projectsApi } from '@/api/client';
import { Project } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    ArrowRightIcon,
    ArrowLeftIcon,
    CheckCircleIcon,
    PlayIcon,
    EyeIcon,
    DocumentCheckIcon,
} from '@heroicons/react/24/outline';

interface StatusWorkflowCardProps {
    project: Project;
    onStatusChange: (updatedProject: Project) => void;
}

type ProjectStatus = 'draft' | 'in_progress' | 'review' | 'completed';

const STATUS_CONFIG: Record<ProjectStatus, {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof PlayIcon;
}> = {
    draft: {
        label: 'Draft',
        color: 'text-gray-700',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        icon: DocumentCheckIcon,
    },
    in_progress: {
        label: 'In Progress',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-300',
        icon: PlayIcon,
    },
    review: {
        label: 'In Review',
        color: 'text-amber-700',
        bgColor: 'bg-amber-100',
        borderColor: 'border-amber-300',
        icon: EyeIcon,
    },
    completed: {
        label: 'Completed',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
        icon: CheckCircleIcon,
    },
};

const STATUS_ORDER: ProjectStatus[] = ['draft', 'in_progress', 'review', 'completed'];

export default function StatusWorkflowCard({ project, onStatusChange }: StatusWorkflowCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);

    const currentStatus = (project.status || 'draft') as ProjectStatus;
    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
    const StatusIcon = STATUS_CONFIG[currentStatus]?.icon || DocumentCheckIcon;

    const canMoveForward = currentIndex < STATUS_ORDER.length - 1;
    const canMoveBackward = currentIndex > 0;

    const getNextStatus = (): ProjectStatus | null => {
        if (currentIndex < STATUS_ORDER.length - 1) {
            return STATUS_ORDER[currentIndex + 1];
        }
        return null;
    };

    const getPrevStatus = (): ProjectStatus | null => {
        if (currentIndex > 0) {
            return STATUS_ORDER[currentIndex - 1];
        }
        return null;
    };

    const getNextActionLabel = (): string => {
        switch (currentStatus) {
            case 'draft':
                return 'Start Working';
            case 'in_progress':
                return 'Submit for Review';
            case 'review':
                return 'Mark Complete';
            default:
                return 'Next';
        }
    };

    const getPrevActionLabel = (): string => {
        switch (currentStatus) {
            case 'in_progress':
                return 'Back to Draft';
            case 'review':
                return 'Back to In Progress';
            case 'completed':
                return 'Reopen for Review';
            default:
                return 'Previous';
        }
    };

    const updateStatus = async (newStatus: ProjectStatus) => {
        setIsUpdating(true);
        try {
            const response = await projectsApi.update(project.id, { status: newStatus });
            toast.success(`Status updated to ${STATUS_CONFIG[newStatus].label}`);
            onStatusChange(response.data.project);
        } catch {
            toast.error('Failed to update status');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleMoveForward = () => {
        const nextStatus = getNextStatus();
        if (nextStatus) {
            updateStatus(nextStatus);
        }
    };

    const handleMoveBackward = () => {
        const prevStatus = getPrevStatus();
        if (prevStatus) {
            updateStatus(prevStatus);
        }
    };

    return (
        <div className={clsx(
            'card border-2 transition-all',
            STATUS_CONFIG[currentStatus]?.borderColor || 'border-gray-300'
        )}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Current Status Display */}
                <div className="flex items-center gap-4">
                    <div className={clsx(
                        'h-12 w-12 rounded-xl flex items-center justify-center',
                        STATUS_CONFIG[currentStatus]?.bgColor || 'bg-gray-100'
                    )}>
                        <StatusIcon className={clsx(
                            'h-6 w-6',
                            STATUS_CONFIG[currentStatus]?.color || 'text-gray-700'
                        )} />
                    </div>
                    <div>
                        <p className="text-sm text-text-muted font-medium">Project Status</p>
                        <p className={clsx(
                            'text-lg font-semibold',
                            STATUS_CONFIG[currentStatus]?.color || 'text-gray-700'
                        )}>
                            {STATUS_CONFIG[currentStatus]?.label || 'Unknown'}
                        </p>
                    </div>
                </div>

                {/* Status Progress Indicator */}
                <div className="hidden md:flex items-center gap-2">
                    {STATUS_ORDER.map((status, index) => (
                        <div key={status} className="flex items-center">
                            <div className={clsx(
                                'h-3 w-3 rounded-full transition-all',
                                index <= currentIndex
                                    ? STATUS_CONFIG[status].bgColor.replace('100', '500')
                                    : 'bg-gray-200'
                            )} />
                            {index < STATUS_ORDER.length - 1 && (
                                <div className={clsx(
                                    'w-8 h-0.5 transition-all',
                                    index < currentIndex ? 'bg-gray-400' : 'bg-gray-200'
                                )} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {canMoveBackward && (
                        <button
                            onClick={handleMoveBackward}
                            disabled={isUpdating}
                            className="btn-secondary text-sm flex items-center gap-1.5"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">{getPrevActionLabel()}</span>
                        </button>
                    )}
                    {canMoveForward && (
                        <button
                            onClick={handleMoveForward}
                            disabled={isUpdating}
                            className={clsx(
                                'text-sm flex items-center gap-1.5 font-medium px-4 py-2 rounded-lg transition-all',
                                currentStatus === 'review'
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'btn-primary'
                            )}
                        >
                            <span>{getNextActionLabel()}</span>
                            {currentStatus === 'review' ? (
                                <CheckCircleIcon className="h-4 w-4" />
                            ) : (
                                <ArrowRightIcon className="h-4 w-4" />
                            )}
                        </button>
                    )}
                    {!canMoveForward && !canMoveBackward && (
                        <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                            <CheckCircleIcon className="h-5 w-5" />
                            Project Complete
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
