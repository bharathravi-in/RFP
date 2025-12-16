import React from 'react';
import clsx from 'clsx';
import { ArrowPathIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

type ProgressStep = {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    description?: string;
};

interface AIProgressIndicatorProps {
    /** Title of the operation being performed */
    title: string;
    /** Subtitle or description */
    subtitle?: string;
    /** Current step index (0-based) */
    currentStep: number;
    /** List of steps in the process */
    steps: ProgressStep[];
    /** Whether the operation has completed */
    isComplete?: boolean;
    /** Whether an error occurred */
    hasError?: boolean;
    /** Error message if hasError is true */
    errorMessage?: string;
    /** Optional className */
    className?: string;
}

/**
 * AI Progress Indicator - Shows step-by-step progress for AI operations
 * Used for document analysis, answer generation, and other AI tasks
 */
export const AIProgressIndicator: React.FC<AIProgressIndicatorProps> = ({
    title,
    subtitle,
    currentStep,
    steps,
    isComplete = false,
    hasError = false,
    errorMessage,
    className = '',
}) => {
    return (
        <div className={clsx('rounded-xl border border-border bg-surface p-6', className)}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className={clsx(
                    'h-12 w-12 rounded-xl flex items-center justify-center',
                    hasError ? 'bg-red-100' : isComplete ? 'bg-green-100' : 'bg-primary-light'
                )}>
                    {hasError ? (
                        <span className="text-red-600 text-xl">⚠️</span>
                    ) : isComplete ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    ) : (
                        <SparklesIcon className="h-6 w-6 text-primary animate-pulse" />
                    )}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
                    {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
                </div>
            </div>

            {/* Error Message */}
            {hasError && errorMessage && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
            )}

            {/* Steps */}
            <div className="space-y-3">
                {steps.map((step, index) => {
                    const isActive = index === currentStep && !isComplete && !hasError;
                    const isPast = index < currentStep || isComplete;
                    const isFuture = index > currentStep;

                    return (
                        <div
                            key={step.id}
                            className={clsx(
                                'flex items-center gap-3 p-3 rounded-lg transition-all',
                                isActive && 'bg-primary-light border border-primary',
                                isPast && 'bg-green-50',
                                isFuture && 'bg-gray-50 opacity-60'
                            )}
                        >
                            {/* Step indicator */}
                            <div className={clsx(
                                'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                                isActive && 'bg-primary text-white',
                                isPast && 'bg-green-500 text-white',
                                isFuture && 'bg-gray-200 text-gray-500',
                                step.status === 'error' && 'bg-red-500 text-white'
                            )}>
                                {isActive ? (
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                ) : isPast ? (
                                    <CheckCircleIcon className="h-4 w-4" />
                                ) : (
                                    <span className="text-xs font-medium">{index + 1}</span>
                                )}
                            </div>

                            {/* Step content */}
                            <div className="flex-1 min-w-0">
                                <p className={clsx(
                                    'text-sm font-medium',
                                    isActive && 'text-primary',
                                    isPast && 'text-green-700',
                                    isFuture && 'text-gray-500'
                                )}>
                                    {step.label}
                                </p>
                                {step.description && isActive && (
                                    <p className="text-xs text-text-muted mt-0.5">
                                        {step.description}
                                    </p>
                                )}
                            </div>

                            {/* Status text */}
                            <span className={clsx(
                                'text-xs font-medium px-2 py-1 rounded-full',
                                isActive && 'bg-primary/10 text-primary',
                                isPast && 'bg-green-100 text-green-700',
                                isFuture && 'text-gray-400'
                            )}>
                                {isActive ? 'In Progress' : isPast ? 'Complete' : 'Pending'}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Overall progress bar */}
            <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-text-muted mb-2">
                    <span>Progress</span>
                    <span>{Math.round((currentStep / steps.length) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={clsx(
                            'h-full transition-all duration-500 rounded-full',
                            hasError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-primary'
                        )}
                        style={{ width: `${isComplete ? 100 : (currentStep / steps.length) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

// Preset step configurations for common AI operations
export const DOCUMENT_ANALYSIS_STEPS: ProgressStep[] = [
    { id: 'parsing', label: 'Parsing Document', status: 'pending', description: 'Extracting text content...' },
    { id: 'structure', label: 'Analyzing Structure', status: 'pending', description: 'Identifying sections and format...' },
    { id: 'questions', label: 'Extracting Questions', status: 'pending', description: 'Finding questions and requirements...' },
    { id: 'themes', label: 'Identifying Themes', status: 'pending', description: 'Detecting key topics and themes...' },
    { id: 'complete', label: 'Analysis Complete', status: 'pending' },
];

export const ANSWER_GENERATION_STEPS: ProgressStep[] = [
    { id: 'context', label: 'Gathering Context', status: 'pending', description: 'Searching knowledge base...' },
    { id: 'generating', label: 'Generating Response', status: 'pending', description: 'AI is composing answer...' },
    { id: 'validation', label: 'Validating Answer', status: 'pending', description: 'Checking accuracy and quality...' },
    { id: 'complete', label: 'Generation Complete', status: 'pending' },
];

export const PROPOSAL_BUILD_STEPS: ProgressStep[] = [
    { id: 'setup', label: 'Setting Up Sections', status: 'pending', description: 'Creating section structure...' },
    { id: 'content', label: 'Generating Content', status: 'pending', description: 'AI is writing each section...' },
    { id: 'formatting', label: 'Formatting', status: 'pending', description: 'Applying styles and layout...' },
    { id: 'complete', label: 'Proposal Ready', status: 'pending' },
];

export default AIProgressIndicator;
