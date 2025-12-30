import { useState, useEffect } from 'react';
import {
    CpuChipIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    Cog6ToothIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface AgentConfig {
    agent_type: string;
    display_name: string;
    description: string;
    default_model: string;
    selected_model: string;
    available_models: string[];
    timeout_seconds: number;
    max_retries: number;
}

interface CircuitBreakerStatus {
    agent: string;
    state: 'closed' | 'open' | 'half_open';
    failure_count: number;
    success_count: number;
    last_failure: number;
}

const AGENT_CONFIGS: AgentConfig[] = [
    {
        agent_type: 'document_analyzer',
        display_name: 'Document Analyzer',
        description: 'Analyzes RFP documents and extracts structure',
        default_model: 'gpt-4o',
        selected_model: 'gpt-4o',
        available_models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
        timeout_seconds: 120,
        max_retries: 3
    },
    {
        agent_type: 'question_extractor',
        display_name: 'Question Extractor',
        description: 'Extracts questions and requirements from RFPs',
        default_model: 'gpt-4o-mini',
        selected_model: 'gpt-4o-mini',
        available_models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-1.5-flash'],
        timeout_seconds: 90,
        max_retries: 3
    },
    {
        agent_type: 'answer_generator',
        display_name: 'Answer Generator',
        description: 'Generates answers using knowledge base',
        default_model: 'gpt-4o',
        selected_model: 'gpt-4o',
        available_models: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
        timeout_seconds: 90,
        max_retries: 3
    },
    {
        agent_type: 'proposal_writer',
        display_name: 'Proposal Writer',
        description: 'Writes proposal sections with citations',
        default_model: 'gpt-4o',
        selected_model: 'gpt-4o',
        available_models: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
        timeout_seconds: 120,
        max_retries: 3
    },
    {
        agent_type: 'compliance_checker',
        display_name: 'Compliance Checker',
        description: 'Validates compliance requirements',
        default_model: 'gpt-4o-mini',
        selected_model: 'gpt-4o-mini',
        available_models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-haiku'],
        timeout_seconds: 30,
        max_retries: 2
    },
    {
        agent_type: 'quality_reviewer',
        display_name: 'Quality Reviewer',
        description: 'Reviews and scores answer quality',
        default_model: 'gpt-4o-mini',
        selected_model: 'gpt-4o-mini',
        available_models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet'],
        timeout_seconds: 30,
        max_retries: 2
    },
    {
        agent_type: 'win_theme',
        display_name: 'Win Theme Agent',
        description: 'Generates win themes and strategies',
        default_model: 'gpt-4o',
        selected_model: 'gpt-4o',
        available_models: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
        timeout_seconds: 60,
        max_retries: 3
    },
    {
        agent_type: 'competitive_analysis',
        display_name: 'Competitive Analysis',
        description: 'Analyzes competitor positioning',
        default_model: 'gpt-4o',
        selected_model: 'gpt-4o',
        available_models: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
        timeout_seconds: 90,
        max_retries: 3
    }
];

const MODEL_COSTS: Record<string, { input: number; output: number; tier: string }> = {
    'gpt-4o': { input: 2.5, output: 10, tier: 'Premium' },
    'gpt-4o-mini': { input: 0.15, output: 0.6, tier: 'Standard' },
    'claude-3-5-sonnet': { input: 3, output: 15, tier: 'Premium' },
    'claude-3-haiku': { input: 0.25, output: 1.25, tier: 'Economy' },
    'gemini-1.5-pro': { input: 1.25, output: 5, tier: 'Premium' },
    'gemini-1.5-flash': { input: 0.075, output: 0.3, tier: 'Economy' },
    'gemini-2.0-flash-exp': { input: 0, output: 0, tier: 'Free (Preview)' }
};

export default function AgentModelSelector() {
    const [agents, setAgents] = useState<AgentConfig[]>(AGENT_CONFIGS);
    const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchCircuitBreakerStatus();
        const interval = setInterval(fetchCircuitBreakerStatus, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchCircuitBreakerStatus = async () => {
        try {
            const response = await fetch('/api/agents/health/circuit-breakers');
            const data = await response.json();
            setCircuitBreakers(data.circuit_breakers || []);
        } catch (error) {
            console.error('Failed to fetch circuit breaker status:', error);
        }
    };

    const handleModelChange = (agentType: string, model: string) => {
        setAgents(prev => prev.map(agent =>
            agent.agent_type === agentType
                ? { ...agent, selected_model: model }
                : agent
        ));
    };

    const handleTimeoutChange = (agentType: string, timeout: number) => {
        setAgents(prev => prev.map(agent =>
            agent.agent_type === agentType
                ? { ...agent, timeout_seconds: timeout }
                : agent
        ));
    };

    const handleRetryChange = (agentType: string, retries: number) => {
        setAgents(prev => prev.map(agent =>
            agent.agent_type === agentType
                ? { ...agent, max_retries: retries }
                : agent
        ));
    };

    const saveConfiguration = async () => {
        setSaving(true);
        try {
            // Save to backend
            const response = await fetch('/api/settings/agent-configs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agents })
            });

            if (response.ok) {
                toast.success('Agent configuration saved');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            toast.error('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const resetCircuitBreaker = async (agentName: string) => {
        try {
            await fetch(`/api/agents/health/circuit-breakers/${agentName}/reset`, {
                method: 'POST'
            });
            toast.success(`Circuit breaker for ${agentName} reset`);
            fetchCircuitBreakerStatus();
        } catch (error) {
            toast.error('Failed to reset circuit breaker');
        }
    };

    const getCircuitBreakerStatus = (agentType: string): CircuitBreakerStatus | undefined => {
        return circuitBreakers.find(cb => cb.agent === agentType);
    };

    const getStatusColor = (state?: string) => {
        switch (state) {
            case 'closed': return 'text-green-500';
            case 'open': return 'text-red-500';
            case 'half_open': return 'text-yellow-500';
            default: return 'text-gray-400';
        }
    };

    const getStatusIcon = (state?: string) => {
        switch (state) {
            case 'closed': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            case 'open': return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
            case 'half_open': return <ArrowPathIcon className="h-5 w-5 text-yellow-500 animate-spin" />;
            default: return <CheckCircleIcon className="h-5 w-5 text-gray-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <CpuChipIcon className="h-6 w-6 text-indigo-500" />
                    <h2 className="text-xl font-semibold text-gray-900">
                        Per-Agent Model Selection
                    </h2>
                </div>
                <button
                    onClick={saveConfiguration}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                        <Cog6ToothIcon className="h-4 w-4" />
                    )}
                    Save Configuration
                </button>
            </div>

            <p className="text-gray-600">
                Configure which AI model each agent uses. Premium models provide better quality but cost more.
            </p>

            <div className="grid gap-4">
                {agents.map((agent) => {
                    const cbStatus = getCircuitBreakerStatus(agent.agent_type);
                    const modelInfo = MODEL_COSTS[agent.selected_model];

                    return (
                        <div
                            key={agent.agent_type}
                            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {getStatusIcon(cbStatus?.state)}
                                    <div>
                                        <h3 className="font-medium text-gray-900">
                                            {agent.display_name}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {agent.description}
                                        </p>
                                    </div>
                                </div>
                                {cbStatus?.state === 'open' && (
                                    <button
                                        onClick={() => resetCircuitBreaker(agent.agent_type)}
                                        className="text-sm text-red-600 hover:text-red-700"
                                    >
                                        Reset Circuit
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Model Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        AI Model
                                    </label>
                                    <select
                                        value={agent.selected_model}
                                        onChange={(e) => handleModelChange(agent.agent_type, e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        {agent.available_models.map(model => (
                                            <option key={model} value={model}>
                                                {model}
                                            </option>
                                        ))}
                                    </select>
                                    {modelInfo && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            {modelInfo.tier} · ${modelInfo.input}/${modelInfo.output} per 1M tokens
                                        </p>
                                    )}
                                </div>

                                {/* Timeout */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Timeout (seconds)
                                    </label>
                                    <input
                                        type="number"
                                        value={agent.timeout_seconds}
                                        onChange={(e) => handleTimeoutChange(agent.agent_type, parseInt(e.target.value) || 60)}
                                        min={10}
                                        max={300}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                {/* Max Retries */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max Retries
                                    </label>
                                    <select
                                        value={agent.max_retries}
                                        onChange={(e) => handleRetryChange(agent.agent_type, parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value={0}>No retries</option>
                                        <option value={1}>1 retry</option>
                                        <option value={2}>2 retries</option>
                                        <option value={3}>3 retries</option>
                                        <option value={5}>5 retries</option>
                                    </select>
                                </div>

                                {/* Status */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Circuit Status
                                    </label>
                                    <div className={`px-3 py-2 rounded-lg text-sm font-medium ${cbStatus?.state === 'closed' ? 'bg-green-50 text-green-700' :
                                            cbStatus?.state === 'open' ? 'bg-red-50 text-red-700' :
                                                cbStatus?.state === 'half_open' ? 'bg-yellow-50 text-yellow-700' :
                                                    'bg-gray-50 text-gray-700'
                                        }`}>
                                        {cbStatus?.state === 'closed' && '● Healthy'}
                                        {cbStatus?.state === 'open' && `● Open (${cbStatus.failure_count} failures)`}
                                        {cbStatus?.state === 'half_open' && '● Testing...'}
                                        {!cbStatus && '● No data'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Cost Estimation */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                <h3 className="font-medium text-indigo-900 mb-2">
                    Model Tier Legend
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="font-medium text-green-700">🟢 Free (Preview)</span>
                        <p className="text-gray-600">Experimental, may change</p>
                    </div>
                    <div>
                        <span className="font-medium text-blue-700">🔵 Economy</span>
                        <p className="text-gray-600">Fast, low cost</p>
                    </div>
                    <div>
                        <span className="font-medium text-purple-700">🟣 Standard</span>
                        <p className="text-gray-600">Balanced quality/cost</p>
                    </div>
                    <div>
                        <span className="font-medium text-orange-700">🟠 Premium</span>
                        <p className="text-gray-600">Best quality, higher cost</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
