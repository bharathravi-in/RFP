import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
    CpuChipIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    BeakerIcon,
    KeyIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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

interface AIProviderSetupProps {
    onConfigured: () => void;
}

export default function AIProviderSetup({ onConfigured }: AIProviderSetupProps) {
    const { user } = useAuthStore();
    const [providers, setProviders] = useState<Record<string, Provider>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Form State
    const [provider, setProvider] = useState('google'); // Default to Google
    const [model, setModel] = useState('gemini-1.5-flash');
    const [apiKey, setApiKey] = useState('');
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (user?.organization_id) {
            loadProviders();
        }
    }, [user?.organization_id]);

    const loadProviders = async () => {
        if (!user?.organization_id) return;
        setLoading(true);
        try {
            const providerRes = await fetch(`/api/organizations/${user.organization_id}/ai-config/providers`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (providerRes.ok) {
                const data = await providerRes.json();
                setProviders(data.providers || {});
            }

            // Check if already configured
            const configRes = await fetch(`/api/organizations/${user.organization_id}/agent-configs/default`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (configRes.ok) {
                const data = await configRes.json();
                if (data.config) {
                    setProvider(data.config.provider || 'google');
                    setModel(data.config.model || 'gemini-1.5-flash');
                    // We don't load the API key for security, but we know it exists if config exists
                    if (!data.using_default) {
                        // It's configured
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load AI providers:', error);
            toast.error('Failed to load AI providers');
        } finally {
            setLoading(false);
        }
    };

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
                    api_key: apiKey
                })
            });

            const data = await res.json();
            setTestResult({
                success: data.success,
                message: data.message
            });

            if (data.success) {
                toast.success('Connection successful!');
            } else {
                toast.error('Connection failed: ' + data.message);
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: 'Connection test failed'
            });
            toast.error('Connection test failed');
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!apiKey && !testResult?.success) {
            // If they haven't tested and haven't entered options, warn them? 
            // Actually, allow saving if they want, but key is required if not previously set.
        }

        setSaving(true);
        try {
            const res = await fetch(
                `/api/organizations/${user?.organization_id}/agent-configs/default`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    },
                    body: JSON.stringify({
                        provider,
                        model,
                        api_key: apiKey,
                        temperature: 0.7,
                        max_tokens: 4096,
                        use_default_key: false
                    })
                }
            );

            if (res.ok) {
                toast.success('AI Configuration saved successfully!');
                onConfigured();
            } else {
                const error = await res.json();
                toast.error('Failed to save: ' + error.error);
            }
        } catch (error) {
            toast.error('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-500">Loading providers...</span>
            </div>
        );
    }

    const currentProvider = providers[provider];

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <CpuChipIcon className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Configure AI Provider</h3>
                    <p className="text-sm text-gray-500">Select which AI model to use for your organization.</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Provider Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(providers).map(([key, prov]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => {
                                    setProvider(key);
                                    // Set default model if available and model is empty or from previous provider
                                    if (prov.llm_models && prov.llm_models.length > 0) {
                                        setModel(prov.llm_models[0].value);
                                    } else {
                                        setModel('');
                                    }
                                }}
                                className={`
                                    flex items-center justify-between p-3 rounded-lg border text-left transition-all
                                    ${provider === key
                                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }
                                `}
                            >
                                <span className="font-medium text-sm text-gray-900">{prov.name}</span>
                                {provider === key && <CheckCircleIcon className="h-5 w-5 text-blue-600" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* API Key Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <KeyIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setTestResult(null);
                            }}
                            placeholder={`Enter your ${currentProvider?.name} API Key`}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                    </div>
                    {currentProvider?.api_key_link && (
                        <p className="mt-1 text-xs text-blue-600">
                            <a href={currentProvider.api_key_link} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                Get your API key here <ArrowPathIcon className="h-3 w-3" />
                            </a>
                        </p>
                    )}
                </div>

                {/* Model Selection (Autocomplete) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                    <div className="relative">
                        <input
                            type="text"
                            list="model-options"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="Select or type model name..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                        <datalist id="model-options">
                            {currentProvider?.llm_models?.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </datalist>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Select from the list or type a custom model name.</p>
                </div>

                {/* Test Result Message */}
                {testResult && (
                    <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {testResult.success ? (
                            <CheckCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        ) : (
                            <XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        )}
                        <span>{testResult.message}</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="mt-8 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={handleTest}
                    disabled={!apiKey || testing}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || (!apiKey && !testResult?.success)} // Require key or successful test (which implies key was present)
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
                >
                    {saving ? (
                        <>
                            <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                        </>
                    ) : (
                        'Save & Continue'
                    )}
                </button>
            </div>
        </div>
    );
}
