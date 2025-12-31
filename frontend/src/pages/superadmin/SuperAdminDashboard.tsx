import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    BuildingOfficeIcon,
    UsersIcon,
    FolderIcon,
    DocumentIcon,
    ChartBarIcon,
    CogIcon,
    ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { superadminApi } from '@/services/superadmin';
import type { PlatformStats } from '@/types/superadmin';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    link?: string;
}

function StatCard({ title, value, icon: Icon, color, link }: StatCardProps) {
    const content = (
        <div className={`bg-white rounded-xl border border-border p-6 hover:shadow-lg transition-shadow ${link ? 'cursor-pointer' : ''}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-text-muted">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-text-primary">{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </div>
    );

    if (link) {
        return <Link to={link}>{content}</Link>;
    }
    return content;
}

interface PlanDistributionProps {
    plans: PlatformStats['plans'];
}

function PlanDistribution({ plans }: PlanDistributionProps) {
    const total = Object.values(plans).reduce((sum, count) => sum + count, 0);

    const planColors = {
        trial: 'bg-gray-400',
        starter: 'bg-blue-500',
        professional: 'bg-purple-500',
        enterprise: 'bg-gradient-to-r from-primary-500 to-accent-500',
    };

    const planLabels = {
        trial: 'Trial',
        starter: 'Starter',
        professional: 'Professional',
        enterprise: 'Enterprise',
    };

    return (
        <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Plan Distribution</h3>
            <div className="space-y-4">
                {(Object.keys(plans) as (keyof typeof plans)[]).map((plan) => {
                    const count = plans[plan];
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    return (
                        <div key={plan}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-text-secondary">{planLabels[plan]}</span>
                                <span className="font-medium text-text-primary">{count}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${planColors[plan]} rounded-full transition-all duration-500`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface SubscriptionStatusProps {
    trialing: number;
    active: number;
    expired: number;
}

function SubscriptionStatus({ trialing, active, expired }: SubscriptionStatusProps) {
    const total = trialing + active + expired;

    return (
        <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Subscription Status</h3>
            <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{trialing}</p>
                    <p className="text-sm text-yellow-700">Trialing</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{active}</p>
                    <p className="text-sm text-green-700">Active</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{expired}</p>
                    <p className="text-sm text-red-700">Expired</p>
                </div>
            </div>
            {total > 0 && (
                <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                        className="bg-yellow-400 transition-all"
                        style={{ width: `${(trialing / total) * 100}%` }}
                    />
                    <div
                        className="bg-green-500 transition-all"
                        style={{ width: `${(active / total) * 100}%` }}
                    />
                    <div
                        className="bg-red-400 transition-all"
                        style={{ width: `${(expired / total) * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
}

export default function SuperAdminDashboard() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await superadminApi.stats.get();
            setStats(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load platform statistics');
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

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600">{error}</p>
                <button
                    onClick={loadStats}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Super Admin Dashboard</h1>
                    <p className="text-text-muted">Platform-wide administration and analytics</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        to="/superadmin/tenants"
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        <BuildingOfficeIcon className="h-5 w-5" />
                        Manage Tenants
                    </Link>
                    <Link
                        to="/superadmin/features"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-border text-text-primary rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <CogIcon className="h-5 w-5" />
                        Feature Flags
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Organizations"
                    value={stats.total_organizations}
                    icon={BuildingOfficeIcon}
                    color="bg-gradient-to-br from-blue-500 to-blue-600"
                    link="/superadmin/tenants"
                />
                <StatCard
                    title="Total Users"
                    value={stats.total_users}
                    icon={UsersIcon}
                    color="bg-gradient-to-br from-green-500 to-green-600"
                />
                <StatCard
                    title="Projects"
                    value={stats.total_projects}
                    icon={FolderIcon}
                    color="bg-gradient-to-br from-purple-500 to-purple-600"
                />
                <StatCard
                    title="Documents"
                    value={stats.total_documents}
                    icon={DocumentIcon}
                    color="bg-gradient-to-br from-orange-500 to-orange-600"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SubscriptionStatus
                    trialing={stats.trialing}
                    active={stats.active}
                    expired={stats.expired}
                />
                <PlanDistribution plans={stats.plans} />
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        to="/superadmin/tenants?filter=trialing"
                        className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
                    >
                        <ArrowTrendingUpIcon className="h-6 w-6 text-yellow-600" />
                        <div>
                            <p className="font-medium text-yellow-900">Active Trials</p>
                            <p className="text-sm text-yellow-700">{stats.trialing} organizations</p>
                        </div>
                    </Link>
                    <Link
                        to="/superadmin/tenants?filter=expired"
                        className="flex items-center gap-3 p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                        <ChartBarIcon className="h-6 w-6 text-red-600" />
                        <div>
                            <p className="font-medium text-red-900">Expired Subscriptions</p>
                            <p className="text-sm text-red-700">{stats.expired} organizations</p>
                        </div>
                    </Link>
                    <Link
                        to="/superadmin/features"
                        className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                        <CogIcon className="h-6 w-6 text-purple-600" />
                        <div>
                            <p className="font-medium text-purple-900">Feature Management</p>
                            <p className="text-sm text-purple-700">Toggle features per tenant</p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
