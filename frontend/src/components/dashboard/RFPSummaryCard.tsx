import { Link } from 'react-router-dom';
import { ProgressRing } from './DashboardStats';
import {
    DocumentTextIcon,
    ChatBubbleLeftRightIcon,
    CheckCircleIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface RFPSummaryCardProps {
    project: {
        id: number;
        name: string;
        status: string;
        client_name?: string;
        question_count?: number;
        answered_count?: number;
        approved_count?: number;
        completion_percent?: number;
    };
}

export default function RFPSummaryCard({ project }: RFPSummaryCardProps) {
    const questionCount = project.question_count || 0;
    const answeredCount = project.answered_count || 0;
    const approvedCount = project.approved_count || 0;
    const completionPercent = project.completion_percent ||
        (questionCount > 0 ? Math.round((answeredCount / questionCount) * 100) : 0);

    return (
        <div className="card p-5 hover:shadow-card-hover transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary truncate">
                        {project.name}
                    </h3>
                    {project.client_name && (
                        <p className="text-sm text-text-secondary truncate">
                            {project.client_name}
                        </p>
                    )}
                </div>
                <span className={clsx(
                    'badge text-xs',
                    project.status === 'completed' ? 'badge-success' :
                        project.status === 'review' ? 'badge-warning' :
                            project.status === 'in_progress' ? 'badge-primary' :
                                'badge-neutral'
                )}>
                    {project.status.replace('_', ' ')}
                </span>
            </div>

            {/* Progress Ring + Stats */}
            <div className="flex items-center gap-4">
                <ProgressRing
                    percentage={completionPercent}
                    size={70}
                    strokeWidth={6}
                    label="Complete"
                />

                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <ChatBubbleLeftRightIcon className="h-4 w-4 text-text-muted" />
                        <span className="text-text-secondary">
                            {questionCount} questions
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <DocumentTextIcon className="h-4 w-4 text-blue-500" />
                        <span className="text-text-secondary">
                            {answeredCount} answered
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        <span className="text-text-secondary">
                            {approvedCount} approved
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <Link
                    to={`/projects/${project.id}`}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                    View Details
                </Link>
                <Link
                    to={`/projects/${project.id}/proposal`}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                    Open Builder
                    <ArrowRightIcon className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}
