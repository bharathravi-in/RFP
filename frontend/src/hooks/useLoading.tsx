import { useState, useCallback } from 'react';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface UseLoadingReturn<T> {
    /** Execute the async function */
    execute: (...args: any[]) => Promise<T | undefined>;
    /** Current loading state */
    state: LoadingState;
    /** Loading indicator */
    isLoading: boolean;
    /** Success indicator */
    isSuccess: boolean;
    /** Error indicator */
    isError: boolean;
    /** Error object if any */
    error: Error | null;
    /** Result data */
    data: T | null;
    /** Reset to idle state */
    reset: () => void;
}

/**
 * Custom hook for managing async operation loading states.
 * 
 * @example
 * ```tsx
 * const { execute, isLoading, error, data } = useLoading(
 *   (id) => api.projects.get(id)
 * );
 * 
 * // In component
 * useEffect(() => { execute(projectId); }, [projectId]);
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * return <ProjectView project={data} />;
 * ```
 */
export function useLoading<T>(
    asyncFn: (...args: any[]) => Promise<T>
): UseLoadingReturn<T> {
    const [state, setState] = useState<LoadingState>('idle');
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<T | null>(null);

    const execute = useCallback(
        async (...args: any[]): Promise<T | undefined> => {
            try {
                setState('loading');
                setError(null);

                const result = await asyncFn(...args);

                setData(result);
                setState('success');
                return result;
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                setError(error);
                setState('error');
                return undefined;
            }
        },
        [asyncFn]
    );

    const reset = useCallback(() => {
        setState('idle');
        setError(null);
        setData(null);
    }, []);

    return {
        execute,
        state,
        isLoading: state === 'loading',
        isSuccess: state === 'success',
        isError: state === 'error',
        error,
        data,
        reset,
    };
}

/**
 * Loading spinner component
 */
export function LoadingSpinner({
    size = 'md',
    className = ''
}: {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4',
    };

    return (
        <div
            className={`
        ${sizeClasses[size]}
        border-primary border-t-transparent
        rounded-full animate-spin
        ${className}
      `}
            role="status"
            aria-label="Loading"
        />
    );
}

/**
 * Full-page loading overlay
 */
export function LoadingOverlay({
    message = 'Loading...',
    visible = true
}: {
    message?: string;
    visible?: boolean;
}) {
    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="loading-message"
        >
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex flex-col items-center gap-4">
                <LoadingSpinner size="lg" />
                <p id="loading-message" className="text-gray-600 dark:text-gray-300">
                    {message}
                </p>
            </div>
        </div>
    );
}

/**
 * Button with loading state
 */
export function LoadingButton({
    children,
    isLoading = false,
    disabled = false,
    onClick,
    className = '',
    loadingText = 'Loading...',
    ...props
}: {
    children: React.ReactNode;
    isLoading?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    loadingText?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`
        relative flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
            aria-busy={isLoading}
            {...props}
        >
            {isLoading && (
                <LoadingSpinner size="sm" className="absolute left-4" />
            )}
            <span className={isLoading ? 'opacity-0' : ''}>
                {children}
            </span>
            {isLoading && (
                <span className="absolute">{loadingText}</span>
            )}
        </button>
    );
}

/**
 * Skeleton loading component
 */
export function Skeleton({
    width = 'full',
    height = '4',
    rounded = 'md',
    className = ''
}: {
    width?: string;
    height?: string;
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
    className?: string;
}) {
    return (
        <div
            className={`
        animate-pulse bg-gray-200 dark:bg-gray-700
        w-${width} h-${height} rounded-${rounded}
        ${className}
      `}
            role="status"
            aria-label="Loading content"
        />
    );
}

/**
 * Content skeleton for loading states
 */
export function ContentSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
        </div>
    );
}

/**
 * Card skeleton for loading states
 */
export function CardSkeleton() {
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
            </div>
            <div className="space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            </div>
        </div>
    );
}

export default useLoading;
