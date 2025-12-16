import React, { useState } from 'react';
import clsx from 'clsx';
import {
    ExclamationTriangleIcon,
    ArrowPathIcon,
    XMarkIcon,
    LightBulbIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

type ErrorType = 'network' | 'timeout' | 'api' | 'model' | 'unknown';

interface AIErrorHandlerProps {
    /** The error that occurred */
    error: Error | string | null;
    /** Type of error for appropriate messaging */
    errorType?: ErrorType;
    /** Operation that failed */
    operation?: string;
    /** Callback to retry the operation */
    onRetry?: () => void;
    /** Callback to dismiss the error */
    onDismiss?: () => void;
    /** Whether retry is in progress */
    isRetrying?: boolean;
    /** Additional className */
    className?: string;
}

const getErrorConfig = (type: ErrorType) => {
    switch (type) {
        case 'network':
            return {
                title: 'Connection Error',
                message: 'Unable to reach the AI service. Please check your internet connection.',
                suggestions: [
                    'Check your internet connection',
                    'Try again in a few seconds',
                    'Contact support if the issue persists',
                ],
                canRetry: true,
            };
        case 'timeout':
            return {
                title: 'Request Timeout',
                message: 'The AI operation took too long to complete.',
                suggestions: [
                    'Try with a shorter document or question',
                    'The AI service may be experiencing high load',
                    'Try again in a few minutes',
                ],
                canRetry: true,
            };
        case 'api':
            return {
                title: 'Service Error',
                message: 'The AI service returned an error.',
                suggestions: [
                    'The request may be too complex',
                    'Try simplifying your input',
                    'Contact support if this continues',
                ],
                canRetry: true,
            };
        case 'model':
            return {
                title: 'AI Model Error',
                message: 'The AI model encountered an issue processing your request.',
                suggestions: [
                    'The content may contain unsupported formats',
                    'Try rephrasing your question',
                    'Provide more specific context',
                ],
                canRetry: true,
            };
        default:
            return {
                title: 'Something Went Wrong',
                message: 'An unexpected error occurred.',
                suggestions: [
                    'Try the operation again',
                    'Refresh the page if issues persist',
                    'Contact support for help',
                ],
                canRetry: true,
            };
    }
};

/**
 * AI Error Handler - User-friendly error display with recovery options
 */
export const AIErrorHandler: React.FC<AIErrorHandlerProps> = ({
    error,
    errorType = 'unknown',
    operation = 'AI operation',
    onRetry,
    onDismiss,
    isRetrying = false,
    className = '',
}) => {
    const [showDetails, setShowDetails] = useState(false);
    const config = getErrorConfig(errorType);
    const errorMessage = typeof error === 'string' ? error : error?.message;

    if (!error) return null;

    return (
        <div className={clsx(
            'rounded-xl border border-red-200 bg-red-50 p-5',
            className
        )}>
            {/* Header */}
            <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-red-900">
                                {config.title}
                            </h3>
                            <p className="text-sm text-red-700 mt-1">
                                {config.message}
                            </p>
                            <p className="text-xs text-red-600 mt-2">
                                Failed during: <span className="font-medium">{operation}</span>
                            </p>
                        </div>
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                            >
                                <XMarkIcon className="h-5 w-5 text-red-600" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Suggestions */}
            <div className="mt-4 p-3 rounded-lg bg-white/50 border border-red-100">
                <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-2">
                    <LightBulbIcon className="h-4 w-4" />
                    Suggestions
                </div>
                <ul className="space-y-1">
                    {config.suggestions.map((suggestion, i) => (
                        <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                            <span className="text-red-400 mt-1">•</span>
                            {suggestion}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Technical details (collapsible) */}
            {errorMessage && (
                <div className="mt-3">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                    >
                        {showDetails ? 'Hide' : 'Show'} technical details
                    </button>
                    {showDetails && (
                        <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800 overflow-auto max-h-24">
                            {errorMessage}
                        </pre>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3">
                {config.canRetry && onRetry && (
                    <button
                        onClick={onRetry}
                        disabled={isRetrying}
                        className="btn-primary flex items-center gap-2"
                    >
                        {isRetrying ? (
                            <>
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                Retrying...
                            </>
                        ) : (
                            <>
                                <ArrowPathIcon className="h-4 w-4" />
                                Try Again
                            </>
                        )}
                    </button>
                )}
                <button
                    className="btn-secondary flex items-center gap-2"
                    onClick={() => window.open('mailto:support@example.com', '_blank')}
                >
                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    Contact Support
                </button>
            </div>
        </div>
    );
};

/**
 * Inline error banner for less intrusive errors
 */
export const AIErrorBanner: React.FC<{
    message: string;
    onDismiss?: () => void;
    onRetry?: () => void;
    className?: string;
}> = ({ message, onDismiss, onRetry, className = '' }) => {
    return (
        <div className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200',
            className
        )}>
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="flex-1 text-sm text-red-700">{message}</p>
            <div className="flex items-center gap-2">
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                        Retry
                    </button>
                )}
                {onDismiss && (
                    <button onClick={onDismiss} className="p-1 hover:bg-red-100 rounded">
                        <XMarkIcon className="h-4 w-4 text-red-600" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default AIErrorHandler;
