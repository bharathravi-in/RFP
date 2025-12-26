import { useState, useEffect } from 'react';
import { analyticsApi } from '@/api/client';
import clsx from 'clsx';
import {
    TrophyIcon,
    XCircleIcon,
    ClockIcon,
    ChartBarIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

interface AnalyticsOverview {
    total_projects: number;
    won: number;
    lost: number;
    pending: number;
    abandoned: number;
    win_rate: number;
    total_won_value: number;
    avg_project_value: number;
}

interface TeamMember {
    user_id: number;
    name: string;
    email: string;
    role: string;
    projects_created: number;
    sections_assigned: number;
    sections_completed: number;
    answers_created: number;
    completion_rate: number;
}

interface LossReason {
    reason: string;
    count: number;
}

// ==============================
// Win Rate Donut Chart
// ==============================

export function WinRateChart() {
    const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const response = await analyticsApi.getOverview();
            setOverview(response.data.overview);
        } catch (error) {
            console.error('Failed to load overview:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-4 skeleton w-1/3 mb-4" />
                <div className="h-40 skeleton rounded-full w-40 mx-auto" />
            </div>
        );
    }

    if (!overview) return null;

    const total = overview.won + overview.lost + overview.pending;
    const wonPercent = total > 0 ? (overview.won / total) * 100 : 0;
    const lostPercent = total > 0 ? (overview.lost / total) * 100 : 0;
    const pendingPercent = total > 0 ? (overview.pending / total) * 100 : 0;

    // SVG donut chart
    const size = 160;
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const wonDash = (wonPercent / 100) * circumference;
    const lostDash = (lostPercent / 100) * circumference;
    const pendingDash = (pendingPercent / 100) * circumference;

    const wonOffset = 0;
    const lostOffset = -wonDash;
    const pendingOffset = -(wonDash + lostDash);

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary">Win Rate</h3>
                <div className={clsx(
                    'flex items-center gap-1 text-sm font-medium',
                    overview.win_rate >= 50 ? 'text-green-600' : 'text-red-600'
                )}>
                    {overview.win_rate >= 50 ? (
                        <ArrowTrendingUpIcon className="h-4 w-4" />
                    ) : (
                        <ArrowTrendingDownIcon className="h-4 w-4" />
                    )}
                    {overview.win_rate}%
                </div>
            </div>

            <div className="flex items-center justify-center mb-4">
                <div className="relative">
                    <svg width={size} height={size} className="transform -rotate-90">
                        {/* Background circle */}
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            className="text-background"
                        />
                        {/* Won segment */}
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${wonDash} ${circumference}`}
                            strokeDashoffset={wonOffset}
                            strokeLinecap="round"
                        />
                        {/* Lost segment */}
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${lostDash} ${circumference}`}
                            strokeDashoffset={lostOffset}
                            strokeLinecap="round"
                        />
                        {/* Pending segment */}
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${pendingDash} ${circumference}`}
                            strokeDashoffset={pendingOffset}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-text-primary">{total}</span>
                        <span className="text-xs text-text-muted">Total</span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm font-medium text-text-primary">{overview.won}</span>
                    </div>
                    <span className="text-xs text-text-muted">Won</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm font-medium text-text-primary">{overview.lost}</span>
                    </div>
                    <span className="text-xs text-text-muted">Lost</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium text-text-primary">{overview.pending}</span>
                    </div>
                    <span className="text-xs text-text-muted">Pending</span>
                </div>
            </div>
        </div>
    );
}

// ==============================
// Revenue Stats Card
// ==============================

export function RevenueStatsCard() {
    const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        analyticsApi.getOverview()
            .then(res => setOverview(res.data.overview))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-4 skeleton w-1/2 mb-4" />
                <div className="h-8 skeleton w-3/4" />
            </div>
        );
    }

    if (!overview) return null;

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
    };

    return (
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                    <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-text-primary">Won Revenue</h3>
                    <p className="text-xs text-text-muted">Total contract value</p>
                </div>
            </div>
            <div className="text-3xl font-bold text-green-600 mb-2">
                {formatCurrency(overview.total_won_value)}
            </div>
            <div className="text-sm text-text-secondary">
                Avg. project: {formatCurrency(overview.avg_project_value)}
            </div>
        </div>
    );
}

// ==============================
// Team Leaderboard
// ==============================

export function TeamLeaderboard() {
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        analyticsApi.getTeamMetrics()
            .then(res => setTeam(res.data.team_metrics || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-4 skeleton w-1/3 mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 skeleton" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary">Team Leaderboard</h3>
                <ChartBarIcon className="h-5 w-5 text-text-muted" />
            </div>

            {team.length === 0 ? (
                <p className="text-center text-text-muted py-4">No team data available</p>
            ) : (
                <div className="space-y-3">
                    {team.slice(0, 5).map((member, index) => (
                        <div key={member.user_id} className="flex items-center gap-3">
                            <div className={clsx(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                                index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    index === 1 ? 'bg-gray-100 text-gray-700' :
                                        index === 2 ? 'bg-orange-100 text-orange-700' :
                                            'bg-background text-text-muted'
                            )}>
                                {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-text-primary truncate">{member.name}</p>
                                <p className="text-xs text-text-muted">{member.sections_completed} sections completed</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-primary">{member.completion_rate}%</p>
                                <p className="text-xs text-text-muted">completion</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==============================
// Loss Reasons Chart
// ==============================

export function LossReasonsChart() {
    const [reasons, setReasons] = useState<LossReason[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        analyticsApi.getLossReasons()
            .then(res => setReasons(res.data.loss_reasons || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-4 skeleton w-1/3 mb-4" />
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-6 skeleton" />
                    ))}
                </div>
            </div>
        );
    }

    const total = reasons.reduce((sum, r) => sum + r.count, 0);

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary">Loss Reasons</h3>
                <XCircleIcon className="h-5 w-5 text-red-400" />
            </div>

            {reasons.length === 0 ? (
                <p className="text-center text-text-muted py-4">No loss data yet</p>
            ) : (
                <div className="space-y-3">
                    {reasons.map((reason) => {
                        const percent = total > 0 ? (reason.count / total) * 100 : 0;
                        return (
                            <div key={reason.reason}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-text-primary">{reason.reason}</span>
                                    <span className="text-sm font-medium text-text-secondary">{reason.count}</span>
                                </div>
                                <div className="h-2 bg-background rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-red-400 rounded-full transition-all"
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ==============================
// Quick Stats Row
// ==============================

export function QuickStatsRow() {
    const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        analyticsApi.getOverview()
            .then(res => setOverview(res.data.overview))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading || !overview) return null;

    const stats = [
        {
            label: 'Won',
            value: overview.won,
            icon: TrophyIcon,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
        },
        {
            label: 'Lost',
            value: overview.lost,
            icon: XCircleIcon,
            color: 'text-red-600',
            bgColor: 'bg-red-100',
        },
        {
            label: 'Pending',
            value: overview.pending,
            icon: ClockIcon,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            label: 'Win Rate',
            value: `${overview.win_rate}%`,
            icon: ChartBarIcon,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat) => (
                <div key={stat.label} className="card flex items-center gap-3">
                    <div className={clsx('p-2 rounded-lg', stat.bgColor)}>
                        <stat.icon className={clsx('h-5 w-5', stat.color)} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                        <p className="text-xs text-text-muted">{stat.label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
