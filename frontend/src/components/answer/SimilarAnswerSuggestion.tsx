import React from 'react';
import { LightBulbIcon, DocumentDuplicateIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface SimilarAnswer {
    question_id: number;
    question_text: string;
    answer_content: string;
    similarity_score: number;
    answer_id: number;
    category?: string;
    approved_at?: string;
}

interface SimilarAnswerSuggestionProps {
    similarAnswers: SimilarAnswer[];
    onUseAnswer?: (answer: SimilarAnswer) => void;
    onViewAnswer?: (answer: SimilarAnswer) => void;
    maxDisplay?: number;
    className?: string;
}

/**
 * Component to display similar approved answers as suggestions.
 */
export const SimilarAnswerSuggestion: React.FC<SimilarAnswerSuggestionProps> = ({
    similarAnswers,
    onUseAnswer,
    onViewAnswer,
    maxDisplay = 3,
    className = ''
}) => {
    if (!similarAnswers || similarAnswers.length === 0) return null;

    const displayAnswers = similarAnswers.slice(0, maxDisplay);

    const formatSimilarity = (score: number): string => {
        return `${Math.round(score * 100)}% match`;
    };

    const truncateText = (text: string, maxLength: number): string => {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength).trim() + '...';
    };

    return (
        <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
            <div className="flex items-start gap-2 mb-3">
                <LightBulbIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-medium text-amber-900">
                        Similar Approved Answers Found
                    </h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                        These previously approved answers may help you respond to this question.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {displayAnswers.map((answer) => (
                    <div
                        key={answer.answer_id}
                        className="bg-white rounded-lg border border-amber-100 p-3"
                    >
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                {formatSimilarity(answer.similarity_score)}
                            </span>
                            <div className="flex gap-1">
                                {onUseAnswer && (
                                    <button
                                        onClick={() => onUseAnswer(answer)}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded transition-colors"
                                        title="Use this answer as template"
                                    >
                                        <DocumentDuplicateIcon className="w-3 h-3" />
                                        Use
                                    </button>
                                )}
                                {onViewAnswer && (
                                    <button
                                        onClick={() => onViewAnswer(answer)}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                                        title="View full answer"
                                    >
                                        <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                                        View
                                    </button>
                                )}
                            </div>
                        </div>

                        <p className="text-xs text-gray-600 mb-2">
                            <span className="font-medium">Original Question:</span>{' '}
                            {truncateText(answer.question_text, 150)}
                        </p>

                        <p className="text-sm text-gray-800 bg-gray-50 rounded p-2 border-l-2 border-amber-300">
                            {truncateText(answer.answer_content, 200)}
                        </p>
                    </div>
                ))}
            </div>

            {similarAnswers.length > maxDisplay && (
                <p className="text-xs text-amber-600 mt-3 text-center">
                    +{similarAnswers.length - maxDisplay} more similar answers available
                </p>
            )}
        </div>
    );
};

/**
 * Compact version showing just the count of similar answers.
 */
export const SimilarAnswerBadge: React.FC<{
    count: number;
    onClick?: () => void;
    className?: string;
}> = ({ count, onClick, className = '' }) => {
    if (count === 0) return null;

    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors ${className}`}
        >
            <LightBulbIcon className="w-3 h-3" />
            {count} similar {count === 1 ? 'answer' : 'answers'}
        </button>
    );
};

export default SimilarAnswerSuggestion;
