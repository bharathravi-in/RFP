/**
 * Revenue Tracking Dashboard Component
 * 
 * Displays revenue pipeline, win/loss analytics, and forecasting.
 */
import { useState, useEffect } from 'react';
import {
    CurrencyDollarIcon,
    ChartBarIcon,
    TrophyIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CalendarIcon,
    UserCircleIcon,
    ArrowPathIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface PipelineData {
    total_value: number;
    weighted_value: number;
    total_opportunities: number;
    by_stage: Record<string, { count: number; total_value: number; weighted_value: number }>;
}

interface DashboardData {
    period: string;
    total_won_value: number;
    total_lost_value: number;
    total_pipeline_value: number;
    weighted_pipeline_value: number;
    proposals_won: number;
    proposals_lost: number;
    proposals_open: number;
    win_rate_percent: number;
    avg_deal_size: number;
    by_contract_type: Record<string, { count: number; value: number }>;
}

interface TrendData {
    month: string;
    month_name: string;
    won_value: number;
    won_count: number;
    lost_value: number;
    lost_count: number;
    win_rate: number;
}

const STAGE_COLORS: Record<string, string> = {
    qualification: 'bg-blue-500',
    proposal: 'bg-purple-500',
    negotiation: 'bg-amber-500',
    closed: 'bg-green-500',
};

export default function RevenueTrackingSection() {
    const [pipeline, setPipeline] = useState<PipelineData | null>(null);
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('quarter');

    useEffect(() => {
        fetchData();
    }, [period]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('access_token');
            
            // Fetch all data in parallel
            const [pipelineRes, dashboardRes, trendsRes] = await Promise.all([
                fetch('/api/revenue/pipeline', { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`/api/revenue/dashboard?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/revenue/trends', { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (pipelineRes.ok) {
                const data = await pipelineRes.json();
                setPipeline(data.pipeline);
            } else {
                setPipeline(null);
            }
            
            if (dashboardRes.ok) {
                const data = await dashboardRes.json();
                setDashboard(data.dashboard);
            } else {
                setDashboard(null);
            }
            
            if (trendsRes.ok) {
                const data = await trendsRes.json();
                setTrends(data.trends || []);
            } else {
                setTrends([]);
            }
        } catch (error) {
            console.error('Failed to fetch revenue data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const maxTrendValue = Math.max(...trends.map(t => Math.max(t.won_value, t.lost_value)));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-text-primary">Revenue Tracking</h2>
                    <p className="text-sm text-text-secondary">
                        Monitor your proposal pipeline and revenue performance
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {(['month', 'quarter', 'year'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={clsx(
                                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                                period === p
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            )}
                        >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-surface rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <TrophyIcon className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="text-sm text-text-secondary">Won Revenue</span>
                    </div>
                    <div className="text-2xl font-bold text-text-primary">
                        {formatCurrency(dashboard?.total_won_value || 0)}
                    </div>
                    <div className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <ArrowTrendingUpIcon className="h-4 w-4" />
                        {dashboard?.proposals_won || 0} deals won
                    </div>
                </div>

                <div className="bg-surface rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FunnelIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-sm text-text-secondary">Pipeline Value</span>
                    </div>
                    <div className="text-2xl font-bold text-text-primary">
                        {formatCurrency(pipeline?.total_value || 0)}
                    </div>
                    <div className="text-sm text-blue-600 mt-1">
                        {pipeline?.total_opportunities || 0} open opportunities
                    </div>
                </div>

                <div className="bg-surface rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <ChartBarIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <span className="text-sm text-text-secondary">Win Rate</span>
                    </div>
                    <div className="text-2xl font-bold text-text-primary">
                        {dashboard?.win_rate_percent?.toFixed(1) || 0}%
                    </div>
                    <div className="text-sm text-text-secondary mt-1">
                        {dashboard?.proposals_won || 0}W / {dashboard?.proposals_lost || 0}L
                    </div>
                </div>

                <div className="bg-surface rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <CurrencyDollarIcon className="h-5 w-5 text-amber-600" />
                        </div>
                        <span className="text-sm text-text-secondary">Avg Deal Size</span>
                    </div>
                    <div className="text-2xl font-bold text-text-primary">
                        {formatCurrency(dashboard?.avg_deal_size || 0)}
                    </div>
                    <div className="text-sm text-text-secondary mt-1">
                        Per closed deal
                    </div>
                </div>
            </div>

            {/* Pipeline Funnel */}
            <div className="bg-surface rounded-xl border border-border p-6">
                <h3 className="font-semibold text-text-primary mb-4">Pipeline by Stage</h3>
                <div className="space-y-3">
                    {pipeline?.by_stage && Object.entries(pipeline.by_stage).map(([stage, data]: [string, { count: number; total_value: number; weighted_value: number }]) => (
                        <div key={stage} className="flex items-center gap-4">
                            <div className="w-32 text-sm font-medium text-text-primary capitalize">
                                {stage.replace('_', ' ')}
                            </div>
                            <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                                <div
                                    className={clsx(
                                        'h-full transition-all duration-500',
                                        STAGE_COLORS[stage] || 'bg-gray-500'
                                    )}
                                    style={{
                                        width: `${(data.total_value / (pipeline.total_value || 1)) * 100}%`
                                    }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-3">
                                    <span className="text-sm font-medium text-white drop-shadow">
                                        {data.count} deals
                                    </span>
                                    <span className="text-sm font-medium text-text-primary">
                                        {formatCurrency(data.total_value)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Revenue Trend Chart */}
            <div className="bg-surface rounded-xl border border-border p-6">
                <h3 className="font-semibold text-text-primary mb-4">Revenue Trend (Last 6 Months)</h3>
                <div className="flex items-end gap-4 h-48">
                    {trends.slice(-6).map((trend, index) => (
                        <div key={trend.month} className="flex-1 flex flex-col items-center">
                            <div className="flex-1 w-full flex items-end gap-1 justify-center">
                                {/* Won bar */}
                                <div
                                    className="w-1/3 bg-green-500 rounded-t transition-all duration-300"
                                    style={{
                                        height: `${(trend.won_value / maxTrendValue) * 100}%`,
                                        minHeight: trend.won_value > 0 ? '4px' : '0'
                                    }}
                                    title={`Won: ${formatCurrency(trend.won_value)}`}
                                />
                                {/* Lost bar */}
                                <div
                                    className="w-1/3 bg-red-400 rounded-t transition-all duration-300"
                                    style={{
                                        height: `${(trend.lost_value / maxTrendValue) * 100}%`,
                                        minHeight: trend.lost_value > 0 ? '4px' : '0'
                                    }}
                                    title={`Lost: ${formatCurrency(trend.lost_value)}`}
                                />
                            </div>
                            <div className="mt-2 text-xs text-text-secondary text-center">
                                {trend.month_name.split(' ')[0]}
                            </div>
                            <div className="text-xs text-text-muted">
                                {trend.win_rate.toFixed(0)}%
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded" />
                        <span className="text-text-secondary">Won</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-400 rounded" />
                        <span className="text-text-secondary">Lost</span>
                    </div>
                </div>
            </div>

            {/* By Contract Type */}
            {dashboard?.by_contract_type && Object.keys(dashboard.by_contract_type).length > 0 && (
                <div className="bg-surface rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-text-primary mb-4">Revenue by Contract Type</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {Object.entries(dashboard.by_contract_type).map(([type, data]: [string, { count: number; value: number }]) => (
                            <div key={type} className="p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm font-medium text-text-primary capitalize mb-1">
                                    {type.replace('_', ' ')}
                                </div>
                                <div className="text-xl font-bold text-primary">
                                    {formatCurrency(data.value)}
                                </div>
                                <div className="text-xs text-text-secondary">
                                    {data.count} deal{data.count !== 1 ? 's' : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
