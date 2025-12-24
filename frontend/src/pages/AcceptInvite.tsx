import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { invitationsApi } from '@/api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import {
    EnvelopeIcon,
    UserIcon,
    LockClosedIcon,
    CheckCircleIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';

interface InvitationInfo {
    valid: boolean;
    email: string;
    organization_name: string;
    role: string;
    expires_at: string;
}

export default function AcceptInvite() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuthStore();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(true);
    const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Registration form
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Validate token on mount
    useEffect(() => {
        if (!token) {
            setError('Invalid invitation link. No token provided.');
            setLoading(false);
            return;
        }

        validateToken();
    }, [token]);

    const validateToken = async () => {
        try {
            const response = await invitationsApi.validate(token!);
            setInvitation(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Invalid or expired invitation');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setSubmitting(true);
        try {
            const response = await invitationsApi.acceptAndRegister({
                token: token!,
                name,
                password
            });

            toast.success('Account created successfully!');

            // Auto-login with returned tokens
            localStorage.setItem('access_token', response.data.access_token);
            localStorage.setItem('refresh_token', response.data.refresh_token);

            // Redirect to dashboard
            window.location.href = '/dashboard';
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create account');
        } finally {
            setSubmitting(false);
        }
    };

    // If user is already logged in, show different UI
    const handleAcceptAsLoggedIn = async () => {
        setSubmitting(true);
        try {
            await invitationsApi.accept(token!);
            toast.success('Invitation accepted! Welcome to the team.');
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to accept invitation');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-purple-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-background to-red-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <XCircleIcon className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">Invalid Invitation</h1>
                    <p className="text-text-muted mb-6">{error}</p>
                    <Link
                        to="/login"
                        className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
                    >
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-purple-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <EnvelopeIcon className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">You're Invited!</h1>
                    <p className="text-text-muted">
                        Join <span className="font-semibold text-primary">{invitation?.organization_name}</span> as a <span className="font-medium">{invitation?.role}</span>
                    </p>
                </div>

                {/* Email Display */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
                    <p className="text-sm text-text-muted mb-1">Invitation sent to</p>
                    <p className="font-medium text-text-primary">{invitation?.email}</p>
                </div>

                {isAuthenticated && user ? (
                    // Logged in user flow
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                <span className="font-medium text-green-800">Logged in as {user.email}</span>
                            </div>
                            <p className="text-sm text-green-700">
                                Click below to join the organization with your existing account.
                            </p>
                        </div>
                        <button
                            onClick={handleAcceptAsLoggedIn}
                            disabled={submitting}
                            className="w-full py-3 px-4 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Joining...' : 'Join Organization'}
                        </button>
                    </div>
                ) : (
                    // New user registration flow
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                                Your Name
                            </label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="Enter your full name"
                                    className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    placeholder="Create a password"
                                    className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Confirm your password"
                                    className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 px-4 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {submitting ? 'Creating Account...' : 'Create Account & Join'}
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-text-muted">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
