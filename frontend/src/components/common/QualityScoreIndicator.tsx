import React from 'react';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    SparklesIcon,
    ShieldCheckIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

interface QualityScore {
    overall_score: number;
    dimensions?: {
        client_specificity?: number;
        evidence_density?: number;
        risk_ownership?: number;
        internal_consistency?: number;
        decision_usefulness?: number;
    };
    issues?: string[];
}

interface IsolationViolation {
    type: string;
    term: string;
    severity: string;
    message: string;
}

interface QualityScoreIndicatorProps {
    score?: QualityScore;
    isolation_violations?: IsolationViolation[];
    regenerated?: boolean;
    showDetails?: boolean;
    onRegenerate?: () => void;
    loading?: boolean;
}

const getScoreColor = (score: number): string => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
};

const getScoreBgColor = (score: number): string => {
    if (score >= 4) return 'bg-green-50 border-green-200';
    if (score >= 3) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
};

const ScoreIcon = ({ score }: { score: number }) => {
    if (score >= 4) return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
    if (score >= 3) return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
    return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
};

export const QualityScoreIndicator: React.FC<QualityScoreIndicatorProps> = ({
    score,
    isolation_violations,
    regenerated,
    showDetails = false,
    onRegenerate,
    loading
}) => {
    if (!score) return null;

    const overallScore = score.overall_score || 0;
    const hasViolations = isolation_violations && isolation_violations.length > 0;
    const criticalViolations = isolation_violations?.filter(v => v.severity === 'critical') || [];

    return (
        <div className={`rounded-lg border p-3 ${getScoreBgColor(overallScore)}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ScoreIcon score={overallScore} />
                    <span className={`font-medium ${getScoreColor(overallScore)}`}>
                        Quality: {overallScore.toFixed(1)}/5
                    </span>
                    {regenerated && (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <SparklesIcon className="h-3 w-3" />
                            Regenerated
                        </span>
                    )}
                </div>

                {onRegenerate && overallScore < 4 && (
                    <button
                        onClick={onRegenerate}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                        <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Regenerating...' : 'Improve'}
                    </button>
                )}
            </div>

            {/* Violation Warning */}
            {hasViolations && (
                <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm">
                    <div className="flex items-center gap-2 text-red-700 font-medium">
                        <ShieldCheckIcon className="h-4 w-4" />
                        Content Contamination Detected
                    </div>
                    <ul className="mt-1 text-red-600 text-xs space-y-1">
                        {criticalViolations.slice(0, 3).map((v, i) => (
                            <li key={i}>• {v.message}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Dimension Details */}
            {showDetails && score.dimensions && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(score.dimensions).map(([key, value]) => {
                        const numValue = typeof value === 'number' ? value : 0;
                        return (
                            <div key={key} className="flex justify-between">
                                <span className="text-gray-600 capitalize">
                                    {key.replace(/_/g, ' ')}:
                                </span>
                                <span className={getScoreColor(numValue)}>
                                    {numValue.toFixed(1)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Issues */}
            {showDetails && score.issues && score.issues.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                    <div className="font-medium text-gray-700">Improvement Areas:</div>
                    <ul className="mt-1 space-y-0.5">
                        {score.issues.slice(0, 3).map((issue, i) => (
                            <li key={i} className="text-gray-500">• {issue}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// Compact version for inline display
export const QualityScoreBadge: React.FC<{ score: number; showLabel?: boolean }> = ({
    score,
    showLabel = true
}) => {
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${score >= 4 ? 'bg-green-100 text-green-700' :
            score >= 3 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
            }`}>
            <ScoreIcon score={score} />
            {showLabel && <span>{score.toFixed(1)}</span>}
        </span>
    );
};

// Client Context Panel for displaying narrative and context info
export const ClientContextPanel: React.FC<{
    clientContext?: {
        client_name?: string;
        domain?: string;
        forbidden_references?: string[];
        success_definition?: string;
    };
    narrativeContext?: {
        solution_thesis?: string;
        core_problem?: string;
    };
    collapsed?: boolean;
    onToggle?: () => void;
}> = ({ clientContext, narrativeContext, collapsed = true, onToggle }) => {
    if (!clientContext && !narrativeContext) return null;

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
            <div
                className="flex items-center justify-between cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-indigo-600" />
                    <span className="font-medium text-indigo-900">AI Context</span>
                    {clientContext?.domain && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            {clientContext.domain}
                        </span>
                    )}
                </div>
                <span className="text-xs text-indigo-600">
                    {collapsed ? 'Show' : 'Hide'} details
                </span>
            </div>

            {!collapsed && (
                <div className="mt-3 space-y-3 text-sm">
                    {clientContext?.client_name && (
                        <div>
                            <span className="text-gray-600">Client:</span>{' '}
                            <span className="font-medium">{clientContext.client_name}</span>
                        </div>
                    )}

                    {narrativeContext?.solution_thesis && (
                        <div>
                            <span className="text-gray-600">Solution Focus:</span>{' '}
                            <span className="text-gray-800">{narrativeContext.solution_thesis}</span>
                        </div>
                    )}

                    {clientContext?.forbidden_references && clientContext.forbidden_references.length > 0 && (
                        <div className="p-2 bg-red-50 border border-red-100 rounded text-xs">
                            <span className="text-red-600 font-medium">⚠️ Forbidden References:</span>
                            <span className="text-red-500 ml-1">
                                {clientContext.forbidden_references.slice(0, 5).join(', ')}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QualityScoreIndicator;
