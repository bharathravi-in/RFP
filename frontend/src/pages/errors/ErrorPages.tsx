import { Link } from 'react-router-dom';
import { HomeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center px-4">
                <h1 className="text-9xl font-bold text-primary opacity-20">404</h1>
                <h2 className="text-2xl font-semibold text-text-primary mt-4">
                    Page not found
                </h2>
                <p className="text-text-secondary mt-2 max-w-md mx-auto">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <Link to="/" className="btn-primary inline-flex items-center gap-2 mt-6">
                    <HomeIcon className="h-4 w-4" />
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
}

export function ServerError() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center px-4">
                <div className="mx-auto w-20 h-20 bg-error-light rounded-full flex items-center justify-center mb-6">
                    <ExclamationTriangleIcon className="h-10 w-10 text-error" />
                </div>
                <h1 className="text-8xl font-bold text-error opacity-20">500</h1>
                <h2 className="text-2xl font-semibold text-text-primary mt-4">
                    Server Error
                </h2>
                <p className="text-text-secondary mt-2 max-w-md mx-auto">
                    Something went wrong on our end. We're working on fixing it.
                </p>
                <div className="flex gap-4 justify-center mt-6">
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-secondary"
                    >
                        Try Again
                    </button>
                    <Link to="/" className="btn-primary">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}

export function Unauthorized() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center px-4">
                <h1 className="text-8xl font-bold text-warning opacity-20">403</h1>
                <h2 className="text-2xl font-semibold text-text-primary mt-4">
                    Access Denied
                </h2>
                <p className="text-text-secondary mt-2 max-w-md mx-auto">
                    You don't have permission to access this resource.
                </p>
                <Link to="/" className="btn-primary inline-flex items-center gap-2 mt-6">
                    <HomeIcon className="h-4 w-4" />
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
