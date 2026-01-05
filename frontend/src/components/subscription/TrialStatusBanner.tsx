import { useState, useEffect } from 'react';
import { ClockIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface TrialStatusProps {
    trialDaysRemaining: number;
    isTrialActive: boolean;
    subscriptionPlan: string;
    subscriptionStatus: string;
    onUpgrade?: () => void;
}

export function TrialStatusBanner({
    trialDaysRemaining,
    isTrialActive,
    subscriptionPlan,
    subscriptionStatus,
    onUpgrade
}: TrialStatusProps) {
    const [dismissed, setDismissed] = useState(false);

    // Don't show for paid plans
    if (subscriptionPlan !== 'trial' || dismissed) {
        return null;
    }

    // Trial expired
    if (!isTrialActive || subscriptionStatus === 'expired') {
        return (
            <div className="bg-red-600 text-white px-4 py-2">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ClockIcon className="h-5 w-5" />
                        <span className="font-medium">Your trial has expired.</span>
                        <span className="text-red-100">Upgrade to continue using RFP Pro.</span>
                    </div>
                    <button
                        onClick={onUpgrade}
                        className="px-4 py-1 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition"
                    >
                        Upgrade Now
                    </button>
                </div>
            </div>
        );
    }

    // Active trial - show days remaining
    const urgentDays = trialDaysRemaining <= 3;

    return (
        <div className={`${urgentDays ? 'bg-amber-500' : 'bg-indigo-600'} text-white px-4 py-2`}>
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5" />
                    <span className="font-medium">
                        {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in your free trial
                    </span>
                    {urgentDays && (
                        <span className="text-amber-100">— Upgrade now to keep your work!</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onUpgrade}
                        className={`px-4 py-1 ${urgentDays ? 'bg-white text-amber-600' : 'bg-white text-indigo-600'} rounded-lg font-medium hover:bg-opacity-90 transition`}
                    >
                        Upgrade
                    </button>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 hover:bg-white/10 rounded"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Hook to get trial status from auth store
export function useTrialStatus() {
    const [trialStatus, setTrialStatus] = useState<{
        trialDaysRemaining: number;
        isTrialActive: boolean;
        subscriptionPlan: string;
        subscriptionStatus: string;
    } | null>(null);

    useEffect(() => {
        // Get from zustand persisted storage
        const authData = localStorage.getItem('auth-storage');
        if (authData) {
            try {
                const parsed = JSON.parse(authData);
                const org = parsed.state?.organization;
                if (org) {
                    setTrialStatus({
                        trialDaysRemaining: org.trial_days_remaining ?? 14,
                        isTrialActive: org.is_trial_active ?? true,
                        subscriptionPlan: org.subscription_plan ?? 'trial',
                        subscriptionStatus: org.subscription_status ?? 'trialing'
                    });
                }
            } catch {
                // Ignore parse errors
            }
        }
    }, []);

    return trialStatus;
}
