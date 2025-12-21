import { useState } from 'react';
import { BuildingOfficeIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { organizationsApi } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface OrganizationOnboardingProps {
    isOpen: boolean;
    onComplete: () => void;
}

export default function OrganizationOnboarding({ isOpen, onComplete }: OrganizationOnboardingProps) {
    const [orgName, setOrgName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { setOrganization, user } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!orgName.trim()) {
            toast.error('Organization name is required');
            return;
        }

        setIsLoading(true);
        try {
            const response = await organizationsApi.create({ name: orgName.trim() });
            setOrganization(response.data.organization);
            toast.success('Organization created successfully!');
            onComplete();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create organization');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-primary-50 via-white to-purple-50 z-50 flex items-center justify-center p-6">
            <div className="w-full max-w-lg animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2">
                        <img src="/logo.svg" alt="RFP Pro" className="h-12 w-12" />
                        <span className="font-bold text-2xl text-text-primary">RFP Pro</span>
                    </div>
                </div>

                {/* Welcome Card */}
                <div className="bg-surface rounded-2xl shadow-xl p-8 border border-border-light">
                    <div className="text-center mb-6">
                        <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-4 shadow-lg">
                            <BuildingOfficeIcon className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-text-primary mb-2">
                            Welcome, {user?.name?.split(' ')[0]}!
                        </h1>
                        <p className="text-text-secondary">
                            Let's set up your organization to get started with AI-powered proposals.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="orgName" className="block text-sm font-medium text-text-primary mb-2">
                                Organization name
                            </label>
                            <input
                                id="orgName"
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                className="input"
                                placeholder="e.g., Acme Corporation"
                                autoFocus
                            />
                            <p className="mt-2 text-xs text-text-muted">
                                This is your company or team name that will be used across RFP Pro.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Setting up...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <SparklesIcon className="h-5 w-5" />
                                    Get Started
                                </span>
                            )}
                        </button>
                    </form>

                    {/* Features preview */}
                    <div className="mt-8 pt-6 border-t border-border">
                        <p className="text-xs text-text-muted text-center mb-4">With your organization, you'll be able to:</p>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-3 bg-primary-50 rounded-lg">
                                <p className="text-xs font-medium text-primary-700">Create RFP Projects</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg">
                                <p className="text-xs font-medium text-green-700">Build Knowledge Base</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg">
                                <p className="text-xs font-medium text-purple-700">Invite Team Members</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
