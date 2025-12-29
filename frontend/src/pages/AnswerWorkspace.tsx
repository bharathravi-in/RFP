import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { questionsApi, answersApi, exportApi } from '@/api/client';
import { Question, Answer, SimilarAnswer, QuestionCategory } from '@/types';
import { useRealTime } from '@/hooks/useRealTime';
import ActiveUsers from '@/components/collaboration/ActiveUsers';
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
    FunnelIcon,
    ExclamationTriangleIcon,
    LightBulbIcon,
    ShieldCheckIcon,
    ScaleIcon,
    CodeBracketIcon,
    CurrencyDollarIcon,
    CubeIcon,
} from '@heroicons/react/24/outline';
import DiagramRenderer from '@/components/diagrams/DiagramRenderer';
import SimpleMarkdown from '@/components/common/SimpleMarkdown';

// Category configuration for badges
const CATEGORY_CONFIG: Record<string, { icon: typeof ShieldCheckIcon; color: string; bg: string }> = {
    security: { icon: ShieldCheckIcon, color: 'text-red-700', bg: 'bg-red-100' },
    compliance: { icon: ScaleIcon, color: 'text-purple-700', bg: 'bg-purple-100' },
    technical: { icon: CodeBracketIcon, color: 'text-blue-700', bg: 'bg-blue-100' },
    pricing: { icon: CurrencyDollarIcon, color: 'text-green-700', bg: 'bg-green-100' },
    legal: { icon: ScaleIcon, color: 'text-orange-700', bg: 'bg-orange-100' },
    product: { icon: CubeIcon, color: 'text-cyan-700', bg: 'bg-cyan-100' },
    general: { icon: DocumentTextIcon, color: 'text-gray-700', bg: 'bg-gray-100' },
};

export default function AnswerWorkspace() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editorContent, setEditorContent] = useState('');

    // New state for AI workflow features
    const [similarAnswers, setSimilarAnswers] = useState<SimilarAnswer[]>([]);
    const [answerFlags, setAnswerFlags] = useState<string[]>([]);
    const [suggestedDiagram, setSuggestedDiagram] = useState<any | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showSimilarPanel, setShowSimilarPanel] = useState(false);
    const [isPreview, setIsPreview] = useState(false);

    // Collaboration hook
    const { activeUsers, updateCursor, broadcastChange, lastRemoteChange } = useRealTime(id);

    const loadQuestions = useCallback(async () => {
        if (!id) return;

        try {
            const response = await questionsApi.list(Number(id));
            setQuestions(response.data.questions || []);
        } catch {
            toast.error('Failed to load questions');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadQuestions();
    }, [loadQuestions]);

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
    }, [searchParams, questions, selectedQuestion]);

    // Handle remote content changes
    useEffect(() => {
        if (lastRemoteChange && selectedQuestion && lastRemoteChange.section_id === selectedQuestion.id) {
            setEditorContent(lastRemoteChange.content);
            // Optionally update the question in the list too
            setQuestions(prev => prev.map(q =>
                q.id === selectedQuestion.id
                    ? { ...q, answer: { ...q.answer, content: lastRemoteChange.content } as Answer }
                    : q
            ));
        }
    }, [lastRemoteChange, selectedQuestion]);

    const handleSelectQuestion = (question: Question) => {
        setSelectedQuestion(question);
        setEditorContent(question.answer?.content || '');
        // Clear previous similar answers when switching questions
        setSimilarAnswers([]);
        setAnswerFlags(question.flags || []);
    };

    const handleGenerateAnswer = async () => {
        if (!selectedQuestion) return;

        setIsGenerating(true);
        try {
            const response = await answersApi.generate(selectedQuestion.id);
            const { answer: newAnswer, classification, flags, similar_answers, suggested_diagram } = response.data;

            setEditorContent(newAnswer.content);

            // Store similar answers, flags, and suggested diagram for display
            if (similar_answers) {
                setSimilarAnswers(similar_answers);
                setShowSimilarPanel(similar_answers.length > 0);
            }
            if (flags) {
                setAnswerFlags(flags);
            }
            if (suggested_diagram) {
                setSuggestedDiagram(suggested_diagram);
            } else {
                setSuggestedDiagram(null);
            }

            // Update question with classification data
            const updatedQuestion = {
                ...selectedQuestion,
                answer: newAnswer,
                status: 'answered' as const,
                category: classification?.category || selectedQuestion.category,
                sub_category: classification?.sub_category || selectedQuestion.sub_category,
                priority: classification?.priority || selectedQuestion.priority,
                flags: flags || selectedQuestion.flags,
            };

            // Update question in list
            setQuestions(questions.map(q =>
                q.id === selectedQuestion.id ? updatedQuestion : q
            ));
            setSelectedQuestion(updatedQuestion);

            // Show toast with classification info
            if (classification?.category) {
                toast.success(`Answer generated! Classified as: ${classification.category}`);
            } else {
                toast.success('Answer generated!');
            }

            // Show warning if low confidence or has flags
            if (newAnswer.confidence_score && newAnswer.confidence_score < 0.6) {
                toast('⚠️ Low confidence answer - please review carefully', { icon: '⚠️' });
            }
            if (flags && flags.length > 0) {
                toast(`${flags.length} flag(s) detected - review recommended`, { icon: '🚩' });
            }
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

    const handleExportDocx = async () => {
        try {
            const response = await exportApi.docx(Number(id));
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'RFP_Response.docx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('DOCX exported successfully!');
        } catch {
            toast.error('Failed to export DOCX');
        }
    };

    const handleExportXlsx = async () => {
        try {
            const response = await exportApi.xlsx(Number(id));
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'RFP_Response.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Excel exported successfully!');
        } catch {
            toast.error('Failed to export Excel');
        }
    };

    const handleCompleteProject = async () => {
        try {
            await exportApi.complete(Number(id));
            toast.success('Project marked as complete! 🎉');
            navigate('/projects');
        } catch {
            toast.error('Failed to complete project');
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

                <div className="flex items-center gap-6">
                    {/* Active Users */}
                    <ActiveUsers users={activeUsers} />

                    <div className="flex items-center gap-2">
                        <div className="h-2 w-32 bg-background rounded-full overflow-hidden border border-border">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${(questions.filter(q => q.status === 'approved').length / Math.max(questions.length, 1)) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3-Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Question Navigator */}
                <div className="w-[280px] border-r border-border bg-surface overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                        {/* Category Filter */}
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-medium text-text-secondary">Questions</h2>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="text-xs border border-border rounded px-2 py-1 bg-background text-text-primary"
                            >
                                <option value="all">All Categories</option>
                                <option value="security">🛡️ Security</option>
                                <option value="compliance">⚖️ Compliance</option>
                                <option value="technical">💻 Technical</option>
                                <option value="pricing">💰 Pricing</option>
                                <option value="legal">📜 Legal</option>
                                <option value="product">📦 Product</option>
                                <option value="general">📄 General</option>
                            </select>
                        </div>

                        {/* Question List */}
                        <div className="space-y-1">
                            {questions
                                .filter(q => categoryFilter === 'all' || q.category === categoryFilter)
                                .map((question, index) => {
                                    const categoryConfig = question.category ? CATEGORY_CONFIG[question.category] : null;
                                    const CategoryIcon = categoryConfig?.icon || DocumentTextIcon;

                                    return (
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
                                                {question.category && (
                                                    <span className={clsx(
                                                        'text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1',
                                                        categoryConfig?.bg, categoryConfig?.color
                                                    )}>
                                                        <CategoryIcon className="h-3 w-3" />
                                                        {question.category}
                                                    </span>
                                                )}
                                                {question.priority === 'high' && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                                        High
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-text-primary line-clamp-2">{question.text}</p>
                                            {question.flags && question.flags.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <ExclamationTriangleIcon className="h-3 w-3 text-warning" />
                                                    <span className="text-xs text-warning">{question.flags.length} flag(s)</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                </div>

                {/* Center: AI Answer Editor */}
                <div className="flex-1 flex flex-col overflow-hidden bg-background">
                    {/* Show completion panel when all questions are approved */}
                    {questions.length > 0 && questions.every(q => q.status === 'approved') ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8">
                            <div className="text-center max-w-md">
                                <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
                                    <CheckCircleIcon className="h-10 w-10 text-success" />
                                </div>
                                <h2 className="text-2xl font-bold text-text-primary mb-2">All Done! 🎉</h2>
                                <p className="text-text-secondary mb-8">
                                    All {questions.length} questions have been answered and approved.
                                    You can now export your responses or mark the project as complete.
                                </p>

                                <div className="space-y-3">
                                    <button
                                        onClick={handleExportDocx}
                                        className="w-full btn-primary flex items-center justify-center gap-2"
                                    >
                                        <DocumentTextIcon className="h-5 w-5" />
                                        Export as DOCX
                                    </button>
                                    <button
                                        onClick={handleExportXlsx}
                                        className="w-full btn-secondary flex items-center justify-center gap-2"
                                    >
                                        <DocumentTextIcon className="h-5 w-5" />
                                        Export as Excel
                                    </button>
                                    <button
                                        onClick={handleCompleteProject}
                                        className="w-full bg-success text-white px-4 py-2 rounded-lg hover:bg-success/90 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CheckCircleIcon className="h-5 w-5" />
                                        Mark Project Complete
                                    </button>

                                    <div className="pt-3 border-t border-border mt-3">
                                        <p className="text-sm text-text-muted text-center mb-3">
                                            Ready to build your full proposal?
                                        </p>
                                        <button
                                            onClick={() => navigate(`/projects/${id}/proposal`)}
                                            className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                                        >
                                            <SparklesIcon className="h-5 w-5" />
                                            Go to Proposal Builder
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : selectedQuestion ? (
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

                                        {/* Editor/Preview Controls */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <button
                                                onClick={() => setIsPreview(false)}
                                                className={clsx(
                                                    'px-3 py-1 rounded-md text-sm font-medium transition-all',
                                                    !isPreview ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:bg-background'
                                                )}
                                            >
                                                Write
                                            </button>
                                            <button
                                                onClick={() => setIsPreview(true)}
                                                className={clsx(
                                                    'px-3 py-1 rounded-md text-sm font-medium transition-all',
                                                    isPreview ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:bg-background'
                                                )}
                                            >
                                                Preview
                                            </button>
                                        </div>

                                        {/* Editor or Preview */}
                                        <div className="bg-surface rounded-xl border border-border p-4 min-h-[300px] focus-within:ring-2 focus-within:ring-primary/20 transition-all relative">
                                            {isPreview ? (
                                                <div className="max-w-none">
                                                    <SimpleMarkdown content={editorContent} />
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={editorContent}
                                                    onChange={(e) => {
                                                        const newContent = e.target.value;
                                                        setEditorContent(newContent);
                                                        if (selectedQuestion) {
                                                            broadcastChange(selectedQuestion.id, newContent);
                                                        }
                                                    }}
                                                    onFocus={() => {
                                                        if (selectedQuestion) {
                                                            updateCursor(selectedQuestion.id, 'content');
                                                        }
                                                    }}
                                                    className="w-full min-h-[250px] resize-none border-0 focus:ring-0 text-text-primary bg-transparent text-lg leading-relaxed"
                                                    placeholder="Type your answer here..."
                                                />
                                            )}
                                            {/* Typing Indicator */}
                                            {lastRemoteChange && lastRemoteChange.section_id === selectedQuestion.id && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-primary animate-pulse font-bold uppercase tracking-widest bg-white/80 px-2 py-1 rounded shadow-sm border border-primary/10">
                                                    <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
                                                    {lastRemoteChange.user_name} is editing
                                                </div>
                                            )}
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

                {/* Right: Sources & Similar Answers Panel */}
                <div className="w-[320px] border-l border-border bg-surface overflow-y-auto custom-scrollbar">
                    <div className="p-4 space-y-6">
                        {/* Similar Answers Section */}
                        {showSimilarPanel && similarAnswers.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <LightBulbIcon className="h-4 w-4 text-warning" />
                                    <h2 className="text-sm font-medium text-text-secondary">Similar Approved Answers</h2>
                                </div>
                                <div className="space-y-2">
                                    {similarAnswers.slice(0, 3).map((similar, index) => (
                                        <div key={index} className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                                            <p className="text-xs text-text-muted mb-1">
                                                {Math.round(similar.similarity_score * 100)}% match
                                            </p>
                                            <p className="text-sm text-text-primary line-clamp-2 mb-2">
                                                {similar.question_text}
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setEditorContent(similar.answer_content);
                                                    toast.success('Template applied! Edit as needed.');
                                                }}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                Use as template →
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Flags Section */}
                        {answerFlags.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <ExclamationTriangleIcon className="h-4 w-4 text-error" />
                                    <h2 className="text-sm font-medium text-text-secondary">Review Flags</h2>
                                </div>
                                <div className="space-y-2">
                                    {answerFlags.map((flag, index) => (
                                        <div key={index} className="p-2 rounded-lg bg-error/10 border border-error/20">
                                            <p className="text-sm text-error capitalize">
                                                {flag.replace(/_/g, ' ')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Suggested Diagram Section */}
                        {suggestedDiagram && (
                            <div className="pt-4 border-t border-border">
                                <div className="flex items-center gap-2 mb-3">
                                    <CubeIcon className="h-4 w-4 text-primary" />
                                    <h2 className="text-sm font-medium text-text-secondary">Suggested Diagram</h2>
                                </div>
                                <div className="space-y-3">
                                    <div className="rounded-lg border border-border bg-background overflow-hidden">
                                        <DiagramRenderer
                                            code={suggestedDiagram.mermaid_code}
                                            title={suggestedDiagram.title}
                                            description={suggestedDiagram.description}
                                            compact={true}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const diagramMarkdown = `\n\n### ${suggestedDiagram.title}\n\n${suggestedDiagram.description}\n\n\`\`\`mermaid\n${suggestedDiagram.mermaid_code}\n\`\`\`\n\n${suggestedDiagram.notes || ''}`;
                                            setEditorContent(editorContent + diagramMarkdown);
                                            setSuggestedDiagram(null);
                                            toast.success('Diagram added to answer!');
                                        }}
                                        className="w-full btn-secondary text-xs py-1.5"
                                    >
                                        Apply to Answer
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Sources Section */}
                        <div className="pt-4 border-t border-border">
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
            </div >
        </div >
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
