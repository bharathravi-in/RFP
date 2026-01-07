import { useState } from 'react';
import { UserGroupIcon, SparklesIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { agentsApi, questionsApi } from '@/api/client';
import toast from 'react-hot-toast';

interface Suggestion {
    item_id: number;
    suggested_owner_id: number;
    suggested_owner_name?: string;
    confidence_score: number;
    reasoning: string;
    expertise_match_category?: string;
}

interface SuggestedOwnersPanelProps {
    projectId: number;
    questionIds: number[];
    teamMembers: Array<{ id: number; name: string }>;
    onApplied?: () => void;
    onClose?: () => void;
}

/**
 * Panel showing AI-suggested owners for questions.
 * Allows users to apply suggestions individually or in bulk.
 */
export default function SuggestedOwnersPanel({
    projectId,
    questionIds,
    teamMembers,
    onApplied,
    onClose
}: SuggestedOwnersPanelProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState<number | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);

    const loadSuggestions = async () => {
        if (questionIds.length === 0) {
            toast.error('No questions to suggest owners for');
            return;
        }

        setIsLoading(true);
        try {
            const response = await agentsApi.suggestOwners(projectId, questionIds);
            const data = response.data;

            if (data.success && data.suggestions) {
                // Enrich suggestions with owner names
                const enriched = data.suggestions.map((s: Suggestion) => ({
                    ...s,
                    suggested_owner_name: teamMembers.find(m => m.id === s.suggested_owner_id)?.name || 'Unknown'
                }));
                setSuggestions(enriched);
                setHasLoaded(true);
            } else {
                toast.error(data.error || 'Failed to get suggestions');
            }
        } catch (error) {
            console.error('Error loading suggestions:', error);
            toast.error('Failed to load AI suggestions');
        } finally {
            setIsLoading(false);
        }
    };

    const applySuggestion = async (suggestion: Suggestion) => {
        setIsApplying(suggestion.item_id);
        try {
            await questionsApi.update(suggestion.item_id, {
                assigned_to: suggestion.suggested_owner_id
            });
            toast.success(`Assigned to ${suggestion.suggested_owner_name}`);

            // Remove applied suggestion
            setSuggestions(prev => prev.filter(s => s.item_id !== suggestion.item_id));
            onApplied?.();
        } catch (error) {
            console.error('Error applying suggestion:', error);
            toast.error('Failed to apply suggestion');
        } finally {
            setIsApplying(null);
        }
    };

    const applyAll = async () => {
        setIsApplying(-1); // -1 indicates "all"
        try {
            for (const suggestion of suggestions) {
                await questionsApi.update(suggestion.item_id, {
                    assigned_to: suggestion.suggested_owner_id
                });
            }
            toast.success(`Applied ${suggestions.length} assignments`);
            setSuggestions([]);
            onApplied?.();
        } catch (error) {
            console.error('Error applying all:', error);
            toast.error('Failed to apply all suggestions');
        } finally {
            setIsApplying(null);
        }
    };

    const getConfidenceColor = (score: number) => {
        if (score >= 0.8) return 'text-success bg-success/10';
        if (score >= 0.5) return 'text-warning bg-warning/10';
        return 'text-error bg-error/10';
    };

    return (
        <div className="bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-text-primary">AI Suggested Owners</h3>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-text-muted hover:text-text-primary">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                )}
            </div>

            <div className="p-4">
                {!hasLoaded ? (
                    <div className="text-center py-6">
                        <UserGroupIcon className="h-10 w-10 mx-auto text-text-muted mb-3" />
                        <p className="text-sm text-text-secondary mb-4">
                            Let AI analyze questions and suggest the best team members
                        </p>
                        <button
                            onClick={loadSuggestions}
                            disabled={isLoading}
                            className="btn-primary flex items-center gap-2 mx-auto"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="h-4 w-4" />
                                    Get Suggestions
                                </>
                            )}
                        </button>
                    </div>
                ) : suggestions.length === 0 ? (
                    <div className="text-center py-6">
                        <CheckIcon className="h-10 w-10 mx-auto text-success mb-3" />
                        <p className="text-sm text-text-secondary">All suggestions applied!</p>
                    </div>
                ) : (
                    <>
                        {/* Suggestions List */}
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {suggestions.map((suggestion) => (
                                <div
                                    key={suggestion.item_id}
                                    className="p-3 bg-background rounded-lg border border-border"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm text-text-primary truncate">
                                                    {suggestion.suggested_owner_name}
                                                </span>
                                                <span className={clsx(
                                                    'text-xs px-2 py-0.5 rounded-full font-medium',
                                                    getConfidenceColor(suggestion.confidence_score)
                                                )}>
                                                    {Math.round(suggestion.confidence_score * 100)}%
                                                </span>
                                            </div>
                                            <p className="text-xs text-text-muted line-clamp-2">
                                                {suggestion.reasoning}
                                            </p>
                                            {suggestion.expertise_match_category && (
                                                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                                    {suggestion.expertise_match_category}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => applySuggestion(suggestion)}
                                            disabled={isApplying !== null}
                                            className="btn-sm bg-primary/10 text-primary hover:bg-primary hover:text-white flex-shrink-0"
                                        >
                                            {isApplying === suggestion.item_id ? (
                                                <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                                            ) : (
                                                'Apply'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Apply All Button */}
                        {suggestions.length > 1 && (
                            <button
                                onClick={applyAll}
                                disabled={isApplying !== null}
                                className="mt-4 w-full btn-primary flex items-center justify-center gap-2"
                            >
                                {isApplying === -1 ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                        Applying...
                                    </>
                                ) : (
                                    <>
                                        <CheckIcon className="h-4 w-4" />
                                        Apply All ({suggestions.length})
                                    </>
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
