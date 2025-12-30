import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface TruthScoreBadgeProps {
    score: number | null | undefined;
    size?: 'sm' | 'md';
    showLabel?: boolean;
}

/**
 * Displays AI verification/truth score for an answer.
 * Color coding: green (>0.8), yellow (0.5-0.8), red (<0.5)
 */
export default function TruthScoreBadge({
    score,
    size = 'md',
    showLabel = true
}: TruthScoreBadgeProps) {
    // Handle missing score
    if (score === null || score === undefined) {
        return null;
    }

    const percentage = Math.round(score * 100);

    // Determine color based on score
    const getColorClasses = () => {
        if (score >= 0.8) return 'bg-success/15 text-success border-success/30';
        if (score >= 0.5) return 'bg-warning/15 text-warning border-warning/30';
        return 'bg-error/15 text-error border-error/30';
    };

    const getIconColor = () => {
        if (score >= 0.8) return 'text-success';
        if (score >= 0.5) return 'text-warning';
        return 'text-error';
    };

    const getTooltipText = () => {
        if (score >= 0.8) return 'High confidence - AI verified this answer as accurate';
        if (score >= 0.5) return 'Medium confidence - Some claims may need review';
        return 'Low confidence - Manual verification recommended';
    };

    const sizeClasses = size === 'sm'
        ? 'text-[10px] px-1.5 py-0.5 gap-1'
        : 'text-xs px-2 py-1 gap-1.5';

    const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

    return (
        <div
            className={clsx(
                'inline-flex items-center rounded-full border font-medium',
                getColorClasses(),
                sizeClasses
            )}
            title={getTooltipText()}
        >
            <ShieldCheckIcon className={clsx(iconSize, getIconColor())} />
            <span>{percentage}%</span>
            {showLabel && size === 'md' && (
                <span className="opacity-75">verified</span>
            )}
        </div>
    );
}
