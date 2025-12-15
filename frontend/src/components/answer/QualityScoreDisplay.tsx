import clsx from 'clsx';
import {
    SparklesIcon,
    ArrowPathIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';

interface QualityScore {
    overall_score: number;
    dimension_scores: {
        completeness: number;
        accuracy: number;
        clarity: number;
        relevance: number;
        professionalism: number;
    };
    suggestions: string[];
    flags: string[];
}

interface QualityScoreDisplayProps {
    score: QualityScore;
    onImprove?: () => void;
    isImproving?: boolean;
}

export default function QualityScoreDisplay({
    score,
    onImprove,
    isImproving = false,
}: QualityScoreDisplayProps) {
    const overallPct = Math.round(score.overall_score * 100);

    const getScoreColor = (value: number) => {
        if (value >= 0.8) return 'text-success';
        if (value >= 0.6) return 'text-warning';
        return 'text-error';
    };

    const getBgColor = (value: number) => {
        if (value >= 0.8) return 'bg-success';
        if (value >= 0.6) return 'bg-warning';
        return 'bg-error';
    };

    return (
        <div className="card p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-primary" />
                    <span className="font-medium text-text-primary">Quality Score</span>
                </div>
                <div className={clsx('text-2xl font-bold', getScoreColor(score.overall_score))}>
                    {overallPct}%
                </div>
            </div>

            {/* Dimension Bars */}
            <div className="space-y-2">
                {Object.entries(score.dimension_scores).map(([dim, value]) => (
                    <DimensionBar
                        key={dim}
                        label={dim}
                        value={value}
                        getBgColor={getBgColor}
                    />
                ))}
            </div>

            {/* Suggestions */}
            {score.suggestions.length > 0 && (
                <div className="pt-3 border-t border-border">
                    <p className="text-xs font-medium text-text-muted mb-2">Suggestions:</p>
                    <ul className="space-y-1">
                        {score.suggestions.map((suggestion, i) => (
                            <li key={i} className="text-xs text-text-secondary flex gap-2">
                                <span className="text-primary">•</span>
                                {suggestion}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Improve Button */}
            {onImprove && score.overall_score < 0.8 && (
                <button
                    onClick={onImprove}
                    disabled={isImproving}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                >
                    {isImproving ? (
                        <>
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            Improving...
                        </>
                    ) : (
                        <>
                            <SparklesIcon className="h-4 w-4" />
                            Auto-Improve
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

function DimensionBar({
    label,
    value,
    getBgColor,
}: {
    label: string;
    value: number;
    getBgColor: (v: number) => string;
}) {
    const pct = Math.round(value * 100);

    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted capitalize w-24">
                {label}
            </span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={clsx('h-full rounded-full transition-all', getBgColor(value))}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs text-text-secondary w-8 text-right">{pct}%</span>
        </div>
    );
}

// Improvement Mode Selector
interface ImprovementModeProps {
    onSelect: (mode: string) => void;
    disabled?: boolean;
}

export function ImprovementModeSelector({ onSelect, disabled }: ImprovementModeProps) {
    const modes = [
        { id: 'expand', label: 'Expand', desc: 'Add more detail' },
        { id: 'concise', label: 'Concise', desc: 'Make shorter' },
        { id: 'formal', label: 'Formal', desc: 'Professional tone' },
        { id: 'technical', label: 'Technical', desc: 'Add depth' },
        { id: 'simplify', label: 'Simplify', desc: 'Easier to read' },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {modes.map((mode) => (
                <button
                    key={mode.id}
                    onClick={() => onSelect(mode.id)}
                    disabled={disabled}
                    className="px-3 py-1.5 text-xs font-medium bg-background hover:bg-primary-light hover:text-primary border border-border rounded-lg transition-colors disabled:opacity-50"
                >
                    {mode.label}
                </button>
            ))}
        </div>
    );
}
