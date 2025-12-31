import { useState, useEffect } from 'react';
import {
    MagnifyingGlassIcon,
    CheckIcon,
    XMarkIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { superadminApi } from '@/services/superadmin';
import type { SuperAdminOrganization, FeatureDefinition, SubscriptionPlan } from '@/types/superadmin';
import toast from 'react-hot-toast';

// Plan badge colors
const planColors: Record<SubscriptionPlan, string> = {
    trial: 'bg-gray-100 text-gray-700',
    starter: 'bg-blue-100 text-blue-700',
    professional: 'bg-purple-100 text-purple-700',
    enterprise: 'bg-gradient-to-r from-primary-100 to-accent-100 text-primary-700',
};

interface FeatureToggleProps {
    featureKey: string;
    featureName: string;
    enabled: boolean;
    isEnterprise: boolean;
    onToggle: (enabled: boolean) => void;
    loading?: boolean;
}

function FeatureToggle({ featureKey, featureName, enabled, isEnterprise, onToggle, loading }: FeatureToggleProps) {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
                <p className="font-medium text-text-primary">{featureName}</p>
                <p className="text-xs text-text-muted">{featureKey}</p>
            </div>
            <div className="flex items-center gap-2">
                {isEnterprise && (
                    <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded">
                        Enterprise
                    </span>
                )}
                <button
                    onClick={() => onToggle(!enabled)}
                    disabled={loading || isEnterprise}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled || isEnterprise
                        ? 'bg-primary-600'
                        : 'bg-gray-300'
                        } ${(loading || isEnterprise) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled || isEnterprise ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>
        </div>
    );
}

export default function FeatureFlags() {
    const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
    const [features, setFeatures] = useState<FeatureDefinition | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrg, setSelectedOrg] = useState<SuperAdminOrganization | null>(null);
    const [savingFeature, setSavingFeature] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [orgsResponse, featuresResponse] = await Promise.all([
                superadminApi.organizations.list(),
                superadminApi.features.list(),
            ]);
            setOrganizations(orgsResponse.organizations);
            setFeatures(featuresResponse.features);

            // Auto-select first org if none selected
            if (!selectedOrg && orgsResponse.organizations.length > 0) {
                setSelectedOrg(orgsResponse.organizations[0]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFeature = async (featureKey: string, enabled: boolean) => {
        if (!selectedOrg) return;

        setSavingFeature(featureKey);
        try {
            const response = await superadminApi.organizations.updateFeatures(selectedOrg.id, {
                [featureKey]: enabled,
            });

            // Update local state
            setSelectedOrg(prev => prev ? {
                ...prev,
                feature_flags: response.feature_flags,
            } : null);

            // Also update in organizations list
            setOrganizations(prev =>
                prev.map(org =>
                    org.id === selectedOrg.id
                        ? { ...org, feature_flags: response.feature_flags }
                        : org
                )
            );

            toast.success(`${enabled ? 'Enabled' : 'Disabled'} ${featureKey}`);
        } catch (err: any) {
            toast.error(err.message || 'Failed to update feature');
        } finally {
            setSavingFeature(null);
        }
    };

    const handleBulkEnableAll = async () => {
        if (!selectedOrg || !features) return;

        setSavingFeature('all');
        try {
            const allEnabled = Object.keys(features).reduce((acc, key) => {
                acc[key] = true;
                return acc;
            }, {} as Record<string, boolean>);

            const response = await superadminApi.organizations.updateFeatures(selectedOrg.id, allEnabled);

            setSelectedOrg(prev => prev ? {
                ...prev,
                feature_flags: response.feature_flags,
            } : null);

            setOrganizations(prev =>
                prev.map(org =>
                    org.id === selectedOrg.id
                        ? { ...org, feature_flags: response.feature_flags }
                        : org
                )
            );

            toast.success('All features enabled');
        } catch (err: any) {
            toast.error(err.message || 'Failed to enable all features');
        } finally {
            setSavingFeature(null);
        }
    };

    const handleBulkDisableAll = async () => {
        if (!selectedOrg || !features) return;

        setSavingFeature('all');
        try {
            const allDisabled = Object.keys(features).reduce((acc, key) => {
                acc[key] = false;
                return acc;
            }, {} as Record<string, boolean>);

            const response = await superadminApi.organizations.updateFeatures(selectedOrg.id, allDisabled);

            setSelectedOrg(prev => prev ? {
                ...prev,
                feature_flags: response.feature_flags,
            } : null);

            setOrganizations(prev =>
                prev.map(org =>
                    org.id === selectedOrg.id
                        ? { ...org, feature_flags: response.feature_flags }
                        : org
                )
            );

            toast.success('All features disabled');
        } catch (err: any) {
            toast.error(err.message || 'Failed to disable all features');
        } finally {
            setSavingFeature(null);
        }
    };

    // Filter organizations by search
    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    <h1 className="text-2xl font-bold text-text-primary">Feature Flags</h1>
                    <p className="text-text-muted">Enable or disable features for each organization</p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <ArrowPathIcon className="h-5 w-5" />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Organization Selector */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl border border-border p-4 sticky top-4">
                        <h3 className="font-semibold text-text-primary mb-4">Select Organization</h3>

                        {/* Search */}
                        <div className="relative mb-4">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                            <input
                                type="text"
                                placeholder="Search organizations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        {/* Organization List */}
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {filteredOrgs.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => setSelectedOrg(org)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${selectedOrg?.id === org.id
                                        ? 'bg-primary-50 border-2 border-primary-500'
                                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-text-primary">{org.name}</p>
                                            <p className="text-xs text-text-muted">{org.slug}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${planColors[org.subscription_plan]}`}>
                                            {org.subscription_plan}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Feature Toggles */}
                <div className="lg:col-span-2">
                    {selectedOrg ? (
                        <div className="bg-white rounded-xl border border-border p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-text-primary">
                                        Features for {selectedOrg.name}
                                    </h3>
                                    <p className="text-sm text-text-muted">
                                        Plan: <span className={`px-2 py-0.5 rounded-full text-xs ${planColors[selectedOrg.subscription_plan]}`}>
                                            {selectedOrg.subscription_plan}
                                        </span>
                                        {selectedOrg.subscription_plan === 'enterprise' && (
                                            <span className="ml-2 text-primary-600">(All features included)</span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleBulkEnableAll}
                                        disabled={savingFeature !== null || selectedOrg.subscription_plan === 'enterprise'}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                                    >
                                        <CheckIcon className="h-4 w-4" />
                                        Enable All
                                    </button>
                                    <button
                                        onClick={handleBulkDisableAll}
                                        disabled={savingFeature !== null || selectedOrg.subscription_plan === 'enterprise'}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                        Disable All
                                    </button>
                                </div>
                            </div>

                            {features && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(features).map(([key, name]) => (
                                        <FeatureToggle
                                            key={key}
                                            featureKey={key}
                                            featureName={name as string}
                                            enabled={selectedOrg.feature_flags?.[key] ?? false}
                                            isEnterprise={selectedOrg.subscription_plan === 'enterprise'}
                                            onToggle={(enabled) => handleToggleFeature(key, enabled)}
                                            loading={savingFeature === key || savingFeature === 'all'}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-border p-12 text-center">
                            <p className="text-text-muted">Select an organization to manage features</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
