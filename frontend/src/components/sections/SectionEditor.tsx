import { useState, useEffect } from 'react';
import { sectionsApi, questionsApi, usersApi } from '@/api/client';
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
    ClockIcon,
    Cog8ToothIcon,
} from '@heroicons/react/24/outline';
import QuestionAnswerModal from '@/components/QuestionAnswerModal';
import ClarificationQuestions from '@/components/sections/ClarificationQuestions';
import SectionAIChatSidebar from '@/components/sections/SectionAIChatSidebar';
import SectionHistory from '@/components/sections/SectionHistory';
import SectionDetailsSidebar from '@/components/sections/SectionDetailsSidebar';
import RelatedQASidebar from '@/components/sections/RelatedQASidebar';
import { ConfidenceIndicator } from '@/components/ai';
import {
    NarrativeEditor,
    TableEditor,
    CardEditor,
    TechnicalEditor,
    TimelineEditor,
    ComplianceMatrixEditor,
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
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showDetailsSidebar, setShowDetailsSidebar] = useState(false);

    // Q&A Section state
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [showCreateQuestion, setShowCreateQuestion] = useState(false);
    const [newQuestionText, setNewQuestionText] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
    const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

    // Related Questions panel state
    const [showRelatedQuestions, setShowRelatedQuestions] = useState(true);

    // Related Q&A sidebar state (NEW)
    const [showQASidebar, setShowQASidebar] = useState(true);

    // Knowledge Sources panel state
    const [showSources, setShowSources] = useState(false);

    // Users for assignee dropdown
    const [orgUsers, setOrgUsers] = useState<{ id: number; name: string; email: string }[]>([]);

    // Category-to-section mapping - EXCLUSIVE matching
    // Backend AI categories: security, compliance, technical, pricing, legal, product, support, integration, general
    const SECTION_CATEGORY_MAPPING: Record<string, string[]> = {
        'technical_approach': ['technical', 'integration', 'product'],
        'project_architecture': ['technical', 'integration'],
        'compliance_matrix': ['compliance', 'security', 'legal'],
        'security_compliance': ['security', 'compliance'],
        'company_profile': ['general'],
        'company_strengths': ['general'],
        'resource_allocation': ['support'],
        'project_estimation': ['pricing'],
        'pricing_cost': ['pricing'],
        'case_studies': ['general'],
        'support_maintenance': ['support'],
    };

    // Check if this is a Q&A section
    const isQASection = section.section_type?.slug === 'qa_questionnaire' ||
        section.section_type?.name?.toLowerCase().includes('questionnaire') ||
        section.section_type?.name?.toLowerCase().includes('q&a');

    // Check if this is a Clarifications section
    const isClarificationsSection = section.section_type?.slug === 'clarifications_questions';

    // Determine which editor to use based on template_type
    const templateType = section.section_type?.template_type || 'narrative';

    // Check if a question matches a specific section
    const questionMatchesSection = (q: Question, sectionSlug: string): boolean => {
        const categoryKeywords = SECTION_CATEGORY_MAPPING[sectionSlug] || [];
        if (categoryKeywords.length === 0) return false;

        const questionCategory = (q.category || '').toLowerCase();
        // Exact match against AI-generated categories
        return categoryKeywords.includes(questionCategory);
    };

    // Get section-specific questions (for non-Q&A sections)
    const getSectionQuestions = (): Question[] => {
        if (isQASection || isClarificationsSection) return [];
        const sectionSlug = section.section_type?.slug || '';
        return questions.filter(q => questionMatchesSection(q, sectionSlug));
    };

    // Get unmatched questions (for Q&A section - questions that don't belong to any specific section)
    const getUnmatchedQuestions = (): Question[] => {
        if (!isQASection) return [];
        return questions.filter(q => {
            // Check if this question matches ANY section
            for (const sectionSlug of Object.keys(SECTION_CATEGORY_MAPPING)) {
                if (questionMatchesSection(q, sectionSlug)) {
                    return false; // This question belongs to a specific section
                }
            }
            return true; // This question doesn't match any section, show in Q&A
        });
    };

    const sectionQuestions = getSectionQuestions();
    const unmatchedQuestions = getUnmatchedQuestions();

    // Sync content when section changes
    useEffect(() => {
        setContent(section.content || '');
        setIsEditing(false);

        // Load questions for Q&A sections and sections with category mappings
        const sectionSlug = section.section_type?.slug || '';
        if (isQASection || SECTION_CATEGORY_MAPPING[sectionSlug]) {
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

    // Load org users for assignee dropdown
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const response = await usersApi.list();
                setOrgUsers(response.data.users || []);
            } catch (error) {
                console.error('Failed to load users:', error);
            }
        };
        loadUsers();
    }, []);

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

    // Handler for inserting Q&A answer into section content (NEW)
    const handleInsertQAAnswer = async (question: any, answer: string) => {
        // Format the Q&A content to insert
        const qaBlock = `

---

**Q: ${question.text}**

${answer}

---

`;

        // Append to current content
        const newContent = (content || '') + qaBlock;
        setContent(newContent);

        // Save immediately
        setIsSaving(true);
        try {
            const response = await sectionsApi.updateSection(projectId, section.id, {
                content: newContent,
            });
            onUpdate(response.data.section);
        } catch {
            toast.error('Failed to save section');
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
            } else if (templateType === 'timeline') {
                // For timeline editor, store as JSON string
                contentToSave = JSON.stringify({
                    type: 'timeline',
                    milestones: editorData.milestones,
                    style: editorData.style,
                });
            } else if (templateType === 'compliance_matrix') {
                // For compliance matrix editor, store as JSON string
                contentToSave = JSON.stringify({
                    type: 'compliance_matrix',
                    requirements: editorData.requirements,
                    style: editorData.style,
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
        // Return null if not editing
        if (!isEditing) {
            return null;
        }

        // Parse content if it's JSON (for table, card, technical, timeline, compliance_matrix)
        let parsedContent: any = null;
        if (['table', 'card', 'technical', 'timeline', 'compliance_matrix'].includes(templateType)) {
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

            case 'timeline':
                return (
                    <TimelineEditor
                        milestones={parsedContent?.milestones || []}
                        style={parsedContent?.style || 'list'}
                        onSave={handleEditorSave}
                        onCancel={() => {
                            setContent(section.content || '');
                            setIsEditing(false);
                        }}
                        isSaving={isSaving}
                        color={section.section_type?.color}
                    />
                );

            case 'compliance_matrix':
                return (
                    <ComplianceMatrixEditor
                        requirements={parsedContent?.requirements || []}
                        style={parsedContent?.style || 'table'}
                        onSave={handleEditorSave}
                        onCancel={() => {
                            setContent(section.content || '');
                            setIsEditing(false);
                        }}
                        isSaving={isSaving}
                        color={section.section_type?.color}
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

    // Stats for Q&A section (using unmatched questions)
    const unmatchedAnsweredCount = unmatchedQuestions.filter(q => q.status === 'answered' || q.status === 'approved').length;
    const unmatchedApprovedCount = unmatchedQuestions.filter(q => q.status === 'approved').length;

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
                                {isQASection && ` • ${unmatchedAnsweredCount}/${unmatchedQuestions.length} answered • ${unmatchedApprovedCount} approved`}
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

                {/* Action Buttons - Only for non-Q&A sections */}
                {!isQASection && (
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
                                        {templateType !== 'narrative' && templateType !== 'table' && templateType !== 'card' && templateType !== 'technical' && templateType !== 'timeline' && templateType !== 'compliance_matrix' ? (
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

                                <button
                                    onClick={() => setShowHistoryModal(true)}
                                    className="btn-secondary flex items-center gap-2"
                                    title="View section history"
                                >
                                    <ClockIcon className="h-4 w-4" />
                                    History
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
                                ) : unmatchedQuestions.length === 0 ? (
                                    <div className="text-center py-12">
                                        <ChatBubbleLeftRightIcon className="h-16 w-16 mx-auto text-text-muted mb-4" />
                                        <h3 className="text-lg font-medium text-text-primary mb-2">
                                            {questions.length > 0 ? 'All Questions Assigned to Sections' : 'No Questions Yet'}
                                        </h3>
                                        <p className="text-text-secondary max-w-md mx-auto mb-4">
                                            {questions.length > 0
                                                ? 'All extracted questions have been assigned to their relevant proposal sections.'
                                                : 'Upload and analyze an RFP document to extract customer questions, or create them manually.'}
                                        </p>
                                        <button
                                            onClick={() => setShowCreateQuestion(true)}
                                            className="btn-primary inline-flex items-center gap-2"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                            Create Question
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        {/* Table Header with Actions */}
                                        <div className="flex items-center justify-between mb-4 px-1">
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-text-secondary">
                                                    {unmatchedQuestions.filter(q => q.status === 'pending').length} pending • {unmatchedQuestions.filter(q => q.status === 'answered' || q.status === 'approved').length} answered
                                                </span>
                                                {selectedQuestionIds.size > 0 && (
                                                    <span className="text-sm text-primary font-medium">
                                                        {selectedQuestionIds.size} selected
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedQuestionIds.size > 0 ? (
                                                    <button
                                                        onClick={async () => {
                                                            setIsGeneratingBatch(true);
                                                            const selectedPending = unmatchedQuestions.filter(
                                                                q => selectedQuestionIds.has(q.id) && q.status === 'pending'
                                                            );
                                                            if (selectedPending.length > 0) {
                                                                toast(`Generating ${selectedPending.length} answers...`);
                                                                // Generate answers one by one
                                                                for (const q of selectedPending) {
                                                                    try {
                                                                        await questionsApi.generateAnswer(q.id);
                                                                    } catch (e) {
                                                                        console.error(`Failed to generate answer for ${q.id}`, e);
                                                                    }
                                                                }
                                                                loadQuestions(); // Refresh
                                                                setSelectedQuestionIds(new Set());
                                                            }
                                                            setIsGeneratingBatch(false);
                                                        }}
                                                        disabled={isGeneratingBatch}
                                                        className="btn-primary text-sm flex items-center gap-2"
                                                    >
                                                        {isGeneratingBatch ? (
                                                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <SparklesIcon className="h-4 w-4" />
                                                        )}
                                                        Generate Selected ({selectedQuestionIds.size})
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={async () => {
                                                            setIsGeneratingBatch(true);
                                                            const pendingQuestions = unmatchedQuestions.filter(q => q.status === 'pending');
                                                            if (pendingQuestions.length > 0) {
                                                                toast(`Generating ${pendingQuestions.length} answers...`);
                                                                for (const q of pendingQuestions) {
                                                                    try {
                                                                        await questionsApi.generateAnswer(q.id);
                                                                    } catch (e) {
                                                                        console.error(`Failed to generate answer for ${q.id}`, e);
                                                                    }
                                                                }
                                                                loadQuestions(); // Refresh
                                                            }
                                                            setIsGeneratingBatch(false);
                                                        }}
                                                        disabled={isGeneratingBatch}
                                                        className="btn-secondary text-sm flex items-center gap-2"
                                                    >
                                                        {isGeneratingBatch ? (
                                                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <SparklesIcon className="h-4 w-4" />
                                                        )}
                                                        Generate All ({unmatchedQuestions.filter(q => q.status === 'pending').length})
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Questions Table */}
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="border-b border-border">
                                                    <th className="py-3 px-3 w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedQuestionIds.size === unmatchedQuestions.length && unmatchedQuestions.length > 0}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedQuestionIds(new Set(unmatchedQuestions.map(q => q.id)));
                                                                } else {
                                                                    setSelectedQuestionIds(new Set());
                                                                }
                                                            }}
                                                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                                        />
                                                    </th>
                                                    <th className="text-left py-3 px-3 text-xs font-medium text-text-secondary uppercase tracking-wider w-12">#</th>
                                                    <th className="text-left py-3 px-3 text-xs font-medium text-text-secondary uppercase tracking-wider">Question</th>
                                                    <th className="text-left py-3 px-3 text-xs font-medium text-text-secondary uppercase tracking-wider w-1/3">Answer</th>
                                                    <th className="text-center py-3 px-3 text-xs font-medium text-text-secondary uppercase tracking-wider w-24">Status</th>
                                                    <th className="text-right py-3 px-3 text-xs font-medium text-text-secondary uppercase tracking-wider w-32">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {unmatchedQuestions.map((question, index) => (
                                                    <tr
                                                        key={question.id}
                                                        className={clsx(
                                                            "border-b border-border hover:bg-surface transition-colors",
                                                            selectedQuestionIds.has(question.id) && "bg-primary-light/30"
                                                        )}
                                                    >
                                                        <td className="py-3 px-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedQuestionIds.has(question.id)}
                                                                onChange={(e) => {
                                                                    const newSet = new Set(selectedQuestionIds);
                                                                    if (e.target.checked) {
                                                                        newSet.add(question.id);
                                                                    } else {
                                                                        newSet.delete(question.id);
                                                                    }
                                                                    setSelectedQuestionIds(newSet);
                                                                }}
                                                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                                            />
                                                        </td>
                                                        <td className="py-3 px-3 text-sm text-text-muted">{index + 1}</td>
                                                        <td className="py-3 px-3">
                                                            <p className="text-sm text-text-primary line-clamp-2">{question.text}</p>
                                                            {question.category && (
                                                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-surface text-text-secondary">
                                                                    {question.category}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            {question.answer ? (
                                                                <p className="text-sm text-text-secondary line-clamp-2">{question.answer.content}</p>
                                                            ) : (
                                                                <span className="text-sm text-text-muted italic">No answer yet</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className={clsx(
                                                                'px-2 py-1 rounded-full text-xs font-medium',
                                                                question.status === 'approved' && 'bg-success-light text-success',
                                                                question.status === 'answered' && 'bg-primary-light text-primary',
                                                                question.status === 'pending' && 'bg-gray-100 text-gray-600',
                                                            )}>
                                                                {question.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => setSelectedQuestion(question)}
                                                                    className="p-1.5 rounded-lg hover:bg-background text-text-secondary hover:text-primary transition-colors"
                                                                    title={question.answer ? "Edit Answer" : "Generate Answer"}
                                                                >
                                                                    {question.answer ? (
                                                                        <PencilIcon className="h-4 w-4" />
                                                                    ) : (
                                                                        <SparklesIcon className="h-4 w-4" />
                                                                    )}
                                                                </button>
                                                                {question.status === 'answered' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleQuestionUpdate({ ...question, status: 'approved' as const });
                                                                        }}
                                                                        className="p-1.5 rounded-lg hover:bg-success-light text-text-secondary hover:text-success transition-colors"
                                                                        title="Approve Answer"
                                                                    >
                                                                        <CheckCircleIcon className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
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

                        {/* Knowledge Sources Panel - Show what docs were used */}
                        {!isQASection && section.sources && section.sources.length > 0 && (
                            <div className="mt-6 border-t border-border pt-4">
                                <button
                                    onClick={() => setShowSources(!showSources)}
                                    className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors w-full"
                                >
                                    <BookOpenIcon className="h-4 w-4" />
                                    Sources Used ({section.sources.length})
                                    <span className={clsx(
                                        'ml-auto transition-transform',
                                        showSources ? 'rotate-180' : ''
                                    )}>
                                        ▼
                                    </span>
                                </button>

                                {showSources && (
                                    <div className="mt-3 space-y-2">
                                        <p className="text-xs text-text-muted mb-2">
                                            This content was generated using the following knowledge sources:
                                        </p>
                                        {section.sources.map((source, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 rounded-lg border border-border bg-gradient-to-r from-purple-50/50 to-violet-50/50"
                                            >
                                                <div className="flex items-start gap-2">
                                                    <DocumentTextIcon className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-text-primary truncate">
                                                            {source.title}
                                                        </p>
                                                        {source.snippet && (
                                                            <p className="text-xs text-text-muted mt-1 line-clamp-2">
                                                                {source.snippet}
                                                            </p>
                                                        )}
                                                        {source.relevance && (
                                                            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-600">
                                                                <SparklesIcon className="h-3 w-3" />
                                                                {Math.round(source.relevance * 100)}% relevant
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Section-Specific Questions Panel */}
                        {!isQASection && !isClarificationsSection && sectionQuestions.length > 0 && (
                            <div className="mt-6 border-t border-border pt-4">
                                <button
                                    onClick={() => setShowRelatedQuestions(!showRelatedQuestions)}
                                    className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors w-full"
                                >
                                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                    Section Questions ({sectionQuestions.length})
                                    <span className={clsx(
                                        'ml-auto transition-transform',
                                        showRelatedQuestions ? 'rotate-180' : ''
                                    )}>
                                        ▼
                                    </span>
                                </button>

                                {showRelatedQuestions && (
                                    <div className="mt-3 space-y-3">
                                        {sectionQuestions.map((question, idx) => (
                                            <div
                                                key={question.id}
                                                onClick={() => setSelectedQuestion(question)}
                                                className="p-3 rounded-lg border border-border bg-background hover:border-primary hover:shadow-sm transition-all cursor-pointer"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary-light text-primary text-xs flex items-center justify-center font-medium">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-text-primary line-clamp-2">
                                                            {question.text}
                                                        </p>
                                                        {question.answer && (
                                                            <p className="text-xs text-text-secondary mt-1 line-clamp-2 bg-surface p-2 rounded">
                                                                {question.answer.content}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className={clsx(
                                                        'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                                                        question.status === 'approved' && 'bg-success-light text-success',
                                                        question.status === 'answered' && 'bg-primary-light text-primary',
                                                        question.status === 'pending' && 'bg-gray-100 text-gray-600',
                                                    )}>
                                                        {question.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>


                {/* Right Sidebar - Section Details (toggled) */}
                {!isQASection && section.content && (
                    <>
                        {/* Toggle Button (shown when sidebar is closed) */}
                        {!showDetailsSidebar && (
                            <div className="w-12 border-l border-border bg-surface flex flex-col items-center py-4 gap-3">
                                <button
                                    onClick={() => setShowDetailsSidebar(true)}
                                    className="p-2 rounded-lg hover:bg-background transition-colors text-text-muted hover:text-primary"
                                    title="Section Details"
                                >
                                    <Cog8ToothIcon className="h-5 w-5" />
                                </button>
                                {section.comments && section.comments.length > 0 && (
                                    <div className="relative">
                                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-text-muted" />
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                                            {section.comments.length}
                                        </span>
                                    </div>
                                )}
                                {section.confidence_score !== null && section.confidence_score !== undefined && (
                                    <div className="text-xs text-text-muted text-center">
                                        <SparklesIcon className="h-5 w-5 mx-auto mb-1" />
                                        <span>{Math.round(section.confidence_score * 100)}%</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Section Details Sidebar */}
                        <SectionDetailsSidebar
                            section={section}
                            projectId={projectId}
                            onUpdate={onUpdate}
                            onClose={() => setShowDetailsSidebar(false)}
                            users={orgUsers}
                            isOpen={showDetailsSidebar}
                        />
                    </>
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

                {/* Related Q&A Sidebar - for non-Q&A sections with related questions */}
                {!isQASection && !isClarificationsSection && sectionQuestions.length > 0 && (
                    <RelatedQASidebar
                        questions={sectionQuestions}
                        isLoading={loadingQuestions}
                        isOpen={showQASidebar}
                        onToggle={() => setShowQASidebar(!showQASidebar)}
                        onInsertAnswer={handleInsertQAAnswer}
                        sectionTitle={section.title}
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

            {/* Section History Modal */}
            <SectionHistory
                sectionId={section.id}
                currentVersion={section.version}
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                onRestore={() => {
                    // Reload the section after restore
                    window.location.reload();
                }}
            />
        </div>
    );
}
