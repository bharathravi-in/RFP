import { useState } from 'react';
import { questionsApi } from '@/api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    LightBulbIcon,
    CheckIcon,
    XMarkIcon,
    InformationCircleIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface Suggestion {
    question_id: number;
    question_text: string;
    answer_content: string;
    similarity_score: number;
    answer_id: number;
    category?: string;
}

interface SuggestedAnswerBadgeProps {
    questionId: number;
    matchType?: 'auto_apply' | 'suggest' | 'none';
    suggestion?: Suggestion;
    similarity?: number;
    onApply?: (answer: string) => void;
    onDismiss?: () => void;
    compact?: boolean;
}

export default function SuggestedAnswerBadge({
    questionId,
    matchType = 'none',
    suggestion,
    similarity,
    onApply,
    onDismiss,
    compact = false,
}: SuggestedAnswerBadgeProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || matchType === 'none' || !suggestion) {
        return null;
    }

    const handleApply = async () => {
        setIsLoading(true);
        try {
            const response = await questionsApi.applySuggestion(questionId, suggestion.answer_id);
            toast.success('Suggested answer applied!');
            if (onApply) {
                onApply(suggestion.answer_content);
            }
        } catch (error) {
            console.error('Failed to apply suggestion:', error);
            toast.error('Failed to apply suggestion');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
        if (onDismiss) {
            onDismiss();
        }
    };

    const confidencePercent = Math.round((similarity || suggestion.similarity_score) * 100);
    const isHighConfidence = confidencePercent >= 90;
    const isMediumConfidence = confidencePercent >= 75 && confidencePercent < 90;

    // Compact badge for list views
    if (compact) {
        return (
            <div className="inline-flex items-center gap-1">
                <span className={clsx(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    isHighConfidence ? 'bg-green-100 text-green-700' :
                        isMediumConfidence ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                )}>
                    <LightBulbIcon className="h-3 w-3" />
                    {confidencePercent}% match
                </span>
                <button
                    onClick={handleApply}
                    disabled={isLoading}
                    className="p-1 hover:bg-green-100 rounded transition-colors"
                    title="Apply suggestion"
                >
                    <CheckIcon className="h-3.5 w-3.5 text-green-600" />
                </button>
            </div>
        );
    }

    // Full badge with preview for detail views
    return (
        <div className={clsx(
            'rounded-lg border p-3',
            isHighConfidence ? 'bg-green-50 border-green-200' :
                isMediumConfidence ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <LightBulbIcon className={clsx(
                        'h-5 w-5',
                        isHighConfidence ? 'text-green-600' :
                            isMediumConfidence ? 'text-yellow-600' :
                                'text-blue-600'
                    )} />
                    <span className="font-medium text-sm text-text-primary">
                        {isHighConfidence ? 'High Confidence Match' :
                            isMediumConfidence ? 'Suggested Answer' :
                                'Possible Match'}
                    </span>
                    <span className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        isHighConfidence ? 'bg-green-100 text-green-700' :
                            isMediumConfidence ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                    )}>
                        {confidencePercent}%
                    </span>
                </div>
                <button
                    onClick={handleDismiss}
                    className="p-1 hover:bg-white/50 rounded transition-colors"
                    title="Dismiss"
                >
                    <XMarkIcon className="h-4 w-4 text-text-muted" />
                </button>
            </div>

            {/* Source Info */}
            <div className="flex items-center gap-2 mb-2 text-xs text-text-muted">
                <DocumentTextIcon className="h-4 w-4" />
                <span className="truncate">
                    From: "{suggestion.question_text.slice(0, 60)}..."
                </span>
                {suggestion.category && (
                    <span className="px-1.5 py-0.5 bg-white rounded text-xs">
                        {suggestion.category}
                    </span>
                )}
            </div>

            {/* Preview Toggle / Content */}
            {showPreview ? (
                <div className="mt-2">
                    <div className="bg-white rounded p-3 text-sm text-text-secondary max-h-40 overflow-y-auto border border-border">
                        {suggestion.answer_content}
                    </div>
                    <button
                        onClick={() => setShowPreview(false)}
                        className="text-xs text-primary mt-1 hover:underline"
                    >
                        Hide preview
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowPreview(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                    <InformationCircleIcon className="h-3.5 w-3.5" />
                    Preview answer
                </button>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
                <button
                    onClick={handleApply}
                    disabled={isLoading}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors',
                        isHighConfidence ? 'bg-green-600 hover:bg-green-700 text-white' :
                            'bg-primary hover:bg-primary-dark text-white',
                        isLoading && 'opacity-50 cursor-not-allowed'
                    )}
                >
                    {isLoading ? (
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                        <CheckIcon className="h-4 w-4" />
                    )}
                    Apply Suggestion
                </button>
                <button
                    onClick={handleDismiss}
                    className="px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/50 transition-colors"
                >
                    Skip
                </button>
            </div>
        </div>
    );
}

// Component to show match summary after auto-matching
export function AutoMatchSummary({
    summary,
    onViewDetails,
}: {
    summary: {
        total_questions: number;
        auto_apply: number;
        suggestions: number;
        no_match: number;
    };
    onViewDetails?: () => void;
}) {
    const hasMatches = summary.auto_apply > 0 || summary.suggestions > 0;

    return (
        <div className={clsx(
            'rounded-xl border p-4',
            hasMatches ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
        )}>
            <div className="flex items-center gap-3 mb-3">
                <div className={clsx(
                    'p-2 rounded-lg',
                    hasMatches ? 'bg-green-100' : 'bg-gray-100'
                )}>
                    <LightBulbIcon className={clsx(
                        'h-5 w-5',
                        hasMatches ? 'text-green-600' : 'text-gray-500'
                    )} />
                </div>
                <div>
                    <h4 className="font-semibold text-text-primary">Auto-Match Results</h4>
                    <p className="text-sm text-text-muted">
                        {summary.total_questions} questions analyzed
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-2xl font-bold text-green-600">{summary.auto_apply}</p>
                    <p className="text-xs text-text-muted">Auto-Applied</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-yellow-100">
                    <p className="text-2xl font-bold text-yellow-600">{summary.suggestions}</p>
                    <p className="text-xs text-text-muted">Suggestions</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <p className="text-2xl font-bold text-gray-500">{summary.no_match}</p>
                    <p className="text-xs text-text-muted">No Match</p>
                </div>
            </div>

            {hasMatches && onViewDetails && (
                <button
                    onClick={onViewDetails}
                    className="w-full mt-3 px-4 py-2 bg-white border border-green-200 rounded-lg text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
                >
                    View & Review Matches
                </button>
            )}
        </div>
    );
}
