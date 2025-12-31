import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    PencilIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { superadminApi } from '@/services/superadmin';
import type { SuperAdminOrganization, SubscriptionPlan, SubscriptionStatus, PlansResponse } from '@/types/superadmin';
import toast from 'react-hot-toast';

// Plan badge colors
const planColors: Record<SubscriptionPlan, string> = {
    trial: 'bg-gray-100 text-gray-700',
    starter: 'bg-blue-100 text-blue-700',
    professional: 'bg-purple-100 text-purple-700',
    enterprise: 'bg-gradient-to-r from-primary-100 to-accent-100 text-primary-700',
};

// Status badge colors
const statusColors: Record<SubscriptionStatus, string> = {
    trialing: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    canceled: 'bg-gray-100 text-gray-700',
    expired: 'bg-red-100 text-red-700',
};

interface ExtendTrialModalProps {
    org: SuperAdminOrganization;
    onClose: () => void;
    onExtend: (orgId: number, days: number) => Promise<void>;
}

function ExtendTrialModal({ org, onClose, onExtend }: ExtendTrialModalProps) {
    const [days, setDays] = useState(14);
    const [loading, setLoading] = useState(false);

    const handleExtend = async () => {
        setLoading(true);
        try {
            await onExtend(org.id, days);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                    Extend Trial for {org.name}
                </h3>
                <p className="text-sm text-text-muted mb-4">
                    Current trial ends: {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : 'N/A'}
                    {org.trial_days_remaining > 0 && ` (${org.trial_days_remaining} days remaining)`}
                </p>
                <div className="mb-6">
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                        Extend by (days)
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={365}
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value) || 14)}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-text-secondary hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExtend}
                        disabled={loading}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Extending...' : `Extend by ${days} days`}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface EditSubscriptionModalProps {
    org: SuperAdminOrganization;
    plans: PlansResponse['plans'] | null;
    onClose: () => void;
    onSave: (orgId: number, data: any) => Promise<void>;
}

function EditSubscriptionModal({ org, plans, onClose, onSave }: EditSubscriptionModalProps) {
    const [formData, setFormData] = useState({
        plan: org.subscription_plan,
        status: org.subscription_status,
        max_users: org.max_users,
        max_projects: org.max_projects,
        max_documents: org.max_documents,
    });
    const [loading, setLoading] = useState(false);

    const handlePlanChange = (plan: SubscriptionPlan) => {
        setFormData(prev => ({ ...prev, plan }));
        // Auto-set limits based on plan
        if (plans && plans[plan]) {
            const planDef = plans[plan];
            setFormData(prev => ({
                ...prev,
                plan,
                max_users: planDef.max_users,
                max_projects: planDef.max_projects,
                max_documents: planDef.max_documents,
            }));
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave(org.id, formData);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                    Edit Subscription: {org.name}
                </h3>

                <div className="space-y-4">
                    {/* Plan Selection */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Subscription Plan
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['trial', 'starter', 'professional', 'enterprise'] as SubscriptionPlan[]).map((plan) => (
                                <button
                                    key={plan}
                                    onClick={() => handlePlanChange(plan)}
                                    className={`px-4 py-2 rounded-lg border-2 transition-colors capitalize ${formData.plan === plan
                                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                                            : 'border-border hover:border-primary-300'
                                        }`}
                                >
                                    {plan}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status Selection */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as SubscriptionStatus }))}
                            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="trialing">Trialing</option>
                            <option value="active">Active</option>
                            <option value="canceled">Canceled</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>

                    {/* Limits */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Max Users
                            </label>
                            <input
                                type="number"
                                min={-1}
                                value={formData.max_users}
                                onChange={(e) => setFormData(prev => ({ ...prev, max_users: parseInt(e.target.value) }))}
                                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                            <p className="text-xs text-text-muted mt-1">-1 = unlimited</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Max Projects
                            </label>
                            <input
                                type="number"
                                min={-1}
                                value={formData.max_projects}
                                onChange={(e) => setFormData(prev => ({ ...prev, max_projects: parseInt(e.target.value) }))}
                                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Max Documents
                            </label>
                            <input
                                type="number"
                                min={-1}
                                value={formData.max_documents}
                                onChange={(e) => setFormData(prev => ({ ...prev, max_documents: parseInt(e.target.value) }))}
                                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-text-secondary hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function TenantManagement() {
    const [searchParams] = useSearchParams();
    const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
    const [plans, setPlans] = useState<PlansResponse['plans'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('filter') || 'all');
    const [planFilter, setPlanFilter] = useState<string>('all');

    // Modals
    const [editingOrg, setEditingOrg] = useState<SuperAdminOrganization | null>(null);
    const [extendingOrg, setExtendingOrg] = useState<SuperAdminOrganization | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [orgsResponse, plansResponse] = await Promise.all([
                superadminApi.organizations.list(),
                superadminApi.plans.list(),
            ]);
            setOrganizations(orgsResponse.organizations);
            setPlans(plansResponse.plans);
        } catch (err: any) {
            setError(err.message || 'Failed to load organizations');
        } finally {
            setLoading(false);
        }
    };

    const handleExtendTrial = async (orgId: number, days: number) => {
        try {
            const response = await superadminApi.organizations.extendTrial(orgId, days);
            toast.success(response.message);
            loadData(); // Refresh
        } catch (err: any) {
            toast.error(err.message || 'Failed to extend trial');
            throw err;
        }
    };

    const handleUpdateSubscription = async (orgId: number, data: any) => {
        try {
            const response = await superadminApi.organizations.updateSubscription(orgId, data);
            toast.success(response.message);
            loadData(); // Refresh
        } catch (err: any) {
            toast.error(err.message || 'Failed to update subscription');
            throw err;
        }
    };

    // Filtered organizations
    const filteredOrganizations = useMemo(() => {
        return organizations.filter((org) => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!org.name.toLowerCase().includes(query) && !org.slug.toLowerCase().includes(query)) {
                    return false;
                }
            }
            // Status filter
            if (statusFilter !== 'all' && org.subscription_status !== statusFilter) {
                return false;
            }
            // Plan filter
            if (planFilter !== 'all' && org.subscription_plan !== planFilter) {
                return false;
            }
            return true;
        });
    }, [organizations, searchQuery, statusFilter, planFilter]);

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
                    onClick={loadData}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Tenant Management</h1>
                    <p className="text-text-muted">{organizations.length} organizations</p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <ArrowPathIcon className="h-5 w-5" />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-border p-4">
                <div className="flex flex-wrap gap-4">
                    {/* Search */}
                    <div className="flex-1 min-w-[250px]">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                            <input
                                type="text"
                                placeholder="Search organizations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <FunnelIcon className="h-5 w-5 text-text-muted" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="all">All Status</option>
                            <option value="trialing">Trialing</option>
                            <option value="active">Active</option>
                            <option value="canceled">Canceled</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>

                    {/* Plan Filter */}
                    <select
                        value={planFilter}
                        onChange={(e) => setPlanFilter(e.target.value)}
                        className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="all">All Plans</option>
                        <option value="trial">Trial</option>
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                </div>
            </div>

            {/* Organizations Table */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-border">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Organization
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Plan
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Usage
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Trial
                                </th>
                                <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredOrganizations.map((org) => (
                                <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium text-text-primary">{org.name}</p>
                                            <p className="text-sm text-text-muted">{org.slug}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${planColors[org.subscription_plan]}`}>
                                            {org.subscription_plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[org.subscription_status]}`}>
                                            {org.subscription_status === 'active' && <CheckCircleIcon className="h-3.5 w-3.5" />}
                                            {org.subscription_status === 'expired' && <XCircleIcon className="h-3.5 w-3.5" />}
                                            {org.subscription_status === 'trialing' && <ClockIcon className="h-3.5 w-3.5" />}
                                            {org.subscription_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm">
                                            <p><span className="text-text-muted">Users:</span> {org.user_count}/{org.max_users === -1 ? '∞' : org.max_users}</p>
                                            <p><span className="text-text-muted">Projects:</span> {org.project_count}/{org.max_projects === -1 ? '∞' : org.max_projects}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {org.is_trial_active ? (
                                            <div className="text-sm">
                                                <p className="text-yellow-600 font-medium">{org.trial_days_remaining} days left</p>
                                                <p className="text-text-muted text-xs">
                                                    Ends {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : '-'}
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-text-muted">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setEditingOrg(org)}
                                                className="p-2 text-text-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                title="Edit subscription"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            {(org.subscription_status === 'trialing' || org.subscription_status === 'expired') && (
                                                <button
                                                    onClick={() => setExtendingOrg(org)}
                                                    className="p-2 text-text-muted hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                                    title="Extend trial"
                                                >
                                                    <ClockIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredOrganizations.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-text-muted">No organizations found matching your filters.</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {extendingOrg && (
                <ExtendTrialModal
                    org={extendingOrg}
                    onClose={() => setExtendingOrg(null)}
                    onExtend={handleExtendTrial}
                />
            )}
            {editingOrg && (
                <EditSubscriptionModal
                    org={editingOrg}
                    plans={plans}
                    onClose={() => setEditingOrg(null)}
                    onSave={handleUpdateSubscription}
                />
            )}
        </div>
    );
}
