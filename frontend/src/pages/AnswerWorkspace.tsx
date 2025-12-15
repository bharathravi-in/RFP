import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { questionsApi, answersApi } from '@/api/client';
import { Question, Answer } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    ArrowLeftIcon,
    SparklesIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    ChevronDownIcon,
    DocumentTextIcon,
    BookOpenIcon,
} from '@heroicons/react/24/outline';

export default function AnswerWorkspace() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editorContent, setEditorContent] = useState('');

    useEffect(() => {
        if (id) {
            loadQuestions();
        }
    }, [id]);

    useEffect(() => {
        const questionId = searchParams.get('q');
        if (questionId && questions.length > 0) {
            const question = questions.find(q => q.id === Number(questionId));
            if (question) {
                setSelectedQuestion(question);
                setEditorContent(question.answer?.content || '');
            }
        } else if (questions.length > 0 && !selectedQuestion) {
            setSelectedQuestion(questions[0]);
            setEditorContent(questions[0].answer?.content || '');
        }
    }, [searchParams, questions]);

    const loadQuestions = async () => {
        try {
            const response = await questionsApi.list(Number(id));
            setQuestions(response.data.questions || []);
        } catch {
            toast.error('Failed to load questions');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectQuestion = (question: Question) => {
        setSelectedQuestion(question);
        setEditorContent(question.answer?.content || '');
    };

    const handleGenerateAnswer = async () => {
        if (!selectedQuestion) return;

        setIsGenerating(true);
        try {
            const response = await answersApi.generate(selectedQuestion.id);
            const newAnswer = response.data.answer;
            setEditorContent(newAnswer.content);

            // Update question in list
            setQuestions(questions.map(q =>
                q.id === selectedQuestion.id
                    ? { ...q, answer: newAnswer, status: 'answered' }
                    : q
            ));
            setSelectedQuestion({ ...selectedQuestion, answer: newAnswer, status: 'answered' });

            toast.success('Answer generated!');
        } catch {
            toast.error('Failed to generate answer');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleReviewAction = async (action: 'approve' | 'reject') => {
        if (!selectedQuestion?.answer) return;

        try {
            await answersApi.review(selectedQuestion.answer.id, action);

            const newStatus = action === 'approve' ? 'approved' : 'answered';
            setQuestions(questions.map(q =>
                q.id === selectedQuestion.id
                    ? { ...q, status: newStatus }
                    : q
            ));
            setSelectedQuestion({ ...selectedQuestion, status: newStatus });

            toast.success(action === 'approve' ? 'Answer approved!' : 'Answer rejected');
        } catch {
            toast.error('Failed to update review');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircleIcon className="h-4 w-4 text-success" />;
            case 'answered':
                return <SparklesIcon className="h-4 w-4 text-primary" />;
            case 'rejected':
                return <XCircleIcon className="h-4 w-4 text-error" />;
            default:
                return <div className="h-4 w-4 rounded-full border-2 border-text-muted" />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-48px)] flex flex-col -m-content">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-surface">
                <button
                    onClick={() => navigate(`/projects/${id}`)}
                    className="p-2 rounded-lg hover:bg-background transition-colors"
                >
                    <ArrowLeftIcon className="h-5 w-5 text-text-secondary" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold text-text-primary">Answer Workspace</h1>
                    <p className="text-sm text-text-secondary">
                        {questions.filter(q => q.status === 'approved').length} / {questions.length} questions approved
                    </p>
                </div>
                <div className="h-2 w-32 bg-background rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(questions.filter(q => q.status === 'approved').length / questions.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* 3-Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Question Navigator */}
                <div className="w-[280px] border-r border-border bg-surface overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                        <h2 className="text-sm font-medium text-text-secondary mb-3">Questions</h2>
                        <div className="space-y-1">
                            {questions.map((question, index) => (
                                <button
                                    key={question.id}
                                    onClick={() => handleSelectQuestion(question)}
                                    className={clsx(
                                        'w-full text-left p-3 rounded-lg transition-all',
                                        selectedQuestion?.id === question.id
                                            ? 'bg-primary-light border border-primary'
                                            : 'hover:bg-background'
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {getStatusIcon(question.status)}
                                        <span className="text-xs text-text-muted">#{index + 1}</span>
                                    </div>
                                    <p className="text-sm text-text-primary line-clamp-2">{question.text}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center: AI Answer Editor */}
                <div className="flex-1 flex flex-col overflow-hidden bg-background">
                    {selectedQuestion ? (
                        <>
                            {/* Question Display */}
                            <div className="p-6 bg-surface border-b border-border">
                                <div className="flex items-start gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                                        Q
                                    </div>
                                    <div>
                                        <p className="text-text-primary">{selectedQuestion.text}</p>
                                        {selectedQuestion.section && (
                                            <p className="text-sm text-text-muted mt-1">Section: {selectedQuestion.section}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Answer Editor */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                {selectedQuestion.answer || editorContent ? (
                                    <div className="space-y-4">
                                        {/* AI Badge */}
                                        {selectedQuestion.answer?.is_ai_generated && (
                                            <div className="flex items-center gap-2">
                                                <span className="badge-ai">
                                                    <SparklesIcon className="h-3 w-3 mr-1" />
                                                    AI Generated
                                                </span>
                                                {selectedQuestion.answer.confidence_score > 0 && (
                                                    <ConfidenceMeter score={selectedQuestion.answer.confidence_score} />
                                                )}
                                            </div>
                                        )}

                                        {/* Editor */}
                                        <div className="bg-surface rounded-xl border border-border p-4 min-h-[200px]">
                                            <textarea
                                                value={editorContent}
                                                onChange={(e) => setEditorContent(e.target.value)}
                                                className="w-full min-h-[150px] resize-none border-0 focus:ring-0 text-text-primary bg-transparent"
                                                placeholder="Type your answer here..."
                                            />
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleGenerateAnswer}
                                                disabled={isGenerating}
                                                className="btn-secondary"
                                            >
                                                <ArrowPathIcon className={clsx('h-4 w-4', isGenerating && 'animate-spin')} />
                                                Regenerate
                                            </button>
                                            <div className="flex-1" />
                                            <button
                                                onClick={() => handleReviewAction('reject')}
                                                className="btn-secondary text-error hover:bg-error-light"
                                            >
                                                <XCircleIcon className="h-4 w-4" />
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleReviewAction('approve')}
                                                className="btn-primary"
                                            >
                                                <CheckCircleIcon className="h-4 w-4" />
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <SparklesIcon className="h-12 w-12 text-primary mb-4" />
                                        <p className="text-text-primary font-medium mb-2">No answer yet</p>
                                        <p className="text-text-secondary text-sm mb-6">
                                            Let AI generate an answer based on your knowledge base
                                        </p>
                                        <button
                                            onClick={handleGenerateAnswer}
                                            disabled={isGenerating}
                                            className="btn-primary"
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
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-text-secondary">
                            Select a question to view and edit the answer
                        </div>
                    )}
                </div>

                {/* Right: Sources Panel */}
                <div className="w-[320px] border-l border-border bg-surface overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                        <h2 className="text-sm font-medium text-text-secondary mb-3">Sources & References</h2>

                        {selectedQuestion?.answer?.sources && selectedQuestion.answer.sources.length > 0 ? (
                            <div className="space-y-3">
                                {selectedQuestion.answer.sources.map((source, index) => (
                                    <div key={index} className="p-3 rounded-lg bg-background">
                                        <div className="flex items-start gap-2">
                                            <BookOpenIcon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-medium text-text-primary">{source.title}</p>
                                                <p className="text-xs text-text-muted mt-1">
                                                    Relevance: {Math.round(source.relevance * 100)}%
                                                </p>
                                                {source.snippet && (
                                                    <p className="text-xs text-text-secondary mt-2 line-clamp-3">
                                                        "{source.snippet}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-text-muted text-sm">
                                <DocumentTextIcon className="h-8 w-8 mx-auto mb-2" />
                                Sources will appear here after generating an answer
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Confidence Meter Component
function ConfidenceMeter({ score }: { score: number }) {
    const percentage = Math.round(score * 100);
    const color = percentage >= 80 ? 'text-success' : percentage >= 60 ? 'text-warning' : 'text-error';

    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={clsx('h-full rounded-full',
                        percentage >= 80 ? 'bg-success' : percentage >= 60 ? 'bg-warning' : 'bg-error'
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className={`text-xs font-medium ${color}`}>{percentage}%</span>
        </div>
    );
}
