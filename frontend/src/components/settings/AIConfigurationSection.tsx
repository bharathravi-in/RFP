import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
    CpuChipIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    BeakerIcon,
    AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

interface AgentConfig {
    id?: number;
    agent_type: string;
    provider: string;
    model: string;
    base_url?: string;
    temperature?: number;
    max_tokens?: number;
    api_endpoint?: string;
    use_default_key: boolean;
}

interface ProviderModel {
    value: string;
    label: string;
    description?: string;
    dimension?: number;
}

interface Provider {
    name: string;
    description?: string;
    embedding_models?: ProviderModel[];
    llm_models?: ProviderModel[];
    requires_endpoint: boolean;
    default_endpoint?: string;
    api_key_link?: string;
    supports_agent_config?: boolean;
}

interface AgentType {
    type: string;
    name: string;
    description: string;
}

export default function AIConfigurationSection() {
    const { user } = useAuthStore();
    const [configs, setConfigs] = useState<AgentConfig[]>([]);
    const [providers, setProviders] = useState<Record<string, Provider>>({});
    const [availableAgents, setAvailableAgents] = useState<AgentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState<string>('default');

    useEffect(() => {
        if (user?.organization_id) {
            loadData();
        }
    }, [user?.organization_id]);

    const loadData = async () => {
        if (!user?.organization_id) return;
        setLoading(true);

        try {
            // Load configs
            const configRes = await fetch(`/api/organizations/${user.organization_id}/agent-configs`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (configRes.ok) {
                const data = await configRes.json();
                console.log('AIConfigurationSection: Loaded configs', data.configs);
                console.log('AIConfigurationSection: Default config', data.configs?.find((c: AgentConfig) => c.agent_type === 'default'));
                setConfigs(data.configs || []);
                setAvailableAgents(data.available_agents || []);
            }

            // Load providers
            const providerRes = await fetch(`/api/organizations/${user.organization_id}/ai-config/providers`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (providerRes.ok) {
                const data = await providerRes.json();
                setProviders(data.providers || {});
                if (data.available_agents) {
                    setAvailableAgents(data.available_agents);
                }
            }
        } catch (error) {
            console.error('Failed to load AI configuration:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-text-secondary">Loading AI configuration...</span>
            </div>
        );
    }

    const selectedConfig = configs.find(c => c.agent_type === selectedAgent);
    const defaultConfig = configs.find(c => c.agent_type === 'default');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-surface rounded-xl p-6 border border-border">
                <div className="flex items-center gap-3 mb-4">
                    <CpuChipIcon className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-semibold">AI Configuration</h2>
                </div>
                <p className="text-text-secondary mb-4">
                    Configure LLM providers and models for each agent. All 13 agents can use different models optimized for their specific tasks.
                </p>

                {/* Provider Info Banner - Dynamic based on current configuration */}
                {defaultConfig?.provider === 'litellm' && (
                    <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 mb-6 border border-primary/20">
                        <div className="flex items-start gap-3">
                            <BeakerIcon className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                                <h3 className="font-medium text-text-primary">LiteLLM Proxy Integration</h3>
                                <p className="text-sm text-text-secondary mt-1">
                                    Using LiteLLM proxy at <code className="bg-surface px-1 py-0.5 rounded text-xs">{defaultConfig?.base_url || 'https://litellm.tarento.dev'}</code>
                                    {' '}with model: <strong>{defaultConfig?.model || 'gemini-flash'}</strong>
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {defaultConfig?.provider === 'google' && (
                    <div className="bg-gradient-to-r from-success/10 to-primary/10 rounded-lg p-4 mb-6 border border-success/20">
                        <div className="flex items-start gap-3">
                            <CheckCircleIcon className="h-5 w-5 text-success mt-0.5" />
                            <div>
                                <h3 className="font-medium text-text-primary">Google AI Direct Integration</h3>
                                <p className="text-sm text-text-secondary mt-1">
                                    Direct access to Google Generative AI with model: <strong>{defaultConfig?.model || 'gemini-1.5-pro'}</strong>
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {!defaultConfig && (
                    <div className="bg-gradient-to-r from-warning/10 to-accent/10 rounded-lg p-4 mb-6 border border-warning/20">
                        <div className="flex items-start gap-3">
                            <AdjustmentsHorizontalIcon className="h-5 w-5 text-warning mt-0.5" />
                            <div>
                                <h3 className="font-medium text-text-primary">No Default Configuration</h3>
                                <p className="text-sm text-text-secondary mt-1">
                                    Please configure a default AI provider below to enable AI features.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Agent Selector */}
                <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Select Agent to Configure</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {availableAgents.map(agent => {
                            const hasConfig = configs.some(c => c.agent_type === agent.type);
                            const isSelected = selectedAgent === agent.type;
                            return (
                                <button
                                    key={agent.type}
                                    onClick={() => setSelectedAgent(agent.type)}
                                    className={`
                                        p-3 rounded-lg border text-left transition-all
                                        ${isSelected
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-primary/50 bg-background'
                                        }
                                    `}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-sm">{agent.name}</span>
                                        {hasConfig && (
                                            <CheckCircleIcon className="h-4 w-4 text-success" />
                                        )}
                                    </div>
                                    <p className="text-xs text-text-secondary line-clamp-1">{agent.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Configuration Form */}
                <AgentConfigForm
                    key={`${selectedAgent}-${selectedConfig?.id || 'new'}`}
                    agentType={selectedAgent}
                    agentInfo={availableAgents.find(a => a.type === selectedAgent)}
                    config={selectedConfig}
                    defaultConfig={defaultConfig}
                    providers={providers}
                    onSave={loadData}
                />
            </div>

            {/* Configured Agents Summary */}
            <div className="bg-surface rounded-xl p-6 border border-border">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AdjustmentsHorizontalIcon className="h-5 w-5 text-primary" />
                    Configured Agents Summary
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 font-medium">Agent</th>
                                <th className="text-left py-2 px-3 font-medium">Provider</th>
                                <th className="text-left py-2 px-3 font-medium">Model</th>
                                <th className="text-left py-2 px-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {availableAgents.map(agent => {
                                const config = configs.find(c => c.agent_type === agent.type);
                                const usesDefault = !config && agent.type !== 'default';
                                return (
                                    <tr key={agent.type} className="border-b border-border/50 hover:bg-background/50">
                                        <td className="py-2 px-3">{agent.name}</td>
                                        <td className="py-2 px-3">
                                            {config ? (
                                                <span className="text-text-primary">
                                                    {providers[config.provider]?.name || config.provider}
                                                </span>
                                            ) : usesDefault ? (
                                                <span className="text-text-secondary italic">Using default</span>
                                            ) : (
                                                <span className="text-warning">Not configured</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-3">
                                            {config ? (
                                                <code className="bg-background px-1.5 py-0.5 rounded text-xs">{config.model}</code>
                                            ) : usesDefault && defaultConfig ? (
                                                <code className="bg-background px-1.5 py-0.5 rounded text-xs text-text-secondary">{defaultConfig.model}</code>
                                            ) : '-'}
                                        </td>
                                        <td className="py-2 px-3">
                                            {config ? (
                                                <span className="inline-flex items-center gap-1 text-success text-xs">
                                                    <CheckCircleIcon className="h-3 w-3" /> Configured
                                                </span>
                                            ) : usesDefault ? (
                                                <span className="text-text-secondary text-xs">Inherits default</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-warning text-xs">
                                                    <XCircleIcon className="h-3 w-3" /> Missing
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Agent Configuration Form Component
function AgentConfigForm({
    agentType,
    agentInfo,
    config,
    defaultConfig,
    providers,
    onSave
}: {
    agentType: string;
    agentInfo?: AgentType;
    config?: AgentConfig;
    defaultConfig?: AgentConfig;
    providers: Record<string, Provider>;
    onSave: () => void;
}) {
    const { user } = useAuthStore();
    const [provider, setProvider] = useState(config?.provider || '');
    const [model, setModel] = useState(config?.model || '');
    const [baseUrl, setBaseUrl] = useState(config?.base_url || '');
    const [temperature, setTemperature] = useState(config?.temperature ?? 0.7);
    const [maxTokens, setMaxTokens] = useState(config?.max_tokens ?? 4096);
    const [apiKey, setApiKey] = useState('');
    const [useDefaultKey, setUseDefaultKey] = useState(config?.use_default_key ?? (agentType !== 'default'));
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const currentProvider = providers[provider];

    // Update form when config changes
    useEffect(() => {
        console.log('AgentConfigForm: config changed', { agentType, config, provider: config?.provider });
        if (config) {
            setProvider(config.provider || '');
            setModel(config.model || '');
            setBaseUrl(config.base_url || '');
            setTemperature(config.temperature ?? 0.7);
            setMaxTokens(config.max_tokens ?? 4096);
            setUseDefaultKey(config.use_default_key ?? (agentType !== 'default'));
        } else {
            // No config - leave empty for new orgs
            setProvider('');
            setModel('');
            setBaseUrl('');
            setTemperature(0.7);
            setMaxTokens(4096);
            setUseDefaultKey(agentType !== 'default');
        }
        setApiKey('');
        setTestResult(null);
    }, [agentType, config]);

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            const res = await fetch(`/api/organizations/${user?.organization_id}/agent-configs/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({
                    provider,
                    model,
                    base_url: baseUrl,
                    api_key: apiKey || undefined
                })
            });

            const data = await res.json();
            setTestResult({
                success: data.success,
                message: data.message
            });
        } catch (error) {
            setTestResult({
                success: false,
                message: 'Connection test failed'
            });
        } finally {
            setTesting(false);
        }
    };

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
                        base_url: baseUrl,
                        temperature,
                        max_tokens: maxTokens,
                        api_key: useDefaultKey ? undefined : apiKey,
                        use_default_key: useDefaultKey
                    })
                }
            );

            if (res.ok) {
                setTestResult({ success: true, message: 'Configuration saved successfully!' });
                onSave();
            } else {
                const error = await res.json();
                setTestResult({ success: false, message: 'Failed to save: ' + error.error });
            }
        } catch (error) {
            setTestResult({ success: false, message: 'Failed to save configuration' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (agentType === 'default') {
            alert('Cannot delete default configuration');
            return;
        }

        if (!confirm(`Delete configuration for ${agentInfo?.name}? It will use the default configuration instead.`)) {
            return;
        }

        try {
            const res = await fetch(
                `/api/organizations/${user?.organization_id}/agent-configs/${agentType}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
                }
            );

            if (res.ok) {
                onSave();
            }
        } catch (error) {
            console.error('Failed to delete config:', error);
        }
    };

    return (
        <div className="bg-background rounded-lg p-6 border border-border">
            <h3 className="font-semibold text-lg mb-1">{agentInfo?.name || agentType}</h3>
            <p className="text-sm text-text-secondary mb-6">{agentInfo?.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider */}
                <div>
                    <label className="block text-sm font-medium mb-1">Provider</label>
                    <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="">Select a provider...</option>
                        {Object.entries(providers).map(([key, prov]) => (
                            <option key={key} value={key}>{prov.name}</option>
                        ))}
                    </select>
                    {currentProvider?.description && (
                        <p className="text-xs text-text-secondary mt-1">{currentProvider.description}</p>
                    )}
                </div>

                {/* Model */}
                <div>
                    <label className="block text-sm font-medium mb-1">Model</label>
                    <input
                        type="text"
                        list={`model-options-${agentType}`}
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="Enter or select a model"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-primary/50"
                    />
                    <datalist id={`model-options-${agentType}`}>
                        {/* Provider-specific models */}
                        {currentProvider?.llm_models?.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                        {/* Common models for all providers */}
                        {provider === 'openai' && (
                            <>
                                <option value="gpt-4o">GPT-4o (Latest)</option>
                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                <option value="gpt-4">GPT-4</option>
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                <option value="o1-preview">O1 Preview</option>
                                <option value="o1-mini">O1 Mini</option>
                            </>
                        )}
                        {provider === 'google' && (
                            <>
                                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Exp)</option>
                                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                            </>
                        )}
                        {provider === 'azure' && (
                            <>
                                <option value="gpt-4">GPT-4 (Azure)</option>
                                <option value="gpt-4-turbo">GPT-4 Turbo (Azure)</option>
                                <option value="gpt-35-turbo">GPT-3.5 Turbo (Azure)</option>
                            </>
                        )}
                        {provider === 'litellm' && (
                            <>
                                <option value="gemini-flash">Gemini Flash</option>
                                <option value="gemini-pro">Gemini Pro</option>
                                <option value="gpt-4">GPT-4 via LiteLLM</option>
                                <option value="claude-3-opus">Claude 3 Opus</option>
                                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                            </>
                        )}
                    </datalist>
                    <p className="text-xs text-text-secondary mt-1">
                        Select from suggestions or type a custom model name
                    </p>
                </div>

                {/* Base URL (for LiteLLM) */}
                {provider === 'litellm' && (
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">LiteLLM Proxy URL</label>
                        <input
                            type="url"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://litellm.tarento.dev"
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                )}

                {/* Temperature */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Temperature: {temperature.toFixed(2)}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-text-secondary">
                        <span>Precise</span>
                        <span>Creative</span>
                    </div>
                </div>

                {/* Max Tokens */}
                <div>
                    <label className="block text-sm font-medium mb-1">Max Tokens</label>
                    <input
                        type="number"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                        min="100"
                        max="32000"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                {/* Use Default Key */}
                {agentType !== 'default' && (
                    <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useDefaultKey}
                                onChange={(e) => setUseDefaultKey(e.target.checked)}
                                className="rounded border-border"
                            />
                            <span className="text-sm">Use default organization API key</span>
                        </label>
                    </div>
                )}

                {/* API Key */}
                {(!useDefaultKey || agentType === 'default') && provider && (
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">
                            API Key {config && ' (leave blank to keep existing)'}
                        </label>
                        <input
                            type="password"
                            name={`api-key-${agentType}-${Date.now()}`}
                            autoComplete="off"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={config?.id ? '••••••••' : 'Enter API key'}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                )}
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${testResult.success
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-error/10 text-error border border-error/20'
                    }`}>
                    {testResult.success ? (
                        <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                        <XCircleIcon className="h-5 w-5" />
                    )}
                    <span className="text-sm">{testResult.message}</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
                <button
                    onClick={handleSave}
                    disabled={saving || !model}
                    className="btn btn-primary"
                >
                    {saving ? (
                        <>
                            <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                        </>
                    ) : 'Save Configuration'}
                </button>
                <button
                    onClick={handleTest}
                    disabled={testing || !apiKey}
                    className="btn btn-secondary"
                >
                    {testing ? (
                        <>
                            <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                            Testing...
                        </>
                    ) : (
                        <>
                            <BeakerIcon className="h-4 w-4 mr-2" />
                            Test Connection
                        </>
                    )}
                </button>
                {config && agentType !== 'default' && (
                    <button
                        onClick={handleDelete}
                        className="btn btn-ghost text-error hover:bg-error/10"
                    >
                        Reset to Default
                    </button>
                )}
            </div>
        </div>
    );
}
