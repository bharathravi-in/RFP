import { useState, useRef, useEffect } from 'react';
import { ShieldCheckIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface TruthScoreBadgeProps {
    score: number | null | undefined;
    size?: 'sm' | 'md';
    showLabel?: boolean;
    /** Optional breakdown of confidence factors */
    breakdown?: {
        sourceRelevance?: number;
        knowledgeCoverage?: number;
        claimVerification?: number;
    };
    /** Number of sources used */
    sourceCount?: number;
}

/**
 * Displays AI verification/truth score for an answer with expandable explanation.
 * Color coding: green (>0.8), yellow (0.5-0.8), red (<0.5)
 */
export default function TruthScoreBadge({
    score,
    size = 'md',
    showLabel = true,
    breakdown,
    sourceCount,
}: TruthScoreBadgeProps) {
    const [showDetails, setShowDetails] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Handle missing score
    if (score === null || score === undefined) {
        return null;
    }

    const percentage = Math.round(score * 100);

    // Determine color based on score
    const getColorClasses = () => {
        if (score >= 0.8) return 'bg-success/15 text-success border-success/30';
        if (score >= 0.5) return 'bg-warning/15 text-warning border-warning/30';
        return 'bg-error/15 text-error border-error/30';
    };

    const getIconColor = () => {
        if (score >= 0.8) return 'text-success';
        if (score >= 0.5) return 'text-warning';
        return 'text-error';
    };

    const getConfidenceLevel = () => {
        if (score >= 0.8) return { label: 'High Confidence', color: 'text-success' };
        if (score >= 0.5) return { label: 'Medium Confidence', color: 'text-warning' };
        return { label: 'Low Confidence', color: 'text-error' };
    };

    const getExplanation = () => {
        if (score >= 0.8) {
            return 'This answer is well-supported by multiple sources in your knowledge base. The AI found strong matches and verified key claims.';
        }
        if (score >= 0.5) {
            return 'This answer has partial support from your knowledge base. Some claims may need manual verification or additional sources.';
        }
        return 'Limited source material was found for this answer. We recommend reviewing and enhancing this response with verified information.';
    };

    const sizeClasses = size === 'sm'
        ? 'text-[10px] px-1.5 py-0.5 gap-1'
        : 'text-xs px-2 py-1 gap-1.5';

    const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

    // Calculate popover position
    useEffect(() => {
        if (showDetails && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                left: Math.max(16, rect.left - 120),
            });
        }
    }, [showDetails]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                !buttonRef.current?.contains(e.target as Node)
            ) {
                setShowDetails(false);
            }
        };
        if (showDetails) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showDetails]);

    const confidence = getConfidenceLevel();

    return (
        <>
            <button
                ref={buttonRef}
                onClick={() => setShowDetails(!showDetails)}
                className={clsx(
                    'inline-flex items-center rounded-full border font-medium cursor-pointer hover:opacity-80 transition-opacity',
                    getColorClasses(),
                    sizeClasses
                )}
                aria-label="View AI confidence details"
            >
                <ShieldCheckIcon className={clsx(iconSize, getIconColor())} />
                <span>{percentage}%</span>
                {showLabel && size === 'md' && (
                    <span className="opacity-75">verified</span>
                )}
            </button>

            {/* Expandable Details Popover */}
            {showDetails && (
                <div
                    ref={popoverRef}
                    className="fixed z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
                    style={{ top: position.top, left: position.left }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <ShieldCheckIcon className={clsx('h-5 w-5', getIconColor())} />
                            <span className={clsx('font-semibold', confidence.color)}>
                                {confidence.label}
                            </span>
                            <span className="text-gray-500 font-medium">{percentage}%</span>
                        </div>
                        <button
                            onClick={() => setShowDetails(false)}
                            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                        >
                            <XMarkIcon className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>

                    {/* Explanation */}
                    <div className="px-4 py-3">
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {getExplanation()}
                        </p>
                    </div>

                    {/* Breakdown (if provided) */}
                    {(breakdown || sourceCount) && (
                        <div className="px-4 pb-4 space-y-3">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Score Breakdown
                            </div>

                            {sourceCount !== undefined && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Sources Used</span>
                                    <span className="font-medium text-gray-900">{sourceCount} documents</span>
                                </div>
                            )}

                            {breakdown?.knowledgeCoverage !== undefined && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Knowledge Coverage</span>
                                        <span className="font-medium">{Math.round(breakdown.knowledgeCoverage * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${breakdown.knowledgeCoverage * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {breakdown?.sourceRelevance !== undefined && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Source Relevance</span>
                                        <span className="font-medium">{Math.round(breakdown.sourceRelevance * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500 rounded-full"
                                            style={{ width: `${breakdown.sourceRelevance * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {breakdown?.claimVerification !== undefined && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Claim Verification</span>
                                        <span className="font-medium">{Math.round(breakdown.claimVerification * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${breakdown.claimVerification * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Help Link */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <InformationCircleIcon className="h-4 w-4" />
                            <span>Scores based on knowledge base matching and claim verification</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

