import { SparklesIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface ConfidenceMeterProps {
    score: number; // 0-1
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export default function ConfidenceMeter({
    score,
    size = 'md',
    showLabel = true,
}: ConfidenceMeterProps) {
    const percentage = Math.round(score * 100);

    // Determine color based on confidence level
    const getColor = () => {
        if (percentage >= 80) return 'success';
        if (percentage >= 60) return 'warning';
        return 'error';
    };

    const color = getColor();

    const colorClasses = {
        success: {
            bg: 'bg-success',
            text: 'text-success',
            light: 'bg-success-light',
        },
        warning: {
            bg: 'bg-warning',
            text: 'text-warning',
            light: 'bg-warning-light',
        },
        error: {
            bg: 'bg-error',
            text: 'text-error',
            light: 'bg-error-light',
        },
    };

    const sizeClasses = {
        sm: {
            bar: 'h-1 w-12',
            text: 'text-xs',
            icon: 'h-3 w-3',
        },
        md: {
            bar: 'h-1.5 w-20',
            text: 'text-sm',
            icon: 'h-4 w-4',
        },
        lg: {
            bar: 'h-2 w-28',
            text: 'text-base',
            icon: 'h-5 w-5',
        },
    };

    return (
        <div className="flex items-center gap-2">
            {showLabel && (
                <div className={clsx('flex items-center gap-1', colorClasses[color].text)}>
                    <SparklesIcon className={sizeClasses[size].icon} />
                    <span className={clsx('font-medium', sizeClasses[size].text)}>
                        {percentage}%
                    </span>
                </div>
            )}
            <div className={clsx('bg-gray-200 rounded-full overflow-hidden', sizeClasses[size].bar)}>
                <div
                    className={clsx('h-full rounded-full transition-all duration-500', colorClasses[color].bg)}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {!showLabel && (
                <span className={clsx('font-medium', sizeClasses[size].text, colorClasses[color].text)}>
                    {percentage}%
                </span>
            )}
        </div>
    );
}

// Badge variant for inline use
export function ConfidenceBadge({ score }: { score: number }) {
    const percentage = Math.round(score * 100);

    const getBadgeClass = () => {
        if (percentage >= 80) return 'bg-success-light text-success';
        if (percentage >= 60) return 'bg-warning-light text-warning';
        return 'bg-error-light text-error';
    };

    return (
        <span className={clsx(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            getBadgeClass()
        )}>
            <SparklesIcon className="h-3 w-3" />
            {percentage}% confident
        </span>
    );
}
