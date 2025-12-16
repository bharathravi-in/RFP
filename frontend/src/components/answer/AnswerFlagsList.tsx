import React from 'react';
import {
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    InformationCircleIcon,
    ShieldCheckIcon,
    DocumentTextIcon,
    EyeIcon
} from '@heroicons/react/24/outline';

interface AnswerFlagsListProps {
    flags: string[];
    showDescriptions?: boolean;
    compact?: boolean;
    className?: string;
}

interface FlagConfig {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    message: string;
    shortMessage: string;
}

const FLAG_CONFIG: Record<string, FlagConfig> = {
    low_confidence: {
        icon: ExclamationTriangleIcon,
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        message: 'Low confidence - human review recommended',
        shortMessage: 'Low Confidence'
    },
    missing_context: {
        icon: ExclamationCircleIcon,
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        message: 'Missing knowledge base context - answer may need verification',
        shortMessage: 'Missing Context'
    },
    sensitive: {
        icon: ShieldCheckIcon,
        color: 'text-orange-700',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        message: 'Contains sensitive information - legal review required',
        shortMessage: 'Sensitive'
    },
    legal_review: {
        icon: DocumentTextIcon,
        color: 'text-purple-700',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        message: 'Legal team review recommended before submission',
        shortMessage: 'Legal Review'
    },
    needs_review: {
        icon: EyeIcon,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        message: 'Manual review recommended before approval',
        shortMessage: 'Needs Review'
    },
    review_recommended: {
        icon: InformationCircleIcon,
        color: 'text-gray-700',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        message: 'Review recommended for quality assurance',
        shortMessage: 'Review Recommended'
    },
    conflicting_sources: {
        icon: ExclamationCircleIcon,
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        message: 'Found conflicting information in knowledge base sources',
        shortMessage: 'Conflicting Sources'
    },
    ai_service_unavailable: {
        icon: ExclamationTriangleIcon,
        color: 'text-gray-700',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        message: 'AI service unavailable - placeholder response generated',
        shortMessage: 'AI Unavailable'
    },
    generation_error: {
        icon: ExclamationCircleIcon,
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        message: 'Error occurred during answer generation',
        shortMessage: 'Generation Error'
    },
};

/**
 * Component to display answer flags as a list of alerts.
 */
export const AnswerFlagsList: React.FC<AnswerFlagsListProps> = ({
    flags,
    showDescriptions = true,
    compact = false,
    className = ''
}) => {
    if (!flags || flags.length === 0) return null;

    // Deduplicate flags
    const uniqueFlags = [...new Set(flags)];

    if (compact) {
        return (
            <div className={`flex flex-wrap gap-1.5 ${className}`}>
                {uniqueFlags.map((flag) => {
                    const config = FLAG_CONFIG[flag] || {
                        icon: InformationCircleIcon,
                        color: 'text-gray-600',
                        bgColor: 'bg-gray-50',
                        borderColor: 'border-gray-200',
                        shortMessage: flag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        message: flag
                    };
                    const Icon = config.icon;

                    return (
                        <span
                            key={flag}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}
                            title={config.message}
                        >
                            <Icon className="w-3 h-3" />
                            {config.shortMessage}
                        </span>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {uniqueFlags.map((flag) => {
                const config = FLAG_CONFIG[flag] || {
                    icon: InformationCircleIcon,
                    color: 'text-gray-600',
                    bgColor: 'bg-gray-50',
                    borderColor: 'border-gray-200',
                    message: flag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    shortMessage: flag
                };
                const Icon = config.icon;

                return (
                    <div
                        key={flag}
                        className={`flex items-start gap-2 p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                    >
                        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${config.color}`}>
                                {config.shortMessage}
                            </p>
                            {showDescriptions && (
                                <p className="text-xs text-gray-600 mt-0.5">
                                    {config.message}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * Compact inline flag display for use in lists.
 */
export const AnswerFlagsInline: React.FC<{ flags: string[], className?: string }> = ({
    flags,
    className = ''
}) => {
    return <AnswerFlagsList flags={flags} compact className={className} />;
};

export default AnswerFlagsList;
