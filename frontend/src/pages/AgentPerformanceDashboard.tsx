import { useState, useEffect } from 'react';
import {
    CpuChipIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface AgentStats {
    agent_name: string;
    total_executions: number;
    successful: number;
    failed: number;
    success_rate: number;
    avg_execution_time_ms: number;
    errors: { time: string; message: string }[];
}

interface PerformanceData {
    summary: {
        total_executions: number;
        successful: number;
        failed: number;
        overall_success_rate: number;
        avg_execution_time_ms: number;
        period_days: number;
    };
    by_agent: AgentStats[];
    recent_executions: {
        id: number;
        agent_name: string;
        step_name: string;
        execution_time_ms: number;
        success: boolean;
        error_message: string | null;
        created_at: string;
    }[];
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

export default function AgentPerformanceDashboard() {
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);

    useEffect(() => {
        loadData();
    }, [days]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/analytics/agent-performance?days=${days}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) throw new Error('Failed to load data');
            setData(await response.json());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600">{error || 'No data'}</p>
                <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">
                    Retry
                </button>
            </div>
        );
    }

    const { summary, by_agent, recent_executions } = data;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Agent Performance</h1>
                    <p className="text-text-muted">AI agent execution metrics and observability</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="px-3 py-2 border border-border rounded-lg bg-white text-sm"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowPathIcon className="h-5 w-5 text-text-muted" />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-border p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <CpuChipIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-text-muted">Total Executions</p>
                            <p className="text-2xl font-bold">{summary.total_executions.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-text-muted">Success Rate</p>
                            <p className="text-2xl font-bold">{summary.overall_success_rate}%</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <XCircleIcon className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-text-muted">Failed</p>
                            <p className="text-2xl font-bold">{summary.failed}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <ClockIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-text-muted">Avg Time</p>
                            <p className="text-2xl font-bold">{formatDuration(summary.avg_execution_time_ms)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Agent Breakdown */}
            <div className="bg-white rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-4">Performance by Agent</h2>
                {by_agent.length === 0 ? (
                    <p className="text-text-muted text-center py-8">No agent executions recorded</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-text-muted">Agent</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-text-muted">Executions</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-text-muted">Success Rate</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-text-muted">Avg Time</th>
                                    <th className="text-center py-3 px-4 text-sm font-medium text-text-muted">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {by_agent.map((agent) => (
                                    <tr key={agent.agent_name} className="border-b border-border hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <span className="font-medium">{agent.agent_name}</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">{agent.total_executions}</td>
                                        <td className="py-3 px-4 text-right">
                                            <span className={`font-medium ${agent.success_rate >= 95 ? 'text-green-600' :
                                                    agent.success_rate >= 80 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {agent.success_rate}%
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">{formatDuration(agent.avg_execution_time_ms)}</td>
                                        <td className="py-3 px-4 text-center">
                                            {agent.failed > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                                                    <ExclamationTriangleIcon className="h-3 w-3" />
                                                    {agent.failed} errors
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                                    <CheckCircleIcon className="h-3 w-3" />
                                                    Healthy
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Recent Executions */}
            <div className="bg-white rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Executions</h2>
                {recent_executions.length === 0 ? (
                    <p className="text-text-muted text-center py-8">No recent executions</p>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {recent_executions.map((exec) => (
                            <div key={exec.id} className={`p-3 rounded-lg border ${exec.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {exec.success ? (
                                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                        ) : (
                                            <XCircleIcon className="h-5 w-5 text-red-600" />
                                        )}
                                        <div>
                                            <span className="font-medium">{exec.agent_name}</span>
                                            {exec.step_name && (
                                                <span className="text-text-muted ml-2">• {exec.step_name}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-text-muted">
                                        {exec.execution_time_ms && (
                                            <span>{formatDuration(exec.execution_time_ms)}</span>
                                        )}
                                        <span>{new Date(exec.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                                {exec.error_message && (
                                    <p className="mt-2 text-sm text-red-600 ml-8">{exec.error_message}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
