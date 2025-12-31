import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    UsersIcon,
    FolderIcon,
    DocumentIcon,
    BookOpenIcon,
    SparklesIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface UsageData {
    organization: {
        id: number;
        name: string;
        subscription_plan: string;
        subscription_status: string;
        is_trial_active: boolean;
        trial_days_remaining: number | null;
        trial_ends_at: string | null;
    };
    usage: {
        users: UsageItem;
        projects: UsageItem;
        documents: UsageItem;
        knowledge_items: UsageItem;
    };
    activity: {
        total_questions: number;
        answered_questions: number;
        approved_answers: number;
        answer_rate: number;
        approval_rate: number;
        ai_generations_this_month: number;
    };
}

interface UsageItem {
    current: number;
    limit: number;
    percentage: number;
    unlimited: boolean;
}

const planLabels: Record<string, string> = {
    trial: 'Free Trial',
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
};

const planColors: Record<string, string> = {
    trial: 'bg-gray-100 text-gray-700 border-gray-200',
    starter: 'bg-blue-100 text-blue-700 border-blue-200',
    professional: 'bg-purple-100 text-purple-700 border-purple-200',
    enterprise: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border-amber-200',
};

function UsageCard({
    title,
    icon: Icon,
    current,
    limit,
    percentage,
    unlimited,
    color,
}: {
    title: string;
    icon: React.ElementType;
    current: number;
    limit: number;
    percentage: number;
    unlimited: boolean;
    color: string;
}) {
    const getProgressColor = () => {
        if (unlimited) return 'bg-green-500';
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 75) return 'bg-yellow-500';
        return 'bg-primary-500';
    };

    const getStatusColor = () => {
        if (unlimited) return 'text-green-600';
        if (percentage >= 90) return 'text-red-600';
        if (percentage >= 75) return 'text-yellow-600';
        return 'text-text-secondary';
    };

    return (
        <div className="bg-white rounded-xl border border-border p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${color}`}>
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-text-primary">{title}</h3>
                </div>
                {percentage >= 90 && !unlimited && (
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                )}
            </div>

            <div className="space-y-3">
                <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold text-text-primary">{current.toLocaleString()}</span>
                    <span className={`text-sm ${getStatusColor()}`}>
                        {unlimited ? '∞ Unlimited' : `of ${limit.toLocaleString()}`}
                    </span>
                </div>

                {!unlimited && (
                    <div className="space-y-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-text-muted text-right">{percentage}% used</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ActivityCard({
    title,
    value,
    suffix,
    icon: Icon,
    color,
}: {
    title: string;
    value: number;
    suffix?: string;
    icon: React.ElementType;
    color: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm text-text-muted">{title}</p>
                    <p className="text-xl font-bold text-text-primary">
                        {value.toLocaleString()}{suffix}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function UsageDashboard() {
    const [data, setData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadUsageData();
    }, []);

    const loadUsageData = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/analytics/usage', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load usage data');
            }

            const result = await response.json();
            setData(result);
        } catch (err: any) {
            setError(err.message || 'Failed to load usage data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600">{error || 'No data available'}</p>
                <button
                    onClick={loadUsageData}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    const { organization, usage, activity } = data;

    return (
        <div className="space-y-6">
            {/* Header with Plan Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Usage Dashboard</h1>
                    <p className="text-text-muted">Monitor your organization's resource consumption</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Plan Badge */}
                    <div className={`px-4 py-2 rounded-lg border ${planColors[organization.subscription_plan] || planColors.trial}`}>
                        <span className="font-semibold">
                            {planLabels[organization.subscription_plan] || organization.subscription_plan}
                        </span>
                    </div>

                    {/* Trial Warning */}
                    {organization.is_trial_active && organization.trial_days_remaining !== null && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${organization.trial_days_remaining <= 3
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                            }`}>
                            <ClockIcon className="h-5 w-5" />
                            <span className="font-medium">
                                {organization.trial_days_remaining} days left in trial
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Usage Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <UsageCard
                    title="Team Members"
                    icon={UsersIcon}
                    current={usage.users.current}
                    limit={usage.users.limit}
                    percentage={usage.users.percentage}
                    unlimited={usage.users.unlimited}
                    color="bg-gradient-to-br from-blue-500 to-blue-600"
                />
                <UsageCard
                    title="Projects"
                    icon={FolderIcon}
                    current={usage.projects.current}
                    limit={usage.projects.limit}
                    percentage={usage.projects.percentage}
                    unlimited={usage.projects.unlimited}
                    color="bg-gradient-to-br from-purple-500 to-purple-600"
                />
                <UsageCard
                    title="Documents"
                    icon={DocumentIcon}
                    current={usage.documents.current}
                    limit={usage.documents.limit}
                    percentage={usage.documents.percentage}
                    unlimited={usage.documents.unlimited}
                    color="bg-gradient-to-br from-orange-500 to-orange-600"
                />
                <UsageCard
                    title="Knowledge Items"
                    icon={BookOpenIcon}
                    current={usage.knowledge_items.current}
                    limit={usage.knowledge_items.limit}
                    percentage={usage.knowledge_items.percentage}
                    unlimited={usage.knowledge_items.unlimited}
                    color="bg-gradient-to-br from-green-500 to-green-600"
                />
            </div>

            {/* Activity Stats */}
            <div className="bg-white rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Activity This Month</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <ActivityCard
                        title="Total Questions"
                        value={activity.total_questions}
                        icon={DocumentIcon}
                        color="bg-gray-100 text-gray-600"
                    />
                    <ActivityCard
                        title="Answered"
                        value={activity.answered_questions}
                        icon={CheckCircleIcon}
                        color="bg-green-100 text-green-600"
                    />
                    <ActivityCard
                        title="Approved"
                        value={activity.approved_answers}
                        icon={CheckCircleIcon}
                        color="bg-blue-100 text-blue-600"
                    />
                    <ActivityCard
                        title="Answer Rate"
                        value={activity.answer_rate}
                        suffix="%"
                        icon={SparklesIcon}
                        color="bg-purple-100 text-purple-600"
                    />
                    <ActivityCard
                        title="Approval Rate"
                        value={activity.approval_rate}
                        suffix="%"
                        icon={CheckCircleIcon}
                        color="bg-amber-100 text-amber-600"
                    />
                    <ActivityCard
                        title="AI Generations"
                        value={activity.ai_generations_this_month}
                        icon={SparklesIcon}
                        color="bg-gradient-to-r from-primary-100 to-accent-100 text-primary-600"
                    />
                </div>
            </div>

            {/* Upgrade CTA for limited plans */}
            {organization.subscription_plan !== 'enterprise' && (
                <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl border border-primary-200 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary">Need more resources?</h3>
                            <p className="text-text-muted">
                                Upgrade your plan to unlock unlimited projects, users, and advanced features.
                            </p>
                        </div>
                        <button className="px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-medium hover:from-primary-700 hover:to-accent-700 transition-colors whitespace-nowrap">
                            Upgrade Plan
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
