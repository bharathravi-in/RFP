import clsx from 'clsx';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export default function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-10 w-10',
    };

    return (
        <svg
            className={clsx('animate-spin text-primary', sizeClasses[size], className)}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}

// Full page loading state
export function PageLoader() {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
                <LoadingSpinner size="lg" className="mx-auto" />
                <p className="mt-4 text-sm text-text-muted">Loading...</p>
            </div>
        </div>
    );
}

// Inline loading button state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    children: React.ReactNode;
}

export function LoadingButton({
    loading,
    children,
    disabled,
    className,
    ...props
}: LoadingButtonProps) {
    return (
        <button
            disabled={loading || disabled}
            className={clsx('relative', className)}
            {...props}
        >
            {loading && (
                <span className="absolute inset-0 flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                </span>
            )}
            <span className={clsx(loading && 'invisible')}>{children}</span>
        </button>
    );
}
