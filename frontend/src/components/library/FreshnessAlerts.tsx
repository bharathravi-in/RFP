import { useState } from 'react';
import {
    ExclamationTriangleIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XMarkIcon,
    ClockIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { agentsApi } from '@/api/client';
import toast from 'react-hot-toast';

interface AuditResult {
    item_id: number;
    status: 'up_to_date' | 'outdated' | 'contradictory' | 'uncertain';
    confidence_score: number;
    findings: string;
    suggested_update?: string;
    question_text?: string;
}

interface FreshnessAlertsProps {
    libraryItems: Array<{ id: number; question_text: string; answer_text: string }>;
    projectId?: number;
    onUpdate?: (itemId: number) => void;
}

/**
 * Component for checking and displaying content freshness alerts.
 * Shows which library answers may be stale or contradictory.
 */
export default function FreshnessAlerts({
    libraryItems,
    projectId,
    onUpdate
}: FreshnessAlertsProps) {
    const [audits, setAudits] = useState<AuditResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);

    const checkFreshness = async () => {
        if (libraryItems.length === 0) {
            toast.error('No library items to check');
            return;
        }

        setIsLoading(true);
        try {
            const response = await agentsApi.checkFreshness(
                libraryItems.map(item => item.id),
                projectId
            );
            const data = response.data;

            if (data.success && data.audits) {
                // Enrich audits with question text
                const enriched = data.audits.map((a: AuditResult) => ({
                    ...a,
                    question_text: libraryItems.find(item => item.id === a.item_id)?.question_text
                }));
                setAudits(enriched);
                setHasChecked(true);

                const issues = enriched.filter((a: AuditResult) => a.status !== 'up_to_date').length;
                if (issues > 0) {
                    toast.error(`Found ${issues} items needing review`, { icon: '⚠️' });
                } else {
                    toast.success('All content is up to date!');
                }
            } else {
                toast.error(data.error || 'Freshness check failed');
            }
        } catch (error) {
            console.error('Freshness check error:', error);
            toast.error('Failed to check content freshness');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'up_to_date':
                return {
                    icon: CheckCircleIcon,
                    color: 'text-success',
                    bg: 'bg-success/10',
                    label: 'Up to Date'
                };
            case 'outdated':
                return {
                    icon: ClockIcon,
                    color: 'text-warning',
                    bg: 'bg-warning/10',
                    label: 'Outdated'
                };
            case 'contradictory':
                return {
                    icon: ExclamationTriangleIcon,
                    color: 'text-error',
                    bg: 'bg-error/10',
                    label: 'Contradictory'
                };
            default:
                return {
                    icon: ExclamationTriangleIcon,
                    color: 'text-text-muted',
                    bg: 'bg-gray-100',
                    label: 'Uncertain'
                };
        }
    };

    const issueCount = audits.filter(a => a.status !== 'up_to_date').length;

    return (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-warning/5 to-error/5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-warning" />
                    <h3 className="font-semibold text-text-primary">Content Freshness</h3>
                    {hasChecked && issueCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-error/10 text-error rounded-full">
                            {issueCount} issues
                        </span>
                    )}
                </div>
            </div>

            <div className="p-4">
                {!hasChecked ? (
                    <div className="text-center py-6">
                        <ClockIcon className="h-10 w-10 mx-auto text-text-muted mb-3" />
                        <p className="text-sm text-text-secondary mb-4">
                            Check if any library answers are outdated based on recent documents
                        </p>
                        <button
                            onClick={checkFreshness}
                            disabled={isLoading}
                            className="btn-primary flex items-center gap-2 mx-auto"
                        >
                            {isLoading ? (
                                <>
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    Checking...
                                </>
                            ) : (
                                <>
                                    <ArrowPathIcon className="h-4 w-4" />
                                    Check Freshness
                                </>
                            )}
                        </button>
                    </div>
                ) : audits.length === 0 ? (
                    <div className="text-center py-6">
                        <CheckCircleIcon className="h-10 w-10 mx-auto text-success mb-3" />
                        <p className="text-sm text-text-secondary">All content is fresh!</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {audits
                            .filter(a => a.status !== 'up_to_date')
                            .map((audit) => {
                                const config = getStatusConfig(audit.status);
                                const StatusIcon = config.icon;

                                return (
                                    <div
                                        key={audit.item_id}
                                        className={clsx(
                                            'p-3 rounded-lg border',
                                            config.bg,
                                            'border-border'
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <StatusIcon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', config.color)} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={clsx(
                                                        'text-xs px-2 py-0.5 rounded font-medium',
                                                        config.bg, config.color
                                                    )}>
                                                        {config.label}
                                                    </span>
                                                    <span className="text-xs text-text-muted">
                                                        {Math.round(audit.confidence_score * 100)}% confidence
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-text-primary truncate">
                                                    {audit.question_text}
                                                </p>
                                                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                                                    {audit.findings}
                                                </p>
                                                {audit.suggested_update && (
                                                    <button
                                                        onClick={() => onUpdate?.(audit.item_id)}
                                                        className="mt-2 text-xs text-primary hover:underline"
                                                    >
                                                        View Suggested Update →
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                        {issueCount === 0 && (
                            <div className="text-center py-4">
                                <CheckCircleIcon className="h-8 w-8 mx-auto text-success mb-2" />
                                <p className="text-sm text-text-secondary">All checked items are current</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
