/**
 * Content Freshness Alerts Component
 * Shows alerts for stale knowledge base content that needs updating
 */
import { useState, useEffect } from 'react';
import {
    ExclamationTriangleIcon,
    ClockIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XMarkIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon as ExclamationSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { agentsApi } from '@/api/client';

interface FreshnessAudit {
    item_id: number;
    item_title: string;
    item_category: string;
    freshness_score: number;
    status: 'fresh' | 'stale' | 'outdated' | 'critical';
    last_updated: string;
    issues: string[];
    suggested_updates: string[];
    conflicting_info?: string;
}

interface FreshnessAlertsProps {
    projectId?: number;
    className?: string;
    compact?: boolean;
    onItemClick?: (itemId: number) => void;
}

const STATUS_CONFIG = {
    fresh: {
        color: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: CheckCircleIcon,
        label: 'Fresh',
    },
    stale: {
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: ClockIcon,
        label: 'Needs Review',
    },
    outdated: {
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        icon: ExclamationTriangleIcon,
        label: 'Outdated',
    },
    critical: {
        color: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: ExclamationSolidIcon,
        label: 'Critical',
    },
};

export default function FreshnessAlerts({
    projectId,
    className,
    compact = false,
    onItemClick,
}: FreshnessAlertsProps) {
    const [audits, setAudits] = useState<FreshnessAudit[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
    const [dismissedItems, setDismissedItems] = useState<Set<number>>(new Set());
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        if (projectId) {
            checkFreshness();
        }
    }, [projectId]);

    const checkFreshness = async () => {
        if (!projectId) return;
        
        setLoading(true);
        try {
            const response = await agentsApi.checkFreshness({ project_id: projectId });
            setAudits(response.data.audits || []);
            setLastChecked(new Date());
        } catch (error) {
            console.error('Failed to check freshness:', error);
            // Demo data
            setAudits([
                {
                    item_id: 1,
                    item_title: 'SOC 2 Compliance Statement',
                    item_category: 'Compliance',
                    freshness_score: 0.3,
                    status: 'critical',
                    last_updated: '2024-06-15',
                    issues: [
                        'SOC 2 Type II certification date is outdated',
                        'Missing reference to latest audit report',
                    ],
                    suggested_updates: [
                        'Update certification date to reflect 2024 renewal',
                        'Add link to current audit attestation letter',
                    ],
                    conflicting_info: 'RFP requires SOC 2 Type II, but content mentions Type I only',
                },
                {
                    item_id: 2,
                    item_title: 'Team Size and Structure',
                    item_category: 'Company Overview',
                    freshness_score: 0.6,
                    status: 'stale',
                    last_updated: '2024-09-01',
                    issues: [
                        'Employee count may have changed',
                        'Leadership team updates needed',
                    ],
                    suggested_updates: [
                        'Verify current headcount with HR',
                        'Update executive team information',
                    ],
                },
                {
                    item_id: 3,
                    item_title: 'Data Center Locations',
                    item_category: 'Technical',
                    freshness_score: 0.5,
                    status: 'outdated',
                    last_updated: '2024-03-20',
                    issues: [
                        'New data center opened in Singapore not mentioned',
                    ],
                    suggested_updates: [
                        'Add Singapore DC to the list of global locations',
                    ],
                },
            ]);
            setLastChecked(new Date());
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = (itemId: number) => {
        setDismissedItems(prev => new Set([...prev, itemId]));
        toast.success('Alert dismissed');
    };

    const handleRefresh = (itemId: number) => {
        toast.success('Content refresh requested');
        onItemClick?.(itemId);
    };

    const filteredAudits = audits
        .filter(a => !dismissedItems.has(a.item_id))
        .filter(a => filterStatus === 'all' || a.status === filterStatus);

    const criticalCount = audits.filter(a => a.status === 'critical' && !dismissedItems.has(a.item_id)).length;
    const outdatedCount = audits.filter(a => a.status === 'outdated' && !dismissedItems.has(a.item_id)).length;

    if (compact) {
        // Compact badge for header
        const alertCount = criticalCount + outdatedCount;
        if (alertCount === 0) return null;
        
        return (
            <button
                onClick={() => onItemClick?.(0)}
                className="relative flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
            >
                <ExclamationTriangleIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                    {alertCount} content {alertCount === 1 ? 'alert' : 'alerts'}
                </span>
                {criticalCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {criticalCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className={clsx('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                        Content Freshness Alerts
                    </h3>
                    {lastChecked && (
                        <p className="text-sm text-gray-500 mt-1">
                            Last checked: {lastChecked.toLocaleTimeString()}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
                    >
                        <option value="all">All ({audits.length - dismissedItems.size})</option>
                        <option value="critical">Critical ({criticalCount})</option>
                        <option value="outdated">Outdated ({outdatedCount})</option>
                        <option value="stale">Stale</option>
                    </select>
                    <button
                        onClick={checkFreshness}
                        disabled={loading}
                        className="btn btn-secondary flex items-center gap-2"
                    >
                        <ArrowPathIcon className={clsx('h-4 w-4', loading && 'animate-spin')} />
                        {loading ? 'Checking...' : 'Check Now'}
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            {!loading && audits.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                        const count = audits.filter(a => a.status === status && !dismissedItems.has(a.item_id)).length;
                        return (
                            <div
                                key={status}
                                className={clsx(
                                    'p-3 rounded-lg border',
                                    config.bg,
                                    config.border
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <config.icon className={clsx('h-5 w-5', config.color)} />
                                    <span className={clsx('text-lg font-bold', config.color)}>{count}</span>
                                </div>
                                <p className={clsx('text-sm mt-1', config.color)}>{config.label}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Alerts List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : filteredAudits.length === 0 ? (
                <div className="text-center py-12 bg-green-50 rounded-xl border border-green-200">
                    <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h4 className="text-lg font-medium text-green-900 mb-2">All Content is Fresh!</h4>
                    <p className="text-green-700">Your knowledge base is up to date with current project requirements.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredAudits.map((audit) => {
                        const config = STATUS_CONFIG[audit.status];
                        const isExpanded = expandedItem === audit.item_id;
                        
                        return (
                            <div
                                key={audit.item_id}
                                className={clsx(
                                    'rounded-xl border overflow-hidden transition-all',
                                    config.border,
                                    isExpanded && 'shadow-lg'
                                )}
                            >
                                {/* Alert Header */}
                                <div
                                    className={clsx(
                                        'p-4 cursor-pointer transition-colors',
                                        config.bg,
                                        'hover:opacity-90'
                                    )}
                                    onClick={() => setExpandedItem(isExpanded ? null : audit.item_id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <config.icon className={clsx('h-6 w-6 mt-0.5', config.color)} />
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{audit.item_title}</h4>
                                                <p className="text-sm text-gray-600">
                                                    {audit.item_category} • Last updated: {new Date(audit.last_updated).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={clsx(
                                                'px-2 py-1 rounded-full text-xs font-medium',
                                                config.bg,
                                                config.color
                                            )}>
                                                {config.label}
                                            </span>
                                            <ChevronRightIcon
                                                className={clsx(
                                                    'h-5 w-5 text-gray-400 transition-transform',
                                                    isExpanded && 'rotate-90'
                                                )}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Quick Preview of Issues */}
                                    {!isExpanded && audit.issues.length > 0 && (
                                        <p className="mt-2 text-sm text-gray-600 truncate pl-9">
                                            {audit.issues[0]}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="p-4 bg-white border-t border-gray-100">
                                        {/* Freshness Score */}
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm text-gray-600">Freshness Score</span>
                                                <span className="text-sm font-medium">
                                                    {Math.round(audit.freshness_score * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={clsx(
                                                        'h-full transition-all',
                                                        audit.freshness_score >= 0.7 ? 'bg-green-500' :
                                                        audit.freshness_score >= 0.5 ? 'bg-amber-500' :
                                                        audit.freshness_score >= 0.3 ? 'bg-orange-500' :
                                                        'bg-red-500'
                                                    )}
                                                    style={{ width: `${audit.freshness_score * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Issues */}
                                        <div className="mb-4">
                                            <h5 className="text-sm font-medium text-gray-900 mb-2">Issues Found</h5>
                                            <ul className="space-y-1">
                                                {audit.issues.map((issue, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                                        <span className="text-red-500 mt-1">•</span>
                                                        {issue}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        
                                        {/* Conflicting Info */}
                                        {audit.conflicting_info && (
                                            <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                                                <div className="flex items-start gap-2">
                                                    <ExclamationSolidIcon className="h-5 w-5 text-red-600 mt-0.5" />
                                                    <div>
                                                        <p className="text-sm font-medium text-red-800">Conflicting Information</p>
                                                        <p className="text-sm text-red-700 mt-1">{audit.conflicting_info}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Suggested Updates */}
                                        <div className="mb-4">
                                            <h5 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                                                <SparklesIcon className="h-4 w-4 text-primary" />
                                                Suggested Updates
                                            </h5>
                                            <ul className="space-y-1">
                                                {audit.suggested_updates.map((suggestion, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                                        <span className="text-primary mt-1">→</span>
                                                        {suggestion}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        
                                        {/* Actions */}
                                        <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                                            <button
                                                onClick={() => handleRefresh(audit.item_id)}
                                                className="btn btn-primary flex items-center gap-2"
                                            >
                                                <DocumentTextIcon className="h-4 w-4" />
                                                Update Content
                                            </button>
                                            <button
                                                onClick={() => handleDismiss(audit.item_id)}
                                                className="btn btn-secondary flex items-center gap-2"
                                            >
                                                <XMarkIcon className="h-4 w-4" />
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/**
 * Compact Freshness Badge for use in lists
 */
interface FreshnessBadgeProps {
    score: number;
    showLabel?: boolean;
}

export function FreshnessBadge({ score, showLabel = false }: FreshnessBadgeProps) {
    const status = score >= 0.7 ? 'fresh' : score >= 0.5 ? 'stale' : score >= 0.3 ? 'outdated' : 'critical';
    const config = STATUS_CONFIG[status];
    
    return (
        <div className={clsx(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            config.bg,
            config.color
        )}>
            <config.icon className="h-3.5 w-3.5" />
            {showLabel && <span>{config.label}</span>}
            {!showLabel && <span>{Math.round(score * 100)}%</span>}
        </div>
    );
}
