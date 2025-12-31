import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '@/api/client';
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ChartBarIcon,
    UserGroupIcon,
    GlobeAltIcon,
    BriefcaseIcon,
    SparklesIcon,
    ArrowPathIcon,
    CheckBadgeIcon,
    HandThumbUpIcon,
    CalendarDaysIcon,
    ArrowDownTrayIcon,
    FolderOpenIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ContentPerformance {
    top_used: any[];
    best_rated: any[];
    category_performance: any[];
}

interface WinLossDeepDive {
    by_client_type: any[];
    by_industry: any[];
    by_geography: any[];
}

interface WinRateTrend {
    months: { month: string; win_rate: number; won: number; lost: number; total: number }[];
}

type DateRange = '7d' | '30d' | '90d' | 'year' | 'all';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: 'All Time' },
];

export default function AnalyticsDeepDive() {
    const [performance, setPerformance] = useState<ContentPerformance | null>(null);
    const [deepDive, setDeepDive] = useState<WinLossDeepDive | null>(null);
    const [winTrend, setWinTrend] = useState<WinRateTrend | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>('all');

    useEffect(() => {
        loadData();
    }, [dateRange]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [perfRes, diveRes, trendRes] = await Promise.all([
                analyticsApi.getContentPerformance(),
                analyticsApi.getWinLossDeepDive(),
                analyticsApi.getWinRateTrend()
            ]);
            setPerformance(perfRes.data);
            setDeepDive(diveRes.data);
            setWinTrend(trendRes.data);
        } catch (error) {
            toast.error('Failed to load advanced analytics');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!deepDive) return;

        // Build CSV content
        let csvContent = 'Win/Loss Analysis by Dimension\n\n';

        csvContent += 'By Client Type\nName,Won,Total,Win Rate\n';
        deepDive.by_client_type.forEach(item => {
            csvContent += `${item.name},${item.won},${item.total},${item.win_rate}%\n`;
        });

        csvContent += '\nBy Industry\nName,Won,Total,Win Rate\n';
        deepDive.by_industry.forEach(item => {
            csvContent += `${item.name},${item.won},${item.total},${item.win_rate}%\n`;
        });

        csvContent += '\nBy Geography\nName,Won,Total,Win Rate\n';
        deepDive.by_geography.forEach(item => {
            csvContent += `${item.name},${item.won},${item.total},${item.win_rate}%\n`;
        });

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Analytics exported successfully');
    };

    const hasNoData = () => {
        return (!deepDive?.by_client_type.length &&
            !deepDive?.by_industry.length &&
            !deepDive?.by_geography.length);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <ArrowPathIcon className="h-12 w-12 animate-spin text-primary opacity-50" />
                <p className="text-text-muted animate-pulse font-medium">Synthesizing deep insights...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12 animate-fade-in">
            {/* Header with Date Range Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Advanced Insights</h1>
                    <p className="text-text-secondary mt-1 text-lg">
                        Discover content ROI and strategic win/loss dimensions
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Date Range Filter */}
                    <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                        <CalendarDaysIcon className="h-4 w-4 text-text-muted" />
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as DateRange)}
                            className="bg-transparent text-sm font-medium text-text-primary focus:outline-none cursor-pointer"
                        >
                            {DATE_RANGE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* Export Button */}
                    <button
                        onClick={exportToCSV}
                        disabled={hasNoData()}
                        className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        <span className="text-sm font-medium hidden sm:inline">Export</span>
                    </button>
                    {/* Refresh Button */}
                    <button
                        onClick={loadData}
                        className="p-2 bg-surface border border-border rounded-lg hover:bg-background transition-colors"
                        title="Refresh data"
                    >
                        <ArrowPathIcon className="h-4 w-4 text-text-muted" />
                    </button>
                </div>
            </div>

            {/* Win Rate Trend Chart */}
            {winTrend && winTrend.months && winTrend.months.length > 0 && (
                <section className="card-glass p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <ArrowTrendingUpIcon className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-text-primary">Win Rate Trend</h3>
                    </div>
                    <div className="flex items-end gap-1 h-32">
                        {winTrend.months.slice(-12).map((month, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                    className="w-full bg-gradient-to-t from-primary to-indigo-400 rounded-t-sm transition-all hover:from-primary-600 hover:to-indigo-500"
                                    style={{ height: `${Math.max(month.win_rate, 5)}%` }}
                                    title={`${month.month}: ${month.win_rate}% (${month.won}/${month.total})`}
                                />
                                <span className="text-[10px] text-text-muted truncate w-full text-center">
                                    {month.month.slice(0, 3)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Empty State */}
            {hasNoData() && (
                <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 p-8 text-center">
                    <FolderOpenIcon className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-text-primary mb-2">No Analytics Data Yet</h3>
                    <p className="text-text-secondary mb-6 max-w-md mx-auto">
                        Analytics will appear once you have projects with outcomes. Mark your proposals as Won or Lost to start tracking performance.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link
                            to="/projects"
                            className="btn-primary flex items-center gap-2"
                        >
                            <FolderOpenIcon className="h-4 w-4" />
                            View Projects
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-text-muted">
                            <InformationCircleIcon className="h-4 w-4" />
                            Set project outcomes to populate analytics
                        </div>
                    </div>
                </div>
            )}

            {/* Win/Loss Deep Dive Section */}
            {!hasNoData() && (
                <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <ChartBarIcon className="h-6 w-6 text-primary" />
                        <h2 className="text-xl font-bold text-text-primary uppercase tracking-wider text-sm">Strategic Win/Loss Analysis</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* By Client Type */}
                        <div className="card-glass p-6">
                            <div className="flex items-center gap-2 mb-6 text-primary">
                                <UserGroupIcon className="h-5 w-5" />
                                <h3 className="font-bold">By Client Type</h3>
                            </div>
                            {deepDive?.by_client_type.length ? (
                                <div className="space-y-5">
                                    {deepDive.by_client_type.map((item) => (
                                        <div key={item.name} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium text-text-primary capitalize">{item.name}</span>
                                                <span className="text-primary font-bold">{item.win_rate}% Win Rate</span>
                                            </div>
                                            <div className="h-2 bg-background/50 rounded-full overflow-hidden border border-border/10">
                                                <div
                                                    className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(var(--color-primary-500),0.5)]"
                                                    style={{ width: `${item.win_rate || 0}%` }}
                                                />
                                            </div>
                                            <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest text-right">
                                                {item.won} Wins / {item.total} Total
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-muted text-sm text-center py-4">No data available</p>
                            )}
                        </div>

                        {/* By Industry */}
                        <div className="card-glass p-6">
                            <div className="flex items-center gap-2 mb-6 text-indigo-600">
                                <BriefcaseIcon className="h-5 w-5" />
                                <h3 className="font-bold">By Industry</h3>
                            </div>
                            {deepDive?.by_industry.length ? (
                                <div className="space-y-5">
                                    {deepDive.by_industry.map((item) => (
                                        <div key={item.name} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium text-text-primary">{item.name}</span>
                                                <span className="text-indigo-600 font-bold">{item.win_rate}%</span>
                                            </div>
                                            <div className="h-2 bg-background/50 rounded-full overflow-hidden border border-border/10">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full"
                                                    style={{ width: `${item.win_rate || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-muted text-sm text-center py-4">No data available</p>
                            )}
                        </div>

                        {/* By Geography */}
                        <div className="card-glass p-6">
                            <div className="flex items-center gap-2 mb-6 text-emerald-600">
                                <GlobeAltIcon className="h-5 w-5" />
                                <h3 className="font-bold">By Geography</h3>
                            </div>
                            {deepDive?.by_geography.length ? (
                                <div className="space-y-5">
                                    {deepDive.by_geography.map((item) => (
                                        <div key={item.name} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium text-text-primary uppercase tracking-wider text-xs">{item.name}</span>
                                                <span className="text-emerald-600 font-bold">{item.win_rate}%</span>
                                            </div>
                                            <div className="h-2 bg-background/50 rounded-full overflow-hidden border border-border/10">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full"
                                                    style={{ width: `${item.win_rate || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-muted text-sm text-center py-4">No data available</p>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Content Performance Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <SparklesIcon className="h-6 w-6 text-amber-500" />
                    <h2 className="text-xl font-bold text-text-primary uppercase tracking-wider text-sm">Content ROI & Performance</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Top Performing Categories */}
                    <div className="card bg-surface overflow-hidden">
                        <div className="p-6 border-b border-border bg-gradient-to-r from-amber-50 to-transparent">
                            <h3 className="font-bold text-text-primary flex items-center gap-2">
                                <CheckBadgeIcon className="h-5 w-5 text-amber-600" />
                                Category Impact Score
                            </h3>
                        </div>
                        {performance?.category_performance.length ? (
                            <div className="divide-y divide-border">
                                {performance.category_performance.map((cat) => (
                                    <div key={cat.category} className="p-4 flex items-center justify-between hover:bg-background/40 transition-colors">
                                        <div>
                                            <p className="font-bold text-text-primary">{cat.category}</p>
                                            <p className="text-xs text-text-muted">{cat.count} items • used {cat.total_usage} times</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-green-600 font-bold">
                                                <HandThumbUpIcon className="h-4 w-4" />
                                                {cat.helpfulness_rate}%
                                            </div>
                                            <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Helpfulness Score</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-text-muted">
                                <p>No category performance data yet</p>
                            </div>
                        )}
                    </div>

                    {/* Top Used Assets */}
                    <div className="card bg-surface overflow-hidden">
                        <div className="p-6 border-b border-border bg-gradient-to-r from-blue-50 to-transparent">
                            <h3 className="font-bold text-text-primary flex items-center gap-2">
                                <ArrowTrendingUpIcon className="h-5 w-5 text-blue-600" />
                                Most Leveraged Assets
                            </h3>
                        </div>
                        {performance?.top_used.length ? (
                            <div className="divide-y divide-border">
                                {performance.top_used.slice(0, 5).map((item) => (
                                    <div key={item.id} className="p-4 space-y-2 hover:bg-background/40 transition-colors">
                                        <p className="text-sm font-medium text-text-primary line-clamp-1">{item.question_text}</p>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1 text-xs text-text-secondary">
                                                <ArrowPathIcon className="h-3 w-3" />
                                                Used {item.times_used}x
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                                <CheckBadgeIcon className="h-3 w-3" />
                                                {item.times_helpful} helpful
                                            </div>
                                            <span className="text-[10px] text-text-muted bg-background px-2 py-0.5 rounded-full border border-border ml-auto">
                                                {item.category}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-text-muted">
                                <p>No asset performance data yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
