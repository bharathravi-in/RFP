/**
 * CRM Integration Settings Component
 * 
 * Configure Salesforce, HubSpot, or other CRM integrations.
 */
import { useState, useEffect } from 'react';
import {
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    LinkIcon,
    CloudArrowUpIcon,
    CloudArrowDownIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    ArrowTopRightOnSquareIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface CRMIntegration {
    id: number;
    crm_type: 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho' | 'dynamics';
    connection_status: 'connected' | 'disconnected' | 'error';
    sync_enabled: boolean;
    sync_frequency: string;
    sync_direction: 'to_crm' | 'from_crm' | 'bidirectional';
    last_sync_at?: string;
    last_sync_status?: string;
    records_synced?: number;
    total_syncs?: number;
    sync_errors?: number;
    field_mapping?: Record<string, string>;
}

interface SyncLog {
    id: number;
    sync_type: string;
    status: string;
    records_synced: number;
    started_at: string;
    completed_at?: string;
    error_message?: string;
}

const CRM_PROVIDERS = [
    {
        id: 'salesforce',
        name: 'Salesforce',
        logo: '☁️',
        color: 'bg-blue-500',
        description: 'Sync opportunities and accounts with Salesforce CRM',
    },
    {
        id: 'hubspot',
        name: 'HubSpot',
        logo: '🧡',
        color: 'bg-orange-500',
        description: 'Connect deals and companies to HubSpot CRM',
    },
    {
        id: 'pipedrive',
        name: 'Pipedrive',
        logo: '📊',
        color: 'bg-green-500',
        description: 'Sync deals with Pipedrive sales CRM',
    },
    {
        id: 'zoho',
        name: 'Zoho CRM',
        logo: '🔶',
        color: 'bg-red-500',
        description: 'Connect with Zoho CRM potentials',
    },
];

const FIELD_OPTIONS = [
    { value: 'project_name', label: 'Project Name' },
    { value: 'client_name', label: 'Client Name' },
    { value: 'due_date', label: 'Due Date' },
    { value: 'proposal_value', label: 'Proposal Value' },
    { value: 'status', label: 'Status' },
    { value: 'owner', label: 'Owner' },
    { value: 'created_at', label: 'Created Date' },
    { value: 'win_probability', label: 'Win Probability' },
];

export default function CRMIntegrationSection() {
    const [integrations, setIntegrations] = useState<CRMIntegration[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<number | null>(null);
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
    const [selectedIntegration, setSelectedIntegration] = useState<CRMIntegration | null>(null);
    const [showFieldMapping, setShowFieldMapping] = useState(false);

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/crm/integrations', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setIntegrations(data.integrations || []);
            } else {
                console.error('Failed to fetch CRM integrations:', response.status);
                setIntegrations([]);
            }
        } catch (error) {
            console.error('Failed to fetch CRM integrations:', error);
            setIntegrations([]);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (crmType: string) => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/crm/integrations/${crmType}/connect`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.demo_mode) {
                    // Demo mode - integration connected locally
                    toast.success(data.message);
                    fetchIntegrations();
                } else if (data.authorization_url) {
                    // Redirect to OAuth flow
                    window.location.href = data.authorization_url;
                }
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to initiate connection');
            }
        } catch (error) {
            console.error('Error connecting to CRM:', error);
            toast.error('Failed to connect to CRM');
        }
    };

    const handleDisconnect = async (integrationId: number) => {
        if (!confirm('Are you sure you want to disconnect this CRM integration?')) return;

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/crm/integrations/${integrationId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setIntegrations(integrations.filter(i => i.id !== integrationId));
                toast.success('CRM disconnected');
            } else {
                toast.error('Failed to disconnect');
            }
        } catch (error) {
            console.error('Error disconnecting CRM:', error);
            toast.error('Failed to disconnect');
        }
    };

    const handleSync = async (integrationId: number) => {
        setSyncing(integrationId);
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/crm/integrations/${integrationId}/sync`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                toast.success(`Sync started: ${data.records_synced || 0} records processed`);
                fetchIntegrations(); // Refresh
            } else {
                toast.error('Sync failed');
            }
        } catch (error) {
            console.error('Error syncing CRM:', error);
            toast.error('Sync failed');
        } finally {
            setSyncing(null);
        }
    };

    const handleUpdateSettings = async (integration: CRMIntegration, updates: Partial<CRMIntegration>) => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/crm/integrations/${integration.id}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            if (response.ok) {
                setIntegrations(integrations.map(i => 
                    i.id === integration.id ? { ...i, ...updates } : i
                ));
                toast.success('Settings updated');
            } else {
                toast.error('Failed to update settings');
            }
        } catch (error) {
            console.error('Error updating CRM settings:', error);
            toast.error('Failed to update settings');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const connectedCRMs = integrations.filter(i => i.connection_status === 'connected');
    const availableCRMs = CRM_PROVIDERS.filter(
        p => !integrations.find(i => i.crm_type === p.id && i.connection_status === 'connected')
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-text-primary">CRM Integration</h2>
                <p className="text-sm text-text-secondary">
                    Connect your CRM to sync proposals and opportunities
                </p>
            </div>

            {/* Connected CRMs */}
            {connectedCRMs.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-text-primary">Connected Integrations</h3>
                    
                    {connectedCRMs.map(integration => {
                        const provider = CRM_PROVIDERS.find(p => p.id === integration.crm_type);
                        
                        return (
                            <div
                                key={integration.id}
                                className="bg-surface rounded-xl border border-border p-6"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className={clsx(
                                            'w-12 h-12 rounded-lg flex items-center justify-center text-2xl',
                                            provider?.color
                                        )}>
                                            {provider?.logo}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-text-primary">
                                                {provider?.name}
                                            </h4>
                                            <div className="flex items-center gap-2 text-sm">
                                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                                <span className="text-green-600">Connected</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleSync(integration.id)}
                                            disabled={syncing === integration.id}
                                            className="btn-secondary flex items-center gap-2"
                                        >
                                            <ArrowPathIcon className={clsx(
                                                'h-4 w-4',
                                                syncing === integration.id && 'animate-spin'
                                            )} />
                                            Sync Now
                                        </button>
                                        <button
                                            onClick={() => handleDisconnect(integration.id)}
                                            className="btn-danger flex items-center gap-2"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                            Disconnect
                                        </button>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-4 gap-4 mb-6">
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="text-sm text-text-secondary">Last Sync</div>
                                        <div className="font-semibold text-text-primary">
                                            {integration.last_sync_at
                                                ? new Date(integration.last_sync_at).toLocaleTimeString()
                                                : 'Never'}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="text-sm text-text-secondary">Records Synced</div>
                                        <div className="font-semibold text-text-primary">
                                            {integration.records_synced || 0}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="text-sm text-text-secondary">Total Syncs</div>
                                        <div className="font-semibold text-text-primary">
                                            {integration.total_syncs || 0}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="text-sm text-text-secondary">Errors</div>
                                        <div className={clsx(
                                            'font-semibold',
                                            (integration.sync_errors || 0) > 0 ? 'text-red-600' : 'text-green-600'
                                        )}>
                                            {integration.sync_errors || 0}
                                        </div>
                                    </div>
                                </div>

                                {/* Settings */}
                                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Sync Enabled
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={integration.sync_enabled}
                                                onChange={(e) => handleUpdateSettings(integration, { 
                                                    sync_enabled: e.target.checked 
                                                })}
                                                className="rounded"
                                            />
                                            <span className="text-sm text-text-secondary">
                                                Auto-sync changes
                                            </span>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Sync Frequency
                                        </label>
                                        <select
                                            value={integration.sync_frequency}
                                            onChange={(e) => handleUpdateSettings(integration, { 
                                                sync_frequency: e.target.value 
                                            })}
                                            className="input w-full"
                                        >
                                            <option value="realtime">Real-time</option>
                                            <option value="hourly">Hourly</option>
                                            <option value="daily">Daily</option>
                                            <option value="manual">Manual Only</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Sync Direction
                                        </label>
                                        <select
                                            value={integration.sync_direction}
                                            onChange={(e) => handleUpdateSettings(integration, { 
                                                sync_direction: e.target.value as any 
                                            })}
                                            className="input w-full"
                                        >
                                            <option value="to_crm">Push to CRM</option>
                                            <option value="from_crm">Pull from CRM</option>
                                            <option value="bidirectional">Bidirectional</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Field Mapping Toggle */}
                                <button
                                    onClick={() => {
                                        setSelectedIntegration(integration);
                                        setShowFieldMapping(!showFieldMapping);
                                    }}
                                    className="mt-4 text-sm text-primary hover:underline flex items-center gap-1"
                                >
                                    Configure Field Mapping
                                    <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Field Mapping Modal */}
            {showFieldMapping && selectedIntegration && (
                <div className="bg-surface rounded-xl border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-text-primary">Field Mapping</h3>
                        <button
                            onClick={() => setShowFieldMapping(false)}
                            className="text-text-secondary hover:text-text-primary"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <p className="text-sm text-text-secondary mb-4">
                        Map RFP Pro fields to your CRM fields
                    </p>

                    <div className="space-y-3">
                        {FIELD_OPTIONS.map(field => (
                            <div key={field.value} className="grid grid-cols-5 gap-4 items-center">
                                <div className="col-span-2 text-sm font-medium text-text-primary">
                                    {field.label}
                                </div>
                                <div className="text-center text-gray-400">→</div>
                                <div className="col-span-2">
                                    <input
                                        type="text"
                                        placeholder={`${selectedIntegration.crm_type} field`}
                                        className="input w-full"
                                        defaultValue={
                                            selectedIntegration.field_mapping?.[field.value] || ''
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <button
                            onClick={() => setShowFieldMapping(false)}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button className="btn-primary">
                            Save Mapping
                        </button>
                    </div>
                </div>
            )}

            {/* Available CRMs */}
            {availableCRMs.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-text-primary">Available Integrations</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {availableCRMs.map(provider => (
                            <div
                                key={provider.id}
                                className="bg-surface rounded-xl border border-border p-6 flex items-start justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        'w-12 h-12 rounded-lg flex items-center justify-center text-2xl',
                                        provider.color
                                    )}>
                                        {provider.logo}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-text-primary">
                                            {provider.name}
                                        </h4>
                                        <p className="text-sm text-text-secondary">
                                            {provider.description}
                                        </p>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => handleConnect(provider.id)}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <LinkIcon className="h-4 w-4" />
                                    Connect
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                <CloudArrowUpIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                    <h4 className="font-medium text-blue-900">How CRM Sync Works</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                        <li>• Proposals sync as Opportunities/Deals in your CRM</li>
                        <li>• Client information maps to Accounts/Companies</li>
                        <li>• Proposal status changes update CRM stage automatically</li>
                        <li>• Revenue data syncs when proposals are won</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
