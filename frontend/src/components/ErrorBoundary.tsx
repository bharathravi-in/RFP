import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * 
 * Prevents the entire app from crashing when a component throws an error.
 * Displays a fallback UI and logs the error for debugging.
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so next render shows fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to monitoring service
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({ errorInfo });

        // TODO: Send to error monitoring service like Sentry
        // if (window.Sentry) {
        //     window.Sentry.captureException(error, { extra: errorInfo });
        // }
    }

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback UI provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                    <div className="max-w-md w-full mx-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                            {/* Error Icon */}
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <svg
                                    className="w-8 h-8 text-red-600 dark:text-red-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>

                            {/* Error Message */}
                            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Something went wrong
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                We're sorry, but something unexpected happened.
                                Please try refreshing the page or go back to the home page.
                            </p>

                            {/* Error Details (development only) */}
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <details className="mb-6 text-left">
                                    <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                                        Error Details
                                    </summary>
                                    <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-auto max-h-40">
                                        <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                                            {this.state.error.toString()}
                                            {this.state.errorInfo?.componentStack}
                                        </pre>
                                    </div>
                                </details>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={this.handleReload}
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    Refresh Page
                                </button>
                                <button
                                    onClick={this.handleGoHome}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Go to Home
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
