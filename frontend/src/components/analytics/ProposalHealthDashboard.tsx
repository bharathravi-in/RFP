import { useState, useEffect } from 'react';
import { analyticsApi } from '@/api/client';
import {
    HeartIcon,
    UserIcon,
    ExclamationCircleIcon,
    ShieldCheckIcon,
    ArrowPathIcon,
    ClockIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface HealthData {
    completion_percentage: number;
    total_questions: number;
    answered_count: number;
    owners_breakdown: Array<{
        name: string;
        total: number;
        answered: number;
        pending: number;
    }>;
    bottlenecks: Array<{
        name: string;
        pending: number;
    }>;
    verification_health: number;
    status: string;
    due_date: string | null;
}

export default function ProposalHealthDashboard({ projectId }: { projectId: number }) {
    const [data, setData] = useState<HealthData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadHealthData = async () => {
        setIsLoading(true);
        try {
            const response = await analyticsApi.getProjectHealth(projectId);
            setData(response.data);
        } catch (error) {
            console.error('Failed to load health data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadHealthData();
    }, [projectId]);

    if (isLoading) {
        return (
            <div className="bg-surface rounded-xl border border-border p-8 animate-pulse">
                <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                    <HeartIcon className="h-6 w-6 text-red-500" />
                    Proposal Health Dashboard
                </h2>
                <button onClick={loadHealthData} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-text-muted">
                    <ArrowPathIcon className="h-5 w-5" />
                </button>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
                    <p className="text-sm text-text-secondary font-medium mb-1">Completion</p>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-primary">{Math.round(data.completion_percentage)}%</span>
                        <span className="text-xs text-text-muted mb-1.5">{data.answered_count}/{data.total_questions}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-1000"
                            style={{ width: `${data.completion_percentage}%` }}
                        />
                    </div>
                </div>

                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
                    <p className="text-sm text-text-secondary font-medium mb-1">Truth Health</p>
                    <div className="flex items-end gap-2">
                        <span className={clsx(
                            "text-3xl font-bold",
                            data.verification_health > 0.8 ? "text-success" : "text-warning"
                        )}>
                            {Math.round(data.verification_health * 100)}%
                        </span>
                        <ShieldCheckIcon className="h-5 w-5 text-text-muted mb-1.5" />
                    </div>
                    <p className="text-[10px] text-text-muted mt-2">AI-verified correctness score</p>
                </div>

                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
                    <p className="text-sm text-text-secondary font-medium mb-1">Due Date</p>
                    <div className="flex items-center gap-2">
                        <ClockIcon className="h-5 w-5 text-indigo-500" />
                        <span className="text-xl font-bold text-text-primary">
                            {data.due_date ? new Date(data.due_date).toLocaleDateString() : 'N/A'}
                        </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-2">Project deadline status</p>
                </div>

                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
                    <p className="text-sm text-text-secondary font-medium mb-1">Status</p>
                    <span className={clsx(
                        "inline-block px-3 py-1 rounded-full text-sm font-bold capitalize",
                        data.status === 'in_progress' ? "bg-blue-100 text-blue-700" :
                            data.status === 'completed' ? "bg-success/20 text-success" : "bg-gray-100 text-gray-700"
                    )}>
                        {data.status?.replace('_', ' ') || 'Unknown'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Owners List */}
                <div className="lg:col-span-2 bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-border bg-gray-50/50">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2 text-sm">
                            <UserIcon className="h-4 w-4" />
                            Completion by Owner
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-text-muted">
                                <tr>
                                    <th className="px-4 py-3">Owner</th>
                                    <th className="px-4 py-3 text-center">Questions</th>
                                    <th className="px-4 py-3 text-center">Progress</th>
                                    <th className="px-4 py-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.owners_breakdown.map((owner, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                                    {owner.name.charAt(0)}
                                                </div>
                                                <span className="text-sm font-medium text-text-primary">{owner.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-text-secondary">
                                            {owner.answered}/{owner.total}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="w-24 h-1.5 bg-gray-100 rounded-full mx-auto overflow-hidden">
                                                <div
                                                    className="h-full bg-primary rounded-full"
                                                    style={{ width: `${(owner.answered / owner.total) * 100}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={clsx(
                                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                owner.pending === 0 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                                            )}>
                                                {owner.pending === 0 ? 'COMPLETE' : `${owner.pending} PENDING`}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bottlenecks Sidebar */}
                <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col">
                    <div className="p-4 border-b border-border bg-gray-50/50">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2 text-sm">
                            <ExclamationCircleIcon className="h-4 w-4 text-warning" />
                            Potential Bottlenecks
                        </h3>
                    </div>
                    <div className="p-4 flex-1 space-y-4">
                        {data.bottlenecks.length > 0 ? (
                            data.bottlenecks.map((b, idx) => (
                                <div key={idx} className="p-3 rounded-lg bg-red-50 border border-red-100">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-red-700">{b.name}</p>
                                            <p className="text-xs text-red-600 mt-1">{b.pending} tasks pending</p>
                                        </div>
                                        <ChartBarIcon className="h-5 w-5 text-red-300" />
                                    </div>
                                    <button className="text-[10px] font-bold text-red-700 mt-3 flex items-center gap-1 hover:underline">
                                        Nudge Contributor <ArrowPathIcon className="h-3 w-3" />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                <ShieldCheckIcon className="h-12 w-12 text-success/30 mb-2" />
                                <p className="text-sm font-medium text-text-primary">No Bottlenecks!</p>
                                <p className="text-xs text-text-muted mt-1">Everyone is moving at pace.</p>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50 border-t border-border mt-auto">
                        <button className="w-full py-2 bg-white border border-border rounded-lg text-xs font-bold text-text-primary hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                            Download Health Report
                            <ChartBarIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
