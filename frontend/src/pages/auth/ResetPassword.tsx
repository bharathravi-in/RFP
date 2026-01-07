import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '@/api/client';
import {
    SparklesIcon,
    LockClosedIcon,
    EyeIcon,
    EyeSlashIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setError('Invalid reset link. Please request a new password reset.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (!token) {
            toast.error('Invalid reset token');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await authApi.resetPassword(token, password);
            setIsSuccess(true);
            toast.success('Password reset successfully!');

            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to reset password. Please try again.');
            toast.error(error.response?.data?.error || 'Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-6">
                        <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center">
                            <SparklesIcon className="h-7 w-7 text-white" />
                        </div>
                        <span className="font-bold text-2xl text-gray-900">RFP Pro</span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    {error && !isSuccess ? (
                        /* Error State */
                        <div className="text-center py-4">
                            <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Failed</h2>
                            <p className="text-gray-500 mb-6">{error}</p>
                            <Link
                                to="/forgot-password"
                                className="inline-block bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-all"
                            >
                                Request New Reset Link
                            </Link>
                        </div>
                    ) : isSuccess ? (
                        /* Success State */
                        <div className="text-center py-4">
                            <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircleIcon className="h-8 w-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
                            <p className="text-gray-500 mb-6">
                                Your password has been successfully reset.
                                <br />
                                Redirecting to login...
                            </p>
                            <Link
                                to="/login"
                                className="inline-block bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-all"
                            >
                                Go to Login
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                    <LockClosedIcon className="h-7 w-7 text-primary" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
                                <p className="text-gray-500 mt-2">
                                    Enter your new password below.
                                </p>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-gray-50 focus:bg-white"
                                            placeholder="Min. 8 characters"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? (
                                                <EyeSlashIcon className="h-5 w-5" />
                                            ) : (
                                                <EyeIcon className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Confirm Password
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-gray-50 focus:bg-white"
                                        placeholder="Re-enter your password"
                                        autoComplete="new-password"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 px-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Resetting...
                                        </span>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Back to Login */}
                    {!isSuccess && (
                        <div className="mt-6 text-center">
                            <Link
                                to="/login"
                                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                            >
                                Back to login
                            </Link>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-gray-400 mt-6">
                    © {new Date().getFullYear()} RFP Pro. All rights reserved.
                </p>
            </div>
        </div>
    );
}
