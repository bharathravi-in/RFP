import {
    CheckCircleIcon,
    ClockIcon,
    ExclamationCircleIcon,
    PencilSquareIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

type ReviewStatus = 'pending' | 'draft' | 'answered' | 'in_review' | 'approved' | 'rejected';

interface ReviewStatusBadgeProps {
    status: ReviewStatus;
    size?: 'sm' | 'md';
}

const statusConfig: Record<ReviewStatus, {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ComponentType<{ className?: string }>;
}> = {
    pending: {
        label: 'Pending',
        color: 'text-text-muted',
        bgColor: 'bg-gray-100',
        icon: ClockIcon,
    },
    draft: {
        label: 'Draft',
        color: 'text-text-secondary',
        bgColor: 'bg-gray-100',
        icon: PencilSquareIcon,
    },
    answered: {
        label: 'AI Generated',
        color: 'text-primary',
        bgColor: 'bg-primary-light',
        icon: SparklesIcon,
    },
    in_review: {
        label: 'In Review',
        color: 'text-warning',
        bgColor: 'bg-warning-light',
        icon: ClockIcon,
    },
    approved: {
        label: 'Approved',
        color: 'text-success',
        bgColor: 'bg-success-light',
        icon: CheckCircleIcon,
    },
    rejected: {
        label: 'Needs Changes',
        color: 'text-error',
        bgColor: 'bg-error-light',
        icon: ExclamationCircleIcon,
    },
};

export default function ReviewStatusBadge({ status, size = 'md' }: ReviewStatusBadgeProps) {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1 rounded-full font-medium',
                config.color,
                config.bgColor,
                size === 'sm' && 'px-2 py-0.5 text-xs',
                size === 'md' && 'px-2.5 py-1 text-sm'
            )}
        >
            <Icon className={clsx(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
            {config.label}
        </span>
    );
}

// Progress Badge for overall project status
export function ProjectStatusBadge({
    answeredCount,
    approvedCount,
    totalCount
}: {
    answeredCount: number;
    approvedCount: number;
    totalCount: number;
}) {
    const percentage = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

    let color = 'text-error bg-error-light';
    if (percentage >= 80) color = 'text-success bg-success-light';
    else if (percentage >= 50) color = 'text-warning bg-warning-light';
    else if (percentage >= 25) color = 'text-primary bg-primary-light';

    return (
        <div className="flex items-center gap-3">
            <span className={clsx('px-2.5 py-1 rounded-full text-sm font-medium', color)}>
                {percentage}% Complete
            </span>
            <span className="text-sm text-text-muted">
                {approvedCount}/{totalCount} approved
            </span>
        </div>
    );
}
