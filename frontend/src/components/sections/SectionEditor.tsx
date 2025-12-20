import { useState, useEffect } from 'react';
import { sectionsApi, questionsApi } from '@/api/client';
import { RFPSection, Question } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import SimpleMarkdown from '@/components/common/SimpleMarkdown';
import {
    SparklesIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    DocumentTextIcon,
    BookOpenIcon,
    ExclamationTriangleIcon,
    PencilIcon,
    ChatBubbleLeftRightIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import QuestionAnswerModal from '@/components/QuestionAnswerModal';
import ClarificationQuestions from '@/components/sections/ClarificationQuestions';
import SectionAIChatSidebar from '@/components/sections/SectionAIChatSidebar';
import QuestionsTableView from '@/components/sections/QuestionsTableView';
import { ConfidenceIndicator } from '@/components/ai';
import {
    NarrativeEditor,
    TableEditor,
    CardEditor,
    TechnicalEditor,
    DiagramEditor,
} from '@/components/editors';

interface SectionEditorProps {
    section: RFPSection;
    projectId: number;
    onUpdate: (section: RFPSection) => void;
}

export default function SectionEditor({ section, projectId, onUpdate }: SectionEditorProps) {
    const [content, setContent] = useState(section.content || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [showFeedbackInput, setShowFeedbackInput] = useState(false);
    const [showAIChatPanel, setShowAIChatPanel] = useState(false);

    // Q&A Section state
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [showCreateQuestion, setShowCreateQuestion] = useState(false);
    const [newQuestionText, setNewQuestionText] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Check if this is a Q&A section
    const isQASection = section.section_type?.slug === 'customer_queries' ||
        section.section_type?.slug === 'questions' ||
        section.section_type?.name?.toLowerCase().includes('questionnaire') ||
        section.section_type?.name?.toLowerCase().includes('q&a');

    // Check if this is a Clarifications section
    const isClarificationsSection = section.section_type?.slug === 'clarifications_questions';

    // Determine which editor to use based on template_type
    const templateType = section.section_type?.template_type || 'narrative';

    // Sync content when section changes
    useEffect(() => {
        setContent(section.content || '');
        setIsEditing(false);

        // Load questions for Q&A sections
        if (isQASection) {
            loadQuestions();
        }
    }, [section.id, isQASection]);

    const loadQuestions = async () => {
        setLoadingQuestions(true);
        try {
            const response = await questionsApi.list(projectId);
            setQuestions(response.data.questions || []);
        } catch (error) {
            console.error('Failed to load questions:', error);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const handleCreateQuestion = async () => {
        if (!newQuestionText.trim()) {
            toast.error('Please enter a question');
            return;
        }

        setIsCreating(true);
        try {
            const response = await questionsApi.create(projectId, {
                text: newQuestionText,
                section: '',
            });
            setQuestions([...questions, response.data.question]);
            setNewQuestionText('');
            setShowCreateQuestion(false);
            toast.success('Question created!');
        } catch {
            toast.error('Failed to create question');
        } finally {
            setIsCreating(false);
        }
    };

    const handleQuestionUpdate = (updatedQuestion: Question) => {
        setQuestions(questions.map(q =>
            q.id === updatedQuestion.id ? updatedQuestion : q
        ));
        setSelectedQuestion(updatedQuestion);
    };

    const handleQuestionDelete = (questionId: number) => {
        setQuestions(questions.filter(q => q.id !== questionId));
        setSelectedQuestion(null);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const response = await sectionsApi.generateSection(section.id);
            const updatedSection = response.data.section;
            setContent(updatedSection.content || '');
            onUpdate(updatedSection);
            toast.success('Section content generated!');

            if (updatedSection.confidence_score && updatedSection.confidence_score < 0.6) {
                toast('⚠️ Low confidence - please review carefully', { icon: '⚠️' });
            }
        } catch {
            toast.error('Failed to generate content');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRegenerate = async () => {
        if (!feedback.trim()) {
            toast.error('Please provide feedback for regeneration');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await sectionsApi.regenerateSection(section.id, feedback);
            const updatedSection = response.data.section;
            setContent(updatedSection.content || '');
            onUpdate(updatedSection);
            setFeedback('');
            setShowFeedbackInput(false);
            toast.success('Section regenerated!');
        } catch {
            toast.error('Failed to regenerate content');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await sectionsApi.updateSection(projectId, section.id, {
                content,
            });
            onUpdate(response.data.section);
            setIsEditing(false);
            toast.success('Changes saved');
        } catch {
            toast.error('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReview = async (action: 'approve' | 'reject') => {
        try {
            const response = await sectionsApi.reviewSection(section.id, action);
            onUpdate(response.data.section);
            toast.success(`Section ${action}d`);
        } catch {
            toast.error(`Failed to ${action} section`);
        }
    };

    // Handler for AI-generated content from chat panel
    const handleAIContent = async (generatedContent: string) => {
        setIsSaving(true);
        try {
            const response = await sectionsApi.updateSection(projectId, section.id, {
                content: generatedContent,
                status: 'generated',
            });
            setContent(generatedContent);
            onUpdate(response.data.section);
            setShowAIChatPanel(false);
        } catch {
            toast.error('Failed to update section');
        } finally {
            setIsSaving(false);
        }
    };

    // Handler for saving from specialized editors
    const handleEditorSave = async (editorData: any) => {
        setIsSaving(true);
        try {
            // Transform editor data to content string based on editor type
            let contentToSave = '';

            if (templateType === 'narrative') {
                contentToSave = editorData.content || '';
            } else if (templateType === 'table') {
                // For table editor, store as JSON string
                contentToSave = JSON.stringify({
                    type: 'table',
                    columns: editorData.columns,
                    rows: editorData.rows,
                    style: editorData.style,
                });
            } else if (templateType === 'card') {
                // For card editor, store as JSON string
                contentToSave = JSON.stringify({
                    type: 'card',
                    cards: editorData.cards,
                    templateType: editorData.templateType,
                    columnLayout: editorData.columnLayout,
                });
            } else if (templateType === 'technical') {
                // For technical editor, store as JSON string
                contentToSave = JSON.stringify({
                    type: 'technical',
                    description: editorData.description,
                    codeBlocks: editorData.codeBlocks,
                });
            }

            const response = await sectionsApi.updateSection(projectId, section.id, {
                content: contentToSave,
            });

            setContent(contentToSave);
            setIsEditing(false);
            onUpdate(response.data.section);
            toast.success('Changes saved');
        } catch (error) {
            console.error('Failed to save changes:', error);
            toast.error('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    // Render the appropriate editor based on template type and whether we're editing
    const renderEditor = () => {
        // Diagram sections always show DiagramEditor (it handles both view and edit)
        if (templateType === 'diagram') {
            return (
                <DiagramEditor
                    sectionId={section.id}
                    content={content}
                    onContentChange={(newContent) => {
                        setContent(newContent);
                        handleEditorSave(newContent);
                    }}
                />
            );
        }

        // Return null if not editing for other types
        if (!isEditing) {
            return null;
        }

        // Parse content if it's JSON (for table, card, technical)
        let parsedContent: any = null;
        if (['table', 'card', 'technical'].includes(templateType)) {
            try {
                parsedContent = JSON.parse(content || '{}');
            } catch {
                parsedContent = { type: templateType };
            }
        }

        switch (templateType) {
            case 'narrative':
                return (
                    <NarrativeEditor
                        content={content}
                        onSave={handleEditorSave}
                        onCancel={() => {
                            setContent(section.content || '');
                            setIsEditing(false);
                        }}
                        isSaving={isSaving}
                        color={section.section_type?.color}
                    />
                );

            case 'table':
                return (
                    <TableEditor
                        columns={parsedContent?.columns || []}
                        rows={parsedContent?.rows || []}
                        style={parsedContent?.style || 'default'}
                        onSave={handleEditorSave}
                        onCancel={() => {
                            setContent(section.content || '');
                            setIsEditing(false);
                        }}
                        isSaving={isSaving}
                        color={section.section_type?.color}
                    />
                );

            case 'card':
                return (
                    <CardEditor
                        cards={parsedContent?.cards || []}
                        templateType={parsedContent?.templateType || 'generic'}
                        columnLayout={parsedContent?.columnLayout || 2}
                        onSave={handleEditorSave}
                        onCancel={() => {
                            setContent(section.content || '');
                            setIsEditing(false);
                        }}
                        isSaving={isSaving}
                        color={section.section_type?.color}
                    />
                );

            case 'technical':
                return (
                    <TechnicalEditor
                        description={parsedContent?.description || ''}
                        codeBlocks={parsedContent?.codeBlocks || []}
                        onSave={handleEditorSave}
                        onCancel={() => {
                            setContent(section.content || '');
                            setIsEditing(false);
                        }}
                        isSaving={isSaving}
                        color={section.section_type?.color}
                    />
                );

            case 'diagram':
                return (
                    <DiagramEditor
                        sectionId={section.id}
                        content={content}
                        onContentChange={(newContent) => {
                            setContent(newContent);
                            handleEditorSave(newContent);
                        }}
                    />
                );

            default:
                // Fallback to plain textarea
                return (
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full h-full px-4 py-3 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm"
                    />
                );
        }
    };

    // Stats for Q&A section
    const answeredCount = questions.filter(q => q.status === 'answered' || q.status === 'approved').length;
    const approvedCount = questions.filter(q => q.status === 'approved').length;

    return (
        <div className="h-full flex flex-col">
            {/* Section Header */}
            <div className="px-6 py-4 border-b border-border bg-surface">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{section.section_type?.icon || '📄'}</span>
                        <div>
                            <h2 className="text-lg font-semibold text-text-primary">
                                {section.title}
                            </h2>
                            <p className="text-sm text-text-secondary">
                                {section.section_type?.name}
                                {isQASection && ` • ${answeredCount}/${questions.length} answered • ${approvedCount} approved`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Add Question button for Q&A sections */}
                        {isQASection && (
                            <button
                                onClick={() => setShowCreateQuestion(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Question
                            </button>
                        )}

                        {/* Status Badge */}
                        <span className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            section.status === 'approved' && 'bg-success-light text-success',
                            section.status === 'generated' && 'bg-primary-light text-primary',
                            section.status === 'rejected' && 'bg-error-light text-error',
                            section.status === 'draft' && 'bg-gray-100 text-gray-600',
                        )}>
                            {section.status.charAt(0).toUpperCase() + section.status.slice(1)}
                        </span>
                    </div>
                </div>

                {/* Action Buttons - Only for non-Q&A and non-Diagram sections */}
                {!isQASection && templateType !== 'diagram' && (
                    <div className="flex items-center gap-2 mt-3">
                        {!section.content ? (
                            <>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    {isGenerating ? (
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <SparklesIcon className="h-4 w-4" />
                                    )}
                                    Generate Content
                                </button>
                                <button
                                    onClick={() => setShowAIChatPanel(true)}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                    AI Assistant
                                </button>
                            </>
                        ) : (
                            <>
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="btn-secondary flex items-center gap-2"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                        Edit
                                    </button>
                                ) : (
                                    <>
                                        {templateType !== 'narrative' && templateType !== 'table' && templateType !== 'card' && templateType !== 'technical' ? (
                                            <>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={isSaving}
                                                    className="btn-primary flex items-center gap-2"
                                                >
                                                    {isSaving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                                                    Save Changes
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setContent(section.content || '');
                                                        setIsEditing(false);
                                                    }}
                                                    className="btn-secondary"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <p className="text-sm text-text-muted">
                                                Use the save/cancel buttons in the editor below
                                            </p>
                                        )}
                                    </>
                                )}

                                <button
                                    onClick={() => setShowFeedbackInput(!showFeedbackInput)}
                                    disabled={isGenerating}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    <ArrowPathIcon className="h-4 w-4" />
                                    Regenerate
                                </button>

                                <button
                                    onClick={() => setShowAIChatPanel(true)}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                    AI Assistant
                                </button>

                                {section.status !== 'approved' && (
                                    <button
                                        onClick={() => handleReview('approve')}
                                        className="btn-success flex items-center gap-2 ml-auto"
                                    >
                                        <CheckCircleIcon className="h-4 w-4" />
                                        Approve
                                    </button>
                                )}
                                {section.status !== 'rejected' && (
                                    <button
                                        onClick={() => handleReview('reject')}
                                        className="btn-error flex items-center gap-2"
                                    >
                                        <XCircleIcon className="h-4 w-4" />
                                        Reject
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Regenerate Feedback Input */}
                {showFeedbackInput && (
                    <div className="mt-3 p-3 rounded-lg bg-background border border-border">
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Feedback for Regeneration
                        </label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Describe what you'd like to change..."
                            rows={2}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                onClick={() => setShowFeedbackInput(false)}
                                className="btn-secondary text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRegenerate}
                                disabled={isGenerating || !feedback.trim()}
                                className="btn-primary text-sm flex items-center gap-2"
                            >
                                {isGenerating && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                                Regenerate
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Column */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Scrollable Content */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        {isQASection ? (
                            // Q&A Section - Show Questions List
                            <div className="space-y-4">
                                {/* Create Question Form */}
                                {showCreateQuestion && (
                                    <div className="p-4 rounded-lg border-2 border-dashed border-primary bg-primary-light/20 mb-4">
                                        <label className="block text-sm font-medium text-text-primary mb-2">
                                            New Question
                                        </label>
                                        <textarea
                                            value={newQuestionText}
                                            onChange={(e) => setNewQuestionText(e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                            placeholder="Enter your question..."
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2 mt-3">
                                            <button
                                                onClick={() => {
                                                    setShowCreateQuestion(false);
                                                    setNewQuestionText('');
                                                }}
                                                className="btn-secondary text-sm"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCreateQuestion}
                                                disabled={isCreating || !newQuestionText.trim()}
                                                className="btn-primary text-sm flex items-center gap-2"
                                            >
                                                {isCreating && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                                                <PlusIcon className="h-4 w-4" />
                                                Create Question
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {loadingQuestions ? (
                                    <div className="flex items-center justify-center py-12">
                                        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <QuestionsTableView
                                        questions={questions}
                                        projectId={projectId}
                                        onQuestionClick={setSelectedQuestion}
                                        onQuestionUpdate={(questionId, updates) => {
                                            const question = questions.find(q => q.id === questionId);
                                            if (question) {
                                                handleQuestionUpdate({ ...question, ...updates });
                                            }
                                        }}
                                        onQuestionDelete={handleQuestionDelete}
                                        onCreateQuestion={async (text) => {
                                            try {
                                                const response = await questionsApi.create(projectId, { text });
                                                setQuestions(prev => [...prev, response.data]);
                                                toast.success('Question created');
                                            } catch {
                                                toast.error('Failed to create question');
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        ) : !section.content ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <DocumentTextIcon className="h-16 w-16 text-text-muted mb-4" />
                                <h3 className="text-lg font-medium text-text-primary mb-2">
                                    No Content Yet
                                </h3>
                                <p className="text-text-secondary mb-6 max-w-md">
                                    Click "Generate Content" to create AI-powered content for this section
                                    based on your knowledge base.
                                </p>
                            </div>
                        ) : templateType === 'diagram' ? (
                            // Diagram sections always show DiagramEditor
                            renderEditor()
                        ) : isEditing ? (
                            renderEditor()
                        ) : (
                            <div className="prose prose-sm max-w-none">
                                <div className="whitespace-pre-wrap text-text-primary">
                                    {(() => {
                                        // Handle display of content based on template type
                                        if (['table', 'card', 'technical'].includes(templateType)) {
                                            try {
                                                const parsed = JSON.parse(content);
                                                if (templateType === 'table') {
                                                    return (
                                                        <div className="w-full overflow-x-auto">
                                                            <table className="w-full border-collapse">
                                                                <thead>
                                                                    <tr>
                                                                        {parsed.columns?.map((col: any, idx: number) => (
                                                                            <th key={idx} className="border border-border p-2 bg-surface text-left">
                                                                                {col.name}
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {parsed.rows?.map((row: any, rIdx: number) => (
                                                                        <tr key={rIdx}>
                                                                            {row.map((cell: any, cIdx: number) => (
                                                                                <td key={cIdx} className="border border-border p-2">
                                                                                    {cell}
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                } else if (templateType === 'card') {
                                                    return (
                                                        <div className={`grid gap-4 grid-cols-${parsed.columnLayout || 2}`}>
                                                            {parsed.cards?.map((card: any, idx: number) => (
                                                                <div key={idx} className="p-4 rounded-lg border border-border bg-surface">
                                                                    {card.image && (
                                                                        <img src={card.image} alt={card.title} className="w-full h-40 object-cover rounded-lg mb-3" />
                                                                    )}
                                                                    <h3 className="font-bold text-text-primary mb-2">{card.title}</h3>
                                                                    <p className="text-text-secondary">{card.description}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                } else if (templateType === 'technical') {
                                                    return (
                                                        <div className="space-y-4">
                                                            {parsed.description && (
                                                                <div className="p-4 rounded-lg bg-surface border border-border">
                                                                    <p className="text-text-primary whitespace-pre-wrap">{parsed.description}</p>
                                                                </div>
                                                            )}
                                                            {parsed.codeBlocks?.map((block: any, idx: number) => (
                                                                <div key={idx} className="p-4 rounded-lg bg-gray-900 text-white font-mono text-sm overflow-x-auto">
                                                                    <div className="text-gray-400 mb-2">{block.language || 'code'}</div>
                                                                    <pre>{block.code}</pre>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                            } catch {
                                                // If JSON parsing fails, show raw content
                                                return content;
                                            }
                                        }
                                        // Default narrative display - render as markdown
                                        return <SimpleMarkdown content={content} />;
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>


                {/* Right Sidebar - Sources & Flags (only for non-Q&A sections with content) */}
                {!isQASection && section.content && (
                    <div className="w-[280px] border-l border-border bg-surface p-4 overflow-y-auto custom-scrollbar flex-shrink-0">
                        {/* Flags */}
                        {section.flags && section.flags.filter((f: any) => typeof f === 'string').length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                                    <ExclamationTriangleIcon className="h-4 w-4 text-warning" />
                                    Review Flags
                                </h3>
                                <div className="space-y-2">
                                    {section.flags.filter((f: any) => typeof f === 'string').map((flag: string, idx: number) => (
                                        <div
                                            key={idx}
                                            className="p-2 rounded-lg bg-warning-light border border-warning-light"
                                        >
                                            <p className="text-sm text-warning-dark capitalize">
                                                {flag.replace(/_/g, ' ')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Confidence Score */}
                        {section.confidence_score !== null && section.confidence_score !== undefined && (
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                                    <SparklesIcon className="h-4 w-4" />
                                    AI Confidence
                                </h3>
                                <ConfidenceIndicator
                                    score={section.confidence_score}
                                    showExplanation={true}
                                    size="md"
                                />
                            </div>
                        )}

                        {/* Sources */}
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                                <BookOpenIcon className="h-4 w-4" />
                                Sources
                            </h3>
                            {section.sources && section.sources.length > 0 ? (
                                <div className="space-y-2">
                                    {section.sources.map((source, idx) => (
                                        <div
                                            key={idx}
                                            className="p-2 rounded-lg bg-background"
                                        >
                                            <p className="text-sm font-medium text-text-primary">
                                                {source.title}
                                            </p>
                                            <p className="text-xs text-text-muted mt-1">
                                                Relevance: {Math.round(source.relevance * 100)}%
                                            </p>
                                            {source.snippet && (
                                                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                                                    "{source.snippet}"
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-text-muted">
                                    No sources cited
                                </p>
                            )}
                        </div>

                        {/* Clarification Questions inside sidebar */}
                        {!isClarificationsSection && (
                            <ClarificationQuestions
                                section={section}
                                projectId={projectId}
                                onUpdate={onUpdate}
                            />
                        )}
                    </div>
                )}

                {/* Clarification Questions - Full section if clarifications_questions type */}
                {isClarificationsSection && (
                    <ClarificationQuestions
                        section={section}
                        projectId={projectId}
                        onUpdate={onUpdate}
                    />
                )}

                {/* AI Chat Sidebar - for non-Q&A sections */}
                {!isQASection && (
                    <SectionAIChatSidebar
                        section={section}
                        projectId={projectId}
                        isOpen={showAIChatPanel}
                        onClose={() => setShowAIChatPanel(false)}
                        onContentGenerated={handleAIContent}
                    />
                )}
            </div>

            {/* Question Answer Modal */}
            {selectedQuestion && (
                <QuestionAnswerModal
                    question={selectedQuestion}
                    projectId={projectId}
                    onClose={() => setSelectedQuestion(null)}
                    onUpdate={handleQuestionUpdate}
                    onDelete={handleQuestionDelete}
                />
            )}
        </div>
    );
}
