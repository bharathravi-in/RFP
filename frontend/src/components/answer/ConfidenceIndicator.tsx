import React from 'react';

interface ConfidenceIndicatorProps {
    score: number;
    showLabel?: boolean;
    showPercentage?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * Visual indicator for answer confidence scores.
 * Shows a progress bar with color coding based on confidence level.
 */
export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
    score,
    showLabel = true,
    showPercentage = true,
    size = 'md',
    className = ''
}) => {
    const percentage = Math.round(score * 100);

    const getColor = (): string => {
        if (score >= 0.8) return 'bg-green-500';
        if (score >= 0.6) return 'bg-yellow-500';
        if (score >= 0.4) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getLabel = (): string => {
        if (score >= 0.8) return 'High';
        if (score >= 0.6) return 'Medium';
        if (score >= 0.4) return 'Low';
        return 'Very Low';
    };

    const getLabelColor = (): string => {
        if (score >= 0.8) return 'text-green-700';
        if (score >= 0.6) return 'text-yellow-700';
        if (score >= 0.4) return 'text-orange-700';
        return 'text-red-700';
    };

    const sizeClasses = {
        sm: { bar: 'h-1.5 w-16', text: 'text-xs' },
        md: { bar: 'h-2 w-24', text: 'text-sm' },
        lg: { bar: 'h-3 w-32', text: 'text-base' }
    };

    const sizes = sizeClasses[size];

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`${sizes.bar} bg-gray-200 rounded-full overflow-hidden`}>
                <div
                    className={`h-full ${getColor()} rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className={`flex items-center gap-1 ${sizes.text}`}>
                {showPercentage && (
                    <span className="text-gray-600 font-medium">{percentage}%</span>
                )}
                {showLabel && (
                    <span className={`${getLabelColor()} font-medium`}>
                        ({getLabel()})
                    </span>
                )}
            </div>
        </div>
    );
};

export default ConfidenceIndicator;
