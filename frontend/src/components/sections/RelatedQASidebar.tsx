import { useState } from 'react';
import { Question } from '@/types';
import {
    ChatBubbleLeftRightIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    ClipboardDocumentIcon,
    SparklesIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface RelatedQASidebarProps {
    questions: Question[];
    isLoading: boolean;
    isOpen: boolean;
    onToggle: () => void;
    onInsertAnswer: (question: Question, answer: string) => void;
    sectionTitle?: string;
}

/**
 * Sidebar panel showing Q&A answers related to the current section.
 * Enables one-click insertion of Q&A content into section narratives.
 */
export default function RelatedQASidebar({
    questions,
    isLoading,
    isOpen,
    onToggle,
    onInsertAnswer,
    sectionTitle,
}: RelatedQASidebarProps) {
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Filter to only answered questions
    const answeredQuestions = questions.filter(
        q => q.status === 'answered' || q.status === 'approved'
    );

    const handleCopyToClipboard = (question: Question) => {
        const answer = question.answer?.content || '';
        navigator.clipboard.writeText(answer);
        setCopiedId(question.id);
        toast.success('Answer copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleInsertIntoSection = (question: Question) => {
        const answer = question.answer?.content || '';
        if (answer) {
            onInsertAnswer(question, answer);
            toast.success('Answer inserted into section');
        } else {
            toast.error('No answer content to insert');
        }
    };

    // Collapsed state - just show toggle button
    if (!isOpen) {
        return (
            <div className="flex flex-col items-center border-l border-border bg-surface-muted">
                <button
                    onClick={onToggle}
                    className="p-3 hover:bg-surface transition-colors"
                    title="Show Related Q&A"
                >
                    <ChevronLeftIcon className="h-5 w-5 text-text-secondary" />
                </button>
                <div className="rotate-90 mt-4 text-xs font-medium text-text-muted whitespace-nowrap">
                    Q&A ({answeredQuestions.length})
                </div>
            </div>
        );
    }

    return (
        <div className="w-80 border-l border-border bg-surface flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-text-primary text-sm">Related Q&A</h3>
                    {answeredQuestions.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                            {answeredQuestions.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={onToggle}
                    className="p-1.5 hover:bg-background rounded transition-colors"
                    title="Hide Q&A sidebar"
                >
                    <ChevronRightIcon className="h-4 w-4 text-text-muted" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                    </div>
                ) : answeredQuestions.length === 0 ? (
                    <div className="text-center py-8 px-4">
                        <SparklesIcon className="h-10 w-10 mx-auto text-text-muted mb-3" />
                        <p className="text-sm text-text-secondary mb-2">
                            No related Q&A found
                        </p>
                        <p className="text-xs text-text-muted">
                            {questions.length > 0
                                ? 'None of the questions match this section category.'
                                : 'Upload an RFP to extract questions.'}
                        </p>
                    </div>
                ) : (
                    answeredQuestions.map((question) => (
                        <div
                            key={question.id}
                            className="p-3 rounded-lg border border-border bg-background hover:border-primary transition-colors group"
                        >
                            {/* Question */}
                            <div className="flex items-start gap-2 mb-2">
                                {question.status === 'approved' ? (
                                    <CheckCircleSolidIcon className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                                ) : (
                                    <CheckCircleIcon className="h-4 w-4 text-text-muted flex-shrink-0 mt-0.5" />
                                )}
                                <p className="text-sm font-medium text-text-primary line-clamp-2">
                                    {question.text}
                                </p>
                            </div>

                            {/* Answer Preview */}
                            <div className="text-xs text-text-secondary line-clamp-3 mb-3 pl-6">
                                {question.answer?.content?.substring(0, 200)}
                                {(question.answer?.content?.length || 0) > 200 && '...'}
                            </div>

                            {/* Category Badge */}
                            {question.category && (
                                <div className="pl-6 mb-2">
                                    <span className="text-xs px-2 py-0.5 bg-surface-muted rounded-full text-text-muted">
                                        {question.category}
                                    </span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pl-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleInsertIntoSection(question)}
                                    className="flex-1 px-2 py-1.5 text-xs font-medium bg-primary text-white rounded hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
                                >
                                    <SparklesIcon className="h-3 w-3" />
                                    Insert
                                </button>
                                <button
                                    onClick={() => handleCopyToClipboard(question)}
                                    className={clsx(
                                        'px-2 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1',
                                        copiedId === question.id
                                            ? 'bg-success text-white'
                                            : 'bg-surface-muted text-text-primary hover:bg-gray-200'
                                    )}
                                >
                                    <ClipboardDocumentIcon className="h-3 w-3" />
                                    {copiedId === question.id ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer with tip */}
            {answeredQuestions.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-background">
                    <p className="text-xs text-text-muted text-center">
                        💡 Click <strong>Insert</strong> to add Q&A content to your section
                    </p>
                </div>
            )}
        </div>
    );
}
