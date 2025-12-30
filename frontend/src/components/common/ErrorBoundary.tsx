import { Component, ReactNode, ErrorInfo } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

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
 * React Error Boundary component.
 * Catches JavaScript errors in child components and displays a fallback UI.
 */
export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console (future: send to monitoring service)
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);

        this.setState({ errorInfo });

        // TODO: Send to error monitoring service (Sentry, DataDog, etc.)
        // errorReportingService.captureException(error, { errorInfo });
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-surface rounded-xl border border-border">
                    <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-4">
                        <ExclamationTriangleIcon className="h-8 w-8 text-error" />
                    </div>

                    <h2 className="text-xl font-semibold text-text-primary mb-2">
                        Something went wrong
                    </h2>

                    <p className="text-text-secondary text-center mb-6 max-w-md">
                        We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
                    </p>

                    {/* Error details (collapsed by default in production) */}
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <details className="w-full max-w-lg mb-4 p-4 bg-background rounded-lg border border-border">
                            <summary className="cursor-pointer text-sm font-medium text-text-secondary">
                                Error Details
                            </summary>
                            <pre className="mt-2 text-xs text-error overflow-auto max-h-40">
                                {this.state.error.toString()}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </details>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={this.handleReset}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <ArrowPathIcon className="h-4 w-4" />
                            Try Again
                        </button>
                        <button
                            onClick={this.handleReload}
                            className="btn-primary"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
