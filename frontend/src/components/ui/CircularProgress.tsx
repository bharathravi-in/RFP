import React from 'react';
import clsx from 'clsx';

interface CircularProgressProps {
    /** Progress percentage (0-100) */
    percentage: number;
    /** Size of the circle in pixels */
    size?: number;
    /** Stroke width */
    strokeWidth?: number;
    /** Optional className */
    className?: string;
    /** Show percentage text */
    showText?: boolean;
}

/**
 * Circular Progress Indicator with gradient stroke
 * Displays animated progress with percentage text in center
 */
export const CircularProgress: React.FC<CircularProgressProps> = ({
    percentage,
    size = 120,
    strokeWidth = 8,
    className = '',
    showText = true,
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className={clsx('relative inline-flex items-center justify-center', className)}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Gradient Definition */}
                <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#A855F7" />
                        <stop offset="50%" stopColor="#C084FC" />
                        <stop offset="100%" stopColor="#E879F9" />
                    </linearGradient>
                </defs>

                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-gray-200"
                />

                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500 ease-out"
                />
            </svg>

            {/* Percentage text */}
            {showText && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-semibold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                        {Math.round(percentage)}%
                    </span>
                </div>
            )}
        </div>
    );
};

export default CircularProgress;
