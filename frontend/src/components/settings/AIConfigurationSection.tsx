import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
    CogIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    PlusIcon,
    TrashIcon
} from '@heroicons/react/24/outline';

interface AgentConfig {
    id?: number;
    agent_type: string;
    provider: string;
    model: string;
    api_endpoint?: string;
    use_default_key: boolean;
}

interface Provider {
    name: string;
    embedding_models: Array<{ value: string; label: string; dimension: number }>;
    llm_models: Array<{ value: string; label: string }>;
    requires_endpoint: boolean;
    api_key_link: string;
}

interface AgentType {
    name: string;
    description: string;
    required: boolean;
}

export default function AIConfigurationSection() {
    const { user } = useAuthStore();
    const [configs, setConfigs] = useState<AgentConfig[]>([]);
    const [providers, setProviders] = useState<Record<string, Provider>>({});
    const [agentTypes, setAgentTypes] = useState<Record<string, AgentType>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user?.organization_id) {
            loadConfigs();
            loadProviders();
            loadAgentTypes();
        }
    }, [user?.organization_id]);

    const loadConfigs = async () => {
        if (!user?.organization_id) return;

        try {
            const res = await fetch(`/api/organizations/${user.organization_id}/agent-configs`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (res.ok) {
                const data = await res.json();
                setConfigs(data.configs || []);
            }
        } catch (error) {
            console.error('Failed to load configs:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProviders = async () => {
        if (!user?.organization_id) return;

        try {
            const res = await fetch(`/api/organizations/${user.organization_id}/ai-config/providers`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (res.ok) {
                const data = await res.json();
                setProviders(data.providers);
            }
        } catch (error) {
            console.error('Failed to load providers:', error);
        }
    };

    const loadAgentTypes = async () => {
        if (!user?.organization_id) return;

        try {
            const res = await fetch(`/api/organizations/${user.organization_id}/agent-types`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (res.ok) {
                const data = await res.json();
                setAgentTypes(data.agent_types);
            }
        } catch (error) {
            console.error('Failed to load agent types:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="bg-surface rounded-xl p-6 border border-border">
                <div className="flex items-center gap-3 mb-4">
                    <CogIcon className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-semibold">AI Configuration</h2>
                </div>
                <p className="text-text-secondary mb-6">
                    Configure AI providers and models for different agents. Each agent can use a different provider and model optimized for its specific task.
                </p>

                {/* Agent Configurations */}
                <div className="space-y-4">
                    {Object.entries(agentTypes).map(([agentType, typeInfo]) => {
                        const config = configs.find(c => c.agent_type === agentType);
                        return (
                            <AgentConfigCard
                                key={agentType}
                                agentType={agentType}
                                typeInfo={typeInfo}
                                config={config}
                                providers={providers}
                                onSave={loadConfigs}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Agent Config Card Component
function AgentConfigCard({ agentType, typeInfo, config, providers, onSave }: any) {
    const { user } = useAuthStore();
    const [isEditing, setIsEditing] = useState(!config);
    const [provider, setProvider] = useState(config?.provider || 'google');
    const [model, setModel] = useState(config?.model || '');
    const [apiKey, setApiKey] = useState('');
    const [endpoint, setEndpoint] = useState(config?.api_endpoint || '');
    const [useDefaultKey, setUseDefaultKey] = useState(config?.use_default_key ?? true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    const currentProvider = providers[provider];

    const handleSave = async () => {
        setSaving(true);

        try {
            const res = await fetch(
                `/api/organizations/${user?.organization_id}/agent-configs/${agentType}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    },
                    body: JSON.stringify({
                        provider,
                        model,
                        api_key: useDefaultKey ? undefined : apiKey,
                        api_endpoint: endpoint || undefined,
                        use_default_key: useDefaultKey
                    })
                }
            );

            if (res.ok) {
                alert('Configuration saved!');
                setIsEditing(false);
                onSave();
            } else {
                const error = await res.json();
                alert('Failed to save: ' + error.error);
            }
        } catch (error) {
            alert('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    if (!isEditing && config) {
        return (
            <div className="p-4 bg-background rounded-lg border border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-text-primary">{typeInfo.name}</h3>
                        <p className="text-sm text-text-secondary">{typeInfo.description}</p>
                        <p className="text-xs text-text-secondary mt-1">
                            {providers[config.provider]?.name} - {config.model}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="btn btn-secondary text-sm"
                    >
                        Edit
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-background rounded-lg border-2 border-primary/50">
            <h3 className="font-semibold text-text-primary mb-2">{typeInfo.name}</h3>
            <p className="text-sm text-text-secondary mb-4">{typeInfo.description}</p>

            <div className="space-y-3">
                {/* Provider Selection */}
                <div>
                    <label className="block text-sm font-medium mb-1">Provider</label>
                    <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                    >
                        {Object.entries(providers).map(([key, prov]) => (
                            <option key={key} value={key}>{prov.name}</option>
                        ))}
                    </select>
                </div>

                {/* Model Input - FREE TEXT */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Model
                        {currentProvider && (
                            <a
                                href={currentProvider.api_key_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-xs text-primary hover:underline"
                            >
                                Get API Key →
                            </a>
                        )}
                    </label>
                    <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="e.g., gemini-1.5-pro, gpt-4-turbo, custom-model-v1"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                        list={`model-suggestions-${agentType}`}
                    />
                    <datalist id={`model-suggestions-${agentType}`}>
                        <option value="gemini-1.5-pro" />
                        <option value="gemini-1.5-flash" />
                        <option value="gpt-4-turbo" />
                        <option value="gpt-4" />
                        <option value="text-embedding-3-small" />
                        <option value="text-embedding-004" />
                    </datalist>
                </div>

                {/* Use Default Key Checkbox */}
                {agentType !== 'default' && (
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={useDefaultKey}
                            onChange={(e) => setUseDefaultKey(e.target.checked)}
                            className="rounded"
                        />
                        <span className="text-sm">Use default organization API key</span>
                    </label>
                )}

                {/* API Key (if not using default) */}
                {!useDefaultKey && (
                    <div>
                        <label className="block text-sm font-medium mb-1">API Key</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter API key"
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                        />
                    </div>
                )}

                {/* Endpoint (for Azure) */}
                {currentProvider?.requires_endpoint && (
                    <div>
                        <label className="block text-sm font-medium mb-1">Endpoint URL</label>
                        <input
                            type="url"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder="https://your-resource.openai.azure.com"
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !model}
                        className="btn btn-primary text-sm"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    {config && (
                        <button
                            onClick={() => setIsEditing(false)}
                            className="btn btn-secondary text-sm"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
