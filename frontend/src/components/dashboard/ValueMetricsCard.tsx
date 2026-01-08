import React from 'react';
import {
    ClockIcon,
    SparklesIcon,
    DocumentCheckIcon,
    CurrencyDollarIcon,
    ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

interface TimeSavingsData {
    total_minutes: number;
    total_hours: number;
    human_readable: string;
    projects_helped?: number;
    equivalent_value?: string;
    by_action?: Record<string, number>;
}

interface ValueMetricsCardProps {
    savings?: TimeSavingsData;
    period?: string;
    loading?: boolean;
    compact?: boolean;
}

export const ValueMetricsCard: React.FC<ValueMetricsCardProps> = ({
    savings,
    period = 'This Month',
    loading = false,
    compact = false,
}) => {
    if (loading) {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-green-200 rounded w-1/2 mb-2" />
                <div className="h-8 bg-green-200 rounded w-3/4" />
            </div>
        );
    }

    const hours = savings?.total_hours || 0;
    const dollarValue = savings?.equivalent_value || '$0';
    const projects = savings?.projects_helped || 0;

    if (compact) {
        return (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                <ClockIcon className="h-5 w-5 text-green-600" />
                <div className="text-sm">
                    <span className="font-semibold text-green-700">{hours}h saved</span>
                    <span className="text-green-600 ml-1">({dollarValue})</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border border-green-200 rounded-xl p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <SparklesIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-800">Your Impact</span>
                </div>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    {period}
                </span>
            </div>

            {/* Main Metric */}
            <div className="mb-4">
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-green-700">{hours}</span>
                    <span className="text-lg text-green-600">hours saved</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                    You saved <span className="font-semibold">{savings?.human_readable || '0 minutes'}</span> with AI assistance
                </p>
            </div>

            {/* Value Breakdown */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-green-200">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-700">
                        <CurrencyDollarIcon className="h-4 w-4" />
                        <span className="font-semibold">{dollarValue}</span>
                    </div>
                    <span className="text-xs text-green-600">Value Created</span>
                </div>

                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-700">
                        <DocumentCheckIcon className="h-4 w-4" />
                        <span className="font-semibold">{projects}</span>
                    </div>
                    <span className="text-xs text-green-600">Projects</span>
                </div>

                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-700">
                        <ArrowTrendingUpIcon className="h-4 w-4" />
                        <span className="font-semibold">+{Math.round(hours * 12)}%</span>
                    </div>
                    <span className="text-xs text-green-600">Efficiency</span>
                </div>
            </div>
        </div>
    );
};

// Empty state when no savings yet
export const ValueMetricsEmpty: React.FC = () => {
    return (
        <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-5 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3">
                <ClockIcon className="h-6 w-6 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Start Tracking Your Impact</h4>
            <p className="text-xs text-gray-500">
                As you use AI features, we'll track how much time you save
            </p>
        </div>
    );
};

// Banner for showing savings inline (e.g., after generating answers)
export const TimeSavedBanner: React.FC<{ minutes: number; action: string }> = ({
    minutes,
    action
}) => {
    return (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
            <SparklesIcon className="h-4 w-4 text-green-600" />
            <span className="text-green-700">
                <span className="font-medium">~{minutes} minutes saved</span> on {action}
            </span>
        </div>
    );
};

export default ValueMetricsCard;
