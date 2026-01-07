import { toast, ToastOptions } from 'react-hot-toast';
import { ExclamationTriangleIcon, ArrowPathIcon, XCircleIcon } from '@heroicons/react/24/outline';
import React from 'react';

/**
 * Actionable Toast Messages
 * 
 * Provides user-friendly error messages with clear guidance on how to resolve issues.
 * Use these instead of generic toast.error('Failed') messages.
 */

interface ActionableToastOptions extends ToastOptions {
    /** Action button label */
    actionLabel?: string;
    /** Action button callback */
    onAction?: () => void;
    /** Retry callback */
    onRetry?: () => void;
}

/**
 * Shows an actionable error toast with guidance
 */
export function toastError(
    title: string,
    guidance?: string,
    options?: ActionableToastOptions
) {
    toast.custom(
        (t) => (
            <div
                className={`${t.visible ? 'animate-enter' : 'animate-leave'
                    } max-w-md w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
            >
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircleIcon className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                        <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900">{title}</p>
                            {guidance && (
                                <p className="mt-1 text-sm text-gray-500">{guidance}</p>
                            )}
                            {options?.onRetry && (
                                <button
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        options.onRetry?.();
                                    }}
                                    className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:text-primary-dark font-medium"
                                >
                                    <ArrowPathIcon className="h-4 w-4" />
                                    Try Again
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex border-l border-gray-200">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
                    >
                        Close
                    </button>
                </div>
            </div>
        ),
        { duration: 6000, ...options }
    );
}

/**
 * Shows a warning toast with guidance
 */
export function toastWarning(title: string, guidance?: string) {
    toast.custom(
        (t) => (
            <div
                className={`${t.visible ? 'animate-enter' : 'animate-leave'
                    } max-w-md w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
            >
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                            </div>
                        </div>
                        <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900">{title}</p>
                            {guidance && (
                                <p className="mt-1 text-sm text-gray-500">{guidance}</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex border-l border-gray-200">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
                    >
                        Close
                    </button>
                </div>
            </div>
        ),
        { duration: 5000 }
    );
}

// ===========================================
// Common Error Message Helpers
// ===========================================

export const ErrorMessages = {
    // Network errors
    networkError: () => toastError(
        'Connection failed',
        'Please check your internet connection and try again.'
    ),

    // Auth errors
    sessionExpired: () => toastError(
        'Session expired',
        'Please log in again to continue.',
    ),

    unauthorized: () => toastError(
        'Access denied',
        'You don\'t have permission to perform this action. Contact your admin if you think this is a mistake.'
    ),

    // API errors
    serverError: (onRetry?: () => void) => toastError(
        'Something went wrong',
        'Our servers encountered an issue. Please try again in a moment.',
        { onRetry }
    ),

    // Feature-specific errors
    documentUploadFailed: (onRetry?: () => void) => toastError(
        'Upload failed',
        'The file couldn\'t be uploaded. Check the file format (PDF, DOCX, XLSX) and try again.',
        { onRetry }
    ),

    exportFailed: (format: string, onRetry?: () => void) => toastError(
        `${format.toUpperCase()} export failed`,
        'Unable to generate the document. Try again or export in a different format.',
        { onRetry }
    ),

    aiGenerationFailed: (onRetry?: () => void) => toastError(
        'AI generation failed',
        'The AI couldn\'t complete the request. This may be due to high demand. Please try again.',
        { onRetry }
    ),

    saveFailed: (entity: string, onRetry?: () => void) => toastError(
        `Couldn't save ${entity}`,
        'Your changes weren\'t saved. Please try again.',
        { onRetry }
    ),

    deleteFailed: (entity: string) => toastError(
        `Couldn't delete ${entity}`,
        'The item is still available. Please try again or refresh the page.'
    ),

    loadFailed: (entity: string, onRetry?: () => void) => toastError(
        `Couldn't load ${entity}`,
        'Please refresh the page or try again later.',
        { onRetry }
    ),

    // Validation errors
    validationError: (field: string) => toastWarning(
        'Missing information',
        `Please fill in the ${field} field to continue.`
    ),

    fileTooLarge: (maxSize: string) => toastWarning(
        'File too large',
        `Please upload a file smaller than ${maxSize}.`
    ),

    unsupportedFormat: (validFormats: string[]) => toastWarning(
        'Unsupported file format',
        `Please use one of these formats: ${validFormats.join(', ')}`
    ),
};

export default ErrorMessages;
