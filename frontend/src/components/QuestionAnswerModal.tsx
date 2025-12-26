import { useState, useEffect } from 'react';
import { answersApi, questionsApi, answerLibraryApi, knowledgeApi } from '@/api/client';
import { Question, AnswerLibraryItem } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    XMarkIcon,
    SparklesIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    PencilIcon,
    TrashIcon,
    BookmarkIcon,
    BookOpenIcon,
} from '@heroicons/react/24/outline';

interface QuestionAnswerModalProps {
    question: Question;
    projectId: number;
    onClose: () => void;
    onUpdate: (question: Question) => void;
    onDelete?: (questionId: number) => void;
}

export default function QuestionAnswerModal({
    question,
    projectId,
    onClose,
    onUpdate,
    onDelete,
}: QuestionAnswerModalProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
    const [savedToLibrary, setSavedToLibrary] = useState(false);
    const [editedAnswer, setEditedAnswer] = useState(question.answer?.content || '');
    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [librarySuggestions, setLibrarySuggestions] = useState<AnswerLibraryItem[]>([]);
    const [knowledgeSuggestions, setKnowledgeSuggestions] = useState<{ id: number; title: string; content: string; confidence: number }[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [usingLibraryAnswer, setUsingLibraryAnswer] = useState(false);
    const [answerSource, setAnswerSource] = useState<string | null>(null);

    useEffect(() => {
        setEditedAnswer(question.answer?.content || '');
    }, [question.answer]);

    // Search library and knowledge base for similar content when no answer exists
    useEffect(() => {
        if (!question.answer && question.text) {
            searchAllSources();
        }
    }, [question.id]);

    const searchAllSources = async () => {
        setLoadingSuggestions(true);
        try {
            // Search both library and knowledge base in parallel
            const [libraryResponse, knowledgeResponse] = await Promise.allSettled([
                answerLibraryApi.search(question.text, question.category || undefined, 3),
                knowledgeApi.search(question.text, 3)
            ]);

            // Process library results
            if (libraryResponse.status === 'fulfilled') {
                console.log('Library results:', libraryResponse.value.data);
                setLibrarySuggestions(libraryResponse.value.data.items || []);
            } else {
                console.log('Library search failed:', libraryResponse.reason);
            }

            // Process knowledge base results with confidence scores
            if (knowledgeResponse.status === 'fulfilled') {
                console.log('Knowledge base results:', knowledgeResponse.value.data);
                const kbResults = knowledgeResponse.value.data.results || [];
                const mappedResults = kbResults.slice(0, 3).map((result: any) => ({
                    id: result.item?.id || result.item_id || result.id,
                    title: result.item?.title || result.title,
                    content: result.item?.content || result.content,
                    confidence: result.score || 0.75
                }));
                console.log('Mapped KB suggestions:', mappedResults);
                setKnowledgeSuggestions(mappedResults);
            } else {
                console.log('Knowledge base search failed:', knowledgeResponse.reason);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoadingSuggestions(false);
        }
    };


    const useLibraryAnswer = async (item: AnswerLibraryItem) => {
        // Record usage
        try {
            await answerLibraryApi.recordUsage(item.id, true);
        } catch {
            // Ignore
        }
        // Set as edited answer and switch to edit mode
        setEditedAnswer(item.answer_text);
        setAnswerSource(`Library: ${item.question_text.slice(0, 50)}...`);
        setUsingLibraryAnswer(true);
        setIsEditing(true);
        toast.success('Library answer applied - review and save');
    };

    const useKnowledgeAnswer = (item: { id: number; title: string; content: string; confidence: number }) => {
        // Use content from knowledge base with attribution
        const attributedContent = `${item.content}\n\n---\n*Source: ${item.title}*`;
        setEditedAnswer(attributedContent);
        setAnswerSource(`Knowledge Base: ${item.title}`);
        setUsingLibraryAnswer(true);
        setIsEditing(true);
        toast.success('Knowledge base content applied - review and save');
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const response = await answersApi.generate(question.id);
            const updatedQuestion = { ...question, ...response.data };
            onUpdate(updatedQuestion);
            setEditedAnswer(response.data.answer?.content || '');
            toast.success('Answer generated!');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate answer');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRegenerate = async () => {
        if (!feedback.trim() && showFeedback) {
            toast.error('Please provide feedback');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await answersApi.regenerate(question.id, feedback);
            const updatedQuestion = { ...question, ...response.data };
            onUpdate(updatedQuestion);
            setEditedAnswer(response.data.answer?.content || '');
            setFeedback('');
            setShowFeedback(false);
            toast.success('Answer regenerated!');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to regenerate answer');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editedAnswer.trim()) {
            toast.error('Answer cannot be empty');
            return;
        }

        setIsSaving(true);
        try {
            let response;
            if (question.answer) {
                // Update existing answer
                response = await answersApi.update(question.answer.id, editedAnswer);
            } else {
                // Create new answer (from library suggestion)
                response = await answersApi.create(question.id, editedAnswer);
            }
            const updatedQuestion = { ...question, answer: response.data.answer, status: response.data.status };
            onUpdate(updatedQuestion);
            setIsEditing(false);
            setUsingLibraryAnswer(false);
            toast.success('Answer saved!');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save answer');
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async () => {
        try {
            const response = await answersApi.review(question.answer!.id, 'approve');
            const updatedQuestion = { ...question, status: 'approved', answer: response.data.answer } as Question;
            onUpdate(updatedQuestion);
            toast.success('Answer approved!');
        } catch {
            toast.error('Failed to approve answer');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this question?')) return;

        try {
            await questionsApi.delete(question.id);
            if (onDelete) onDelete(question.id);
            onClose();
            toast.success('Question deleted');
        } catch {
            toast.error('Failed to delete question');
        }
    };

    const handleSaveToLibrary = async () => {
        if (!question.answer) return;

        setIsSavingToLibrary(true);
        try {
            await answerLibraryApi.saveFromAnswer(question.answer.id, {
                category: question.category,
            });
            setSavedToLibrary(true);
            toast.success('Answer saved to library!');
        } catch (error: any) {
            if (error.response?.data?.message?.includes('already in library')) {
                setSavedToLibrary(true);
                toast.success('Answer already in library');
            } else {
                toast.error('Failed to save to library');
            }
        } finally {
            setIsSavingToLibrary(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-medium">
                            Q
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold text-text-primary">
                                Question & Answer
                            </h2>
                            <p className="text-sm text-text-secondary">
                                {question.section ? `Section: ${question.section}` : 'General Question'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            question.status === 'approved' && 'bg-success-light text-success',
                            question.status === 'answered' && 'bg-primary-light text-primary',
                            question.status === 'pending' && 'bg-gray-100 text-gray-600',
                        )}>
                            {question.status}
                        </span>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-background rounded-lg transition-colors"
                        >
                            <XMarkIcon className="h-5 w-5 text-text-muted" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Question */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Customer Question
                        </label>
                        <div className="p-4 rounded-lg bg-background border border-border">
                            <p className="text-text-primary leading-relaxed">
                                {question.text}
                            </p>
                        </div>
                    </div>

                    {/* Answer Section */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-text-secondary">
                                Answer
                            </label>
                            {question.answer && !isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
                                >
                                    <PencilIcon className="h-4 w-4" />
                                    Edit
                                </button>
                            )}
                        </div>

                        {(!question.answer && !usingLibraryAnswer) ? (
                            // No answer yet - show suggestions and generate button
                            <div className="space-y-4">
                                {/* Library Suggestions */}
                                {(loadingSuggestions || librarySuggestions.length > 0) && (
                                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BookmarkIcon className="h-5 w-5 text-amber-600" />
                                            <span className="font-medium text-amber-800">Similar answers from library</span>
                                        </div>
                                        {loadingSuggestions ? (
                                            <p className="text-sm text-amber-700">Searching library...</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {librarySuggestions.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 cursor-pointer transition-colors"
                                                        onClick={() => useLibraryAnswer(item)}
                                                    >
                                                        <p className="text-sm font-medium text-gray-800 mb-1 line-clamp-1">
                                                            {item.question_text}
                                                        </p>
                                                        <p className="text-xs text-gray-600 line-clamp-2">
                                                            {item.answer_text}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                            {item.category && (
                                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded">{item.category}</span>
                                                            )}
                                                            <span>Used {item.times_used}x</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Knowledge Base Suggestions */}
                                {(!loadingSuggestions && knowledgeSuggestions.length > 0) && (
                                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BookOpenIcon className="h-5 w-5 text-blue-600" />
                                            <span className="font-medium text-blue-800">Relevant knowledge base content</span>
                                        </div>
                                        <div className="space-y-2">
                                            {knowledgeSuggestions.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="p-3 bg-white rounded-lg border border-blue-100 hover:border-blue-300 cursor-pointer transition-colors"
                                                    onClick={() => useKnowledgeAnswer(item)}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="text-sm font-medium text-gray-800 line-clamp-1">
                                                            {item.title}
                                                        </p>
                                                        <span className={clsx(
                                                            'px-2 py-0.5 text-xs font-medium rounded-full',
                                                            item.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                                                                item.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-gray-100 text-gray-600'
                                                        )}>
                                                            {Math.round(item.confidence * 100)}% match
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 line-clamp-2">
                                                        {item.content}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Generate Button */}
                                <div className="p-8 rounded-lg bg-background border border-dashed border-border text-center">
                                    <SparklesIcon className="h-12 w-12 mx-auto text-text-muted mb-4" />
                                    <h3 className="text-lg font-medium text-text-primary mb-2">
                                        {(librarySuggestions.length > 0 || knowledgeSuggestions.length > 0) ? 'Or generate a new answer' : 'No Answer Yet'}
                                    </h3>
                                    <p className="text-text-secondary mb-4 max-w-md mx-auto">
                                        Generate an AI-powered answer based on your company's knowledge base.
                                    </p>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="btn-primary inline-flex items-center gap-2"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <SparklesIcon className="h-4 w-4" />
                                                Generate Answer
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : isEditing ? (
                            // Edit mode
                            <div className="space-y-3">
                                <textarea
                                    value={editedAnswer}
                                    onChange={(e) => setEditedAnswer(e.target.value)}
                                    rows={10}
                                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                    placeholder="Enter your answer..."
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            setEditedAnswer(question.answer?.content || '');
                                            setIsEditing(false);
                                            setUsingLibraryAnswer(false);
                                        }}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={isSaving}
                                        className="btn-primary flex items-center gap-2"
                                    >
                                        {isSaving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // View mode with answer
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-background border border-border">
                                    <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                                        {question.answer.content}
                                    </p>
                                </div>

                                {/* Regenerate with feedback */}
                                {showFeedback && (
                                    <div className="p-4 rounded-lg bg-gray-50 border border-border">
                                        <label className="block text-sm font-medium text-text-primary mb-2">
                                            Feedback for Regeneration
                                        </label>
                                        <textarea
                                            value={feedback}
                                            onChange={(e) => setFeedback(e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                            placeholder="Describe what you'd like to change..."
                                        />
                                        <div className="flex justify-end gap-2 mt-3">
                                            <button
                                                onClick={() => setShowFeedback(false)}
                                                className="btn-secondary text-sm"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleRegenerate}
                                                disabled={isGenerating}
                                                className="btn-primary text-sm flex items-center gap-2"
                                            >
                                                {isGenerating && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                                                Regenerate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-border bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={handleDelete}
                        className="text-error hover:text-error-dark flex items-center gap-1 text-sm"
                    >
                        <TrashIcon className="h-4 w-4" />
                        Delete Question
                    </button>

                    <div className="flex items-center gap-2">
                        {question.answer && !isEditing && (
                            <>
                                <button
                                    onClick={() => setShowFeedback(!showFeedback)}
                                    disabled={isGenerating}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    <ArrowPathIcon className="h-4 w-4" />
                                    Regenerate
                                </button>

                                {question.status === 'approved' && !savedToLibrary && (
                                    <button
                                        onClick={handleSaveToLibrary}
                                        disabled={isSavingToLibrary}
                                        className="btn-secondary flex items-center gap-2"
                                        title="Save to answer library for reuse"
                                    >
                                        {isSavingToLibrary ? (
                                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <BookmarkIcon className="h-4 w-4" />
                                        )}
                                        Save to Library
                                    </button>
                                )}

                                {question.status !== 'approved' && (
                                    <button
                                        onClick={handleApprove}
                                        className="btn-success flex items-center gap-2"
                                    >
                                        <CheckCircleIcon className="h-4 w-4" />
                                        Approve
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
