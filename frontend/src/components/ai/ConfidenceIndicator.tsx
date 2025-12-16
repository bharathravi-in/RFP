import React from 'react';
import clsx from 'clsx';
import {
    SparklesIcon,
    ExclamationTriangleIcon,
    CheckBadgeIcon,
    InformationCircleIcon,
    ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

interface ConfidenceIndicatorProps {
    /** Confidence score from 0 to 1 */
    score: number;
    /** Optional label to display */
    label?: string;
    /** Show detailed explanation on hover */
    showExplanation?: boolean;
    /** Custom explanation text */
    explanation?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Additional className */
    className?: string;
}

const getConfidenceLevel = (score: number): ConfidenceLevel => {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    if (score > 0) return 'low';
    return 'unknown';
};

const getConfidenceConfig = (level: ConfidenceLevel) => {
    switch (level) {
        case 'high':
            return {
                label: 'High Confidence',
                icon: CheckBadgeIcon,
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                borderColor: 'border-green-200',
                barColor: 'bg-green-500',
                explanation: 'This answer was generated with strong knowledge base support and clear context.',
            };
        case 'medium':
            return {
                label: 'Medium Confidence',
                icon: InformationCircleIcon,
                color: 'text-amber-600',
                bgColor: 'bg-amber-50',
                borderColor: 'border-amber-200',
                barColor: 'bg-amber-500',
                explanation: 'This answer may need review. Some context was available but verification is recommended.',
            };
        case 'low':
            return {
                label: 'Low Confidence',
                icon: ExclamationTriangleIcon,
                color: 'text-red-600',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                barColor: 'bg-red-500',
                explanation: 'Human review strongly recommended. Limited knowledge base support available.',
            };
        default:
            return {
                label: 'Unknown',
                icon: ShieldExclamationIcon,
                color: 'text-gray-500',
                bgColor: 'bg-gray-50',
                borderColor: 'border-gray-200',
                barColor: 'bg-gray-400',
                explanation: 'Confidence could not be determined. Manual review required.',
            };
    }
};

/**
 * Confidence Indicator - Shows the AI's confidence level in generated content
 */
export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
    score,
    label,
    showExplanation = false,
    explanation,
    size = 'md',
    className = '',
}) => {
    const level = getConfidenceLevel(score);
    const config = getConfidenceConfig(level);
    const Icon = config.icon;
    const displayLabel = label || config.label;
    const displayExplanation = explanation || config.explanation;

    const sizeClasses = {
        sm: { wrapper: 'text-xs', icon: 'h-3.5 w-3.5', bar: 'h-1' },
        md: { wrapper: 'text-sm', icon: 'h-4 w-4', bar: 'h-1.5' },
        lg: { wrapper: 'text-base', icon: 'h-5 w-5', bar: 'h-2' },
    };
    const sizes = sizeClasses[size];

    return (
        <div className={clsx('group relative', className)}>
            <div className={clsx(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border',
                config.bgColor,
                config.borderColor,
                sizes.wrapper
            )}>
                <Icon className={clsx(sizes.icon, config.color)} />
                <span className={clsx('font-medium', config.color)}>
                    {displayLabel}
                </span>
                <span className="text-gray-400">
                    ({Math.round(score * 100)}%)
                </span>
            </div>

            {/* Mini progress bar */}
            <div className={clsx('mt-1 w-full rounded-full bg-gray-200 overflow-hidden', sizes.bar)}>
                <div
                    className={clsx('h-full rounded-full transition-all', config.barColor)}
                    style={{ width: `${Math.round(score * 100)}%` }}
                />
            </div>

            {/* Tooltip explanation on hover */}
            {showExplanation && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                    <div className="bg-gray-900 text-white text-xs rounded-lg p-3 max-w-xs shadow-lg">
                        <div className="flex items-start gap-2">
                            <SparklesIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium mb-1">{displayLabel}</p>
                                <p className="text-gray-300">{displayExplanation}</p>
                            </div>
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full left-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900" />
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Compact confidence badge for inline use
 */
export const ConfidenceBadge: React.FC<{
    score: number;
    className?: string;
}> = ({ score, className = '' }) => {
    const level = getConfidenceLevel(score);
    const config = getConfidenceConfig(level);
    const Icon = config.icon;

    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
                config.bgColor,
                config.color,
                className
            )}
            title={`${config.label}: ${Math.round(score * 100)}%`}
        >
            <Icon className="h-3 w-3" />
            {Math.round(score * 100)}%
        </span>
    );
};

/**
 * Detailed confidence card with source information
 */
export const ConfidenceCard: React.FC<{
    score: number;
    sources?: { title: string; relevance: number }[];
    className?: string;
}> = ({ score, sources = [], className = '' }) => {
    const level = getConfidenceLevel(score);
    const config = getConfidenceConfig(level);
    const Icon = config.icon;

    return (
        <div className={clsx(
            'rounded-lg border p-4',
            config.bgColor,
            config.borderColor,
            className
        )}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className={clsx(
                    'h-10 w-10 rounded-full flex items-center justify-center',
                    level === 'high' ? 'bg-green-100' :
                        level === 'medium' ? 'bg-amber-100' :
                            level === 'low' ? 'bg-red-100' : 'bg-gray-100'
                )}>
                    <Icon className={clsx('h-5 w-5', config.color)} />
                </div>
                <div>
                    <p className={clsx('font-semibold', config.color)}>{config.label}</p>
                    <p className="text-sm text-gray-600">{Math.round(score * 100)}% confidence</p>
                </div>
            </div>

            {/* Explanation */}
            <p className="text-sm text-gray-700 mb-3">{config.explanation}</p>

            {/* Sources */}
            {sources.length > 0 && (
                <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Knowledge Sources Used:</p>
                    <div className="space-y-1">
                        {sources.map((source, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 truncate">{source.title}</span>
                                <span className="text-gray-500">{Math.round(source.relevance * 100)}% match</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfidenceIndicator;
