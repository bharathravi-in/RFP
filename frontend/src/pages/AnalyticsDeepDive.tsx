import { useState, useEffect } from 'react';
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

export default function AnalyticsDeepDive() {
    const [performance, setPerformance] = useState<ContentPerformance | null>(null);
    const [deepDive, setDeepDive] = useState<WinLossDeepDive | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [perfRes, diveRes] = await Promise.all([
                analyticsApi.getContentPerformance(),
                analyticsApi.getWinLossDeepDive()
            ]);
            setPerformance(perfRes.data);
            setDeepDive(diveRes.data);
        } catch (error) {
            toast.error('Failed to load advanced analytics');
            console.error(error);
        } finally {
            setLoading(false);
        }
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
            {/* Header */}
            <div>
                <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Advanced Insights</h1>
                <p className="text-text-secondary mt-1 text-lg">
                    Discover content ROI and strategic win/loss dimensions
                </p>
            </div>

            {/* Win/Loss Deep Dive Section */}
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
                        <div className="space-y-5">
                            {deepDive?.by_client_type.map((item) => (
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
                    </div>

                    {/* By Industry */}
                    <div className="card-glass p-6">
                        <div className="flex items-center gap-2 mb-6 text-indigo-600">
                            <BriefcaseIcon className="h-5 w-5" />
                            <h3 className="font-bold">By Industry</h3>
                        </div>
                        <div className="space-y-5">
                            {deepDive?.by_industry.map((item) => (
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
                    </div>

                    {/* By Geography */}
                    <div className="card-glass p-6">
                        <div className="flex items-center gap-2 mb-6 text-emerald-600">
                            <GlobeAltIcon className="h-5 w-5" />
                            <h3 className="font-bold">By Geography</h3>
                        </div>
                        <div className="space-y-5">
                            {deepDive?.by_geography.map((item) => (
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
                    </div>
                </div>
            </section>

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
                        <div className="divide-y divide-border">
                            {performance?.category_performance.map((cat) => (
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
                    </div>

                    {/* Top Used Assets */}
                    <div className="card bg-surface overflow-hidden">
                        <div className="p-6 border-b border-border bg-gradient-to-r from-blue-50 to-transparent">
                            <h3 className="font-bold text-text-primary flex items-center gap-2">
                                <ArrowTrendingUpIcon className="h-5 w-5 text-blue-600" />
                                Most Leveraged Assets
                            </h3>
                        </div>
                        <div className="divide-y divide-border">
                            {performance?.top_used.slice(0, 5).map((item) => (
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
                    </div>
                </div>
            </section>
        </div>
    );
}
