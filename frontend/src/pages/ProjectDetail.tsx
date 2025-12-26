import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsApi, documentsApi, questionsApi, agentsApi, sectionsApi } from '@/api/client';
import { Project, Document, Question } from '@/types';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import {
    ArrowLeftIcon,
    DocumentArrowUpIcon,
    DocumentTextIcon,
    SparklesIcon,
    ChatBubbleLeftRightIcon,
    ScaleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    BookOpenIcon,
    CheckCircleIcon,
    PlayIcon,
    EyeIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import WorkflowStepper from '@/components/ui/WorkflowStepper';
import KnowledgeProfileSidebar from '@/components/knowledge/KnowledgeProfileSidebar';
import UploadProgressModal, { UploadState } from '@/components/upload/UploadProgressModal';
import DocumentActions from '@/components/ui/DocumentActions';
import GoNoGoWizard from '@/components/gng/GoNoGoWizard';

type ProjectStatus = 'draft' | 'in_progress' | 'review' | 'completed';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string; icon: typeof PlayIcon }> = {
    draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: ClockIcon },
    in_progress: { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: PlayIcon },
    review: { label: 'In Review', color: 'text-amber-600', bgColor: 'bg-amber-100', icon: EyeIcon },
    completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircleIcon },
};

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [showWorkflow, setShowWorkflow] = useState(false);

    // Upload progress modal state
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [uploadState, setUploadState] = useState<UploadState>('uploading');
    const [uploadPercent, setUploadPercent] = useState(0);
    const [currentFileName, setCurrentFileName] = useState('');

    // Knowledge profile sidebar state
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);

    // Go/No-Go wizard state
    const [showGoNoGoWizard, setShowGoNoGoWizard] = useState(false);

    const loadProject = useCallback(async () => {
        if (!id) return;

        try {
            const [projectRes, questionsRes, documentsRes] = await Promise.all([
                projectsApi.get(Number(id)),
                questionsApi.list(Number(id)),
                documentsApi.list(Number(id)),
            ]);
            setProject(projectRes.data.project);
            setQuestions(questionsRes.data.questions || []);
            setDocuments(documentsRes.data.documents || []);
        } catch {
            toast.error('Failed to load project');
            navigate('/projects');
        } finally {
            setIsLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        loadProject();
    }, [loadProject]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!id || acceptedFiles.length === 0) return;

        setIsUploading(true);
        setShowProgressModal(true);
        setUploadState('uploading');
        setUploadPercent(0);

        let shouldNavigateToProposal = false;

        // Map agent progress phases to UI states
        const AGENT_STEP_MAP: Record<string, UploadState> = {
            'document_analysis': 'document_analysis',
            'analyzing': 'document_analysis',
            'question_extraction': 'question_extraction',
            'extracting': 'question_extraction',
            'knowledge_retrieval': 'knowledge_retrieval',
            'retrieving': 'knowledge_retrieval',
            'answer_generation': 'answer_generation',
            'generating': 'answer_generation',
            'answer_validation': 'answer_validation',
            'validating': 'answer_validation',
            'compliance_check': 'compliance_check',
            'checking': 'compliance_check',
            'clarification': 'clarification',
            'quality_review': 'quality_review',
            'reviewing': 'quality_review',
        };

        try {
            for (let fileIndex = 0; fileIndex < acceptedFiles.length; fileIndex++) {
                const file = acceptedFiles[fileIndex];
                setCurrentFileName(`${file.name} (${fileIndex + 1}/${acceptedFiles.length})`);

                try {
                    // Step 1: Upload document
                    setUploadState('uploading');
                    setUploadPercent(5);
                    const uploadResult = await documentsApi.upload(Number(id), file);
                    const uploadedDoc = uploadResult.data.document;

                    // Step 2: Parse document
                    setUploadState('parsing');
                    setUploadPercent(10);

                    // Step 3: Start async orchestrator analysis (full 11-agent pipeline)
                    setUploadState('document_analysis');
                    setUploadPercent(15);

                    try {
                        // Start async job
                        const asyncResult = await agentsApi.analyzeRfpAsync(uploadedDoc.id, {
                            tone: 'professional',
                            length: 'medium'
                        });

                        const jobId = asyncResult.data.job_id;

                        // Poll for job status
                        let jobComplete = false;
                        let pollCount = 0;
                        const maxPolls = 180; // 3 minutes max (1s intervals)

                        while (!jobComplete && pollCount < maxPolls) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            pollCount++;

                            try {
                                const statusResult = await agentsApi.getJobStatus(jobId);
                                const status = statusResult.data.status;

                                if (status === 'PROGRESS' && statusResult.data.progress) {
                                    // Update UI based on agent progress
                                    const progress = statusResult.data.progress;
                                    const step = progress.step || progress.current_step || '';
                                    const percent = progress.percent || progress.progress || 0;

                                    // Map step to UI state
                                    const uiState = AGENT_STEP_MAP[step.toLowerCase()] || 'document_analysis';
                                    setUploadState(uiState);
                                    setUploadPercent(Math.min(15 + (percent * 0.7), 85));
                                }

                                if (status === 'SUCCESS') {
                                    jobComplete = true;

                                    // Analysis complete - now build sections
                                    setUploadState('building_sections');
                                    setUploadPercent(90);

                                    // Auto-build proposal sections from analysis result
                                    const analysisResult = await documentsApi.analyze(uploadedDoc.id);

                                    if (analysisResult.data.suggested_sections && analysisResult.data.suggested_sections.length > 0) {
                                        const sectionIds = analysisResult.data.suggested_sections
                                            .filter((s: any) => s.selected !== false)
                                            .map((s: any) => s.section_type_id);

                                        if (sectionIds.length > 0) {
                                            await documentsApi.autoBuildProposal(uploadedDoc.id, sectionIds, true);
                                        }
                                    }

                                    // Auto-populate Q&A section with generated answers
                                    setUploadPercent(95);
                                    try {
                                        await sectionsApi.populateFromQA(Number(id), {
                                            create_qa_section: true,
                                            inject_into_sections: false,
                                        });
                                    } catch (qaError) {
                                        console.warn('Q&A section population skipped:', qaError);
                                    }

                                    shouldNavigateToProposal = true;
                                }

                                if (status === 'FAILURE') {
                                    throw new Error(statusResult.data.error || 'Analysis failed');
                                }
                            } catch (pollError) {
                                console.warn('Job poll error:', pollError);
                            }
                        }

                        if (!jobComplete) {
                            // Fallback: If async job times out, use sync analysis
                            console.warn('Async job timeout, falling back to sync analysis');
                            const analysisResult = await documentsApi.analyze(uploadedDoc.id);

                            if (analysisResult.data.suggested_sections && analysisResult.data.suggested_sections.length > 0) {
                                const sectionIds = analysisResult.data.suggested_sections
                                    .filter((s: any) => s.selected !== false)
                                    .map((s: any) => s.section_type_id);

                                if (sectionIds.length > 0) {
                                    setUploadState('building_sections');
                                    setUploadPercent(95);
                                    await documentsApi.autoBuildProposal(uploadedDoc.id, sectionIds, true);
                                    shouldNavigateToProposal = true;
                                }
                            }
                        }

                    } catch (asyncError) {
                        // Fallback: Use sync analysis if async fails
                        console.warn('Async analysis failed, using sync:', asyncError);
                        setUploadState('document_analysis');
                        setUploadPercent(50);

                        const analysisResult = await documentsApi.analyze(uploadedDoc.id);

                        if (analysisResult.data.suggested_sections && analysisResult.data.suggested_sections.length > 0) {
                            const sectionIds = analysisResult.data.suggested_sections
                                .filter((s: any) => s.selected !== false)
                                .map((s: any) => s.section_type_id);

                            if (sectionIds.length > 0) {
                                setUploadState('building_sections');
                                setUploadPercent(90);
                                await documentsApi.autoBuildProposal(uploadedDoc.id, sectionIds, true);
                                shouldNavigateToProposal = true;
                            }
                        }
                    }

                    setUploadPercent(100);

                } catch (fileError) {
                    console.error(`Error processing ${file.name}:`, fileError);
                    toast.error(`Failed to process ${file.name}`);
                }
            }

            setUploadState('complete');
            setUploadPercent(100);
            setCurrentFileName(`${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''} processed`);

            await loadProject();

            setTimeout(() => {
                setShowProgressModal(false);

                if (shouldNavigateToProposal) {
                    toast.success(
                        `✨ RFP analyzed with full AI pipeline! Q&A answers generated and proposal sections created.`,
                        { duration: 4000 }
                    );
                    navigate(`/projects/${id}/proposal`);
                }
            }, 1500);

        } catch (error) {
            console.error('Upload error:', error);
            setUploadState('error');
            toast.error('Failed to upload documents');
        } finally {
            setIsUploading(false);
        }
    }, [id, navigate, loadProject]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
            'application/vnd.ms-powerpoint': ['.ppt'],
        },
        maxSize: 50 * 1024 * 1024,
    });

    const answeredQueries = questions.filter(q => q.status === 'answered' || q.status === 'approved').length;

    const getCurrentStep = useMemo(() => {
        if (documents.length === 0) return 'upload';
        if (questions.length === 0) return 'analyze';
        if (questions.length > 0 && answeredQueries === 0) return 'sections';
        if (answeredQueries < questions.length) return 'answer';
        if (project?.status === 'completed') return 'export';
        return 'answer';
    }, [documents.length, questions.length, answeredQueries, project?.status]);

    const getCompletedSteps = useMemo(() => {
        const steps: string[] = [];
        steps.push('knowledge-profile', 'knowledge-base', 'create-project');
        if (documents.length > 0) steps.push('upload');
        if (questions.length > 0) steps.push('analyze', 'sections');
        if (answeredQueries === questions.length && questions.length > 0) steps.push('answer');
        if (project?.status === 'completed') steps.push('export');
        return steps;
    }, [documents.length, questions.length, answeredQueries, project?.status]);

    const updateStatus = async (newStatus: ProjectStatus) => {
        try {
            const response = await projectsApi.update(project!.id, { status: newStatus });
            toast.success(`Status updated to ${STATUS_CONFIG[newStatus].label}`);
            setProject(response.data.project);
        } catch {
            toast.error('Failed to update status');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!project) {
        return null;
    }

    const currentStatus = (project.status || 'draft') as ProjectStatus;
    const StatusIcon = STATUS_CONFIG[currentStatus]?.icon || ClockIcon;
    const completionPercent = questions.length > 0 ? Math.round((answeredQueries / questions.length) * 100) : 0;

    return (
        <>
            <div className="space-y-4 animate-fade-in">
                {/* Compact Header */}
                <div className="card">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/projects')}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                        >
                            <ArrowLeftIcon className="h-5 w-5 text-text-secondary" />
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-semibold text-text-primary truncate">{project.name}</h1>
                                <span className={clsx(
                                    'px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1',
                                    STATUS_CONFIG[currentStatus]?.bgColor,
                                    STATUS_CONFIG[currentStatus]?.color
                                )}>
                                    <StatusIcon className="h-3.5 w-3.5" />
                                    {STATUS_CONFIG[currentStatus]?.label}
                                </span>
                            </div>
                            {project.description && (
                                <p className="text-sm text-text-muted mt-0.5 truncate">{project.description}</p>
                            )}
                        </div>

                        {/* Quick Stats */}
                        <div className="hidden lg:flex items-center gap-6 px-4 py-2 bg-background rounded-lg">
                            <div className="text-center">
                                <p className="text-lg font-semibold text-text-primary">{documents.length}</p>
                                <p className="text-xs text-text-muted">Docs</p>
                            </div>
                            <div className="h-8 w-px bg-border" />
                            <div className="text-center">
                                <p className="text-lg font-semibold text-text-primary">{questions.length}</p>
                                <p className="text-xs text-text-muted">Queries</p>
                            </div>
                            <div className="h-8 w-px bg-border" />
                            <div className="text-center">
                                <p className="text-lg font-semibold text-primary">{completionPercent}%</p>
                                <p className="text-xs text-text-muted">Complete</p>
                            </div>
                        </div>

                        {documents.length > 0 ? (
                            <Link
                                to={`/projects/${id}/proposal`}
                                className="btn-primary flex items-center gap-2"
                            >
                                <SparklesIcon className="h-5 w-5" />
                                <span className="hidden sm:inline">Build Proposal</span>
                            </Link>
                        ) : (
                            <button
                                disabled
                                className="btn-primary flex items-center gap-2 opacity-50 cursor-not-allowed"
                                title="Upload RFP documents first"
                            >
                                <SparklesIcon className="h-5 w-5" />
                                <span className="hidden sm:inline">Build Proposal</span>
                            </button>
                        )}
                    </div>

                    {/* Collapsible Workflow */}
                    <div className="mt-4 pt-4 border-t border-border">
                        <button
                            onClick={() => setShowWorkflow(!showWorkflow)}
                            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-full"
                        >
                            {showWorkflow ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                            <span>Workflow Progress</span>
                            <div className="flex-1 mx-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-500"
                                    style={{ width: `${getCompletedSteps.length / 8 * 100}%` }}
                                />
                            </div>
                            <span className="text-xs">{getCompletedSteps.length}/8 steps</span>
                        </button>
                        {showWorkflow && (
                            <div className="mt-4">
                                <WorkflowStepper
                                    currentStep={getCurrentStep as any}
                                    completedSteps={getCompletedSteps}
                                    onStepClick={(stepId) => {
                                        if (stepId === 'knowledge-profile') navigate('/settings?tab=knowledge');
                                        else if (stepId === 'knowledge-base') navigate('/knowledge');
                                        else if (stepId === 'answer' || stepId === 'sections') navigate(`/projects/${id}/workspace`);
                                        else if (stepId === 'export') navigate(`/projects/${id}/proposal`);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left Column - Documents (2/3 width) */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Upload Zone */}
                        <div
                            {...getRootProps()}
                            className={clsx(
                                'card border-2 border-dashed cursor-pointer transition-all text-center py-6',
                                isDragActive
                                    ? 'border-primary bg-primary-light'
                                    : 'border-border hover:border-primary',
                                isUploading && 'opacity-50 pointer-events-none'
                            )}
                        >
                            <input {...getInputProps()} />
                            <DocumentArrowUpIcon className="h-8 w-8 text-primary mx-auto mb-2" />
                            <p className="text-text-primary font-medium">
                                {isDragActive ? 'Drop files here' : 'Drag & drop RFP documents'}
                            </p>
                            <p className="text-xs text-text-muted mt-1">
                                PDF, DOCX, XLSX, PPTX up to 50MB
                            </p>
                        </div>

                        {/* Document List */}
                        {documents.length > 0 && (
                            <div className="card">
                                <h3 className="font-medium text-text-primary mb-3 flex items-center gap-2">
                                    <DocumentTextIcon className="h-5 w-5 text-primary" />
                                    RFP Documents ({documents.length})
                                </h3>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {documents.map((doc) => (
                                        <div key={doc.id} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                                            <div className="h-8 w-8 rounded bg-white flex items-center justify-center border border-border">
                                                <DocumentTextIcon className="h-4 w-4 text-text-muted" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-text-primary truncate">
                                                    {doc.original_filename}
                                                </p>
                                                <p className="text-xs text-text-muted">
                                                    {(doc.file_size / 1024 / 1024).toFixed(1)} MB • {doc.question_count || 0} queries
                                                </p>
                                            </div>
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded text-xs font-medium',
                                                doc.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    doc.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                                        doc.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                            )}>
                                                {doc.status}
                                            </span>
                                            <DocumentActions
                                                documentId={doc.id}
                                                fileName={doc.original_filename}
                                                fileType={doc.file_type || 'pdf'}
                                                onDelete={loadProject}
                                                onReparse={loadProject}
                                                showDelete={true}
                                                showReparse={true}
                                                compact={true}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Action Card */}
                        {documents.length > 0 && questions.length > 0 && (
                            <div className="card bg-gradient-to-r from-primary to-purple-600 text-white">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="font-semibold">Ready to Build Your Proposal?</h3>
                                        <p className="text-sm text-white/80 mt-0.5">
                                            {answeredQueries}/{questions.length} queries answered
                                        </p>
                                    </div>
                                    <Link
                                        to={`/projects/${id}/proposal`}
                                        className="bg-white text-primary px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <SparklesIcon className="h-4 w-4" />
                                        Open Builder
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Sidebar (1/3 width) */}
                    <div className="space-y-4">
                        {/* Status & Actions Card */}
                        <div className="card">
                            <h3 className="font-medium text-text-primary mb-3">Status & Actions</h3>

                            {/* Status Buttons */}
                            <div className="space-y-2">
                                {currentStatus === 'draft' && (
                                    <>
                                        {/* If documents exist - work has started, show appropriate button */}
                                        {documents.length > 0 ? (
                                            <>
                                                {questions.length > 0 ? (
                                                    // Both docs and questions exist - suggest submitting for review
                                                    <button
                                                        onClick={() => updateStatus('review')}
                                                        className="w-full btn-primary text-sm flex items-center justify-center gap-2"
                                                    >
                                                        <EyeIcon className="h-4 w-4" />
                                                        Submit for Review
                                                    </button>
                                                ) : (
                                                    // Docs exist but no questions - continue working
                                                    <button
                                                        onClick={() => updateStatus('in_progress')}
                                                        className="w-full btn-primary text-sm flex items-center justify-center gap-2"
                                                    >
                                                        <PlayIcon className="h-4 w-4" />
                                                        Continue Working
                                                    </button>
                                                )}
                                                <p className="text-xs text-amber-600 text-center mt-1">
                                                    ⚠️ Work found but status is still Draft
                                                </p>
                                            </>
                                        ) : (
                                            // No documents yet
                                            <button
                                                disabled
                                                className="w-full btn-primary text-sm flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                                                title="Upload RFP documents first"
                                            >
                                                <PlayIcon className="h-4 w-4" />
                                                Start Working
                                            </button>
                                        )}
                                    </>
                                )}
                                {currentStatus === 'in_progress' && (
                                    <>
                                        <button
                                            onClick={() => updateStatus('review')}
                                            disabled={questions.length === 0}
                                            className={clsx(
                                                "w-full btn-primary text-sm flex items-center justify-center gap-2",
                                                questions.length === 0 && "opacity-50 cursor-not-allowed"
                                            )}
                                            title={questions.length === 0 ? "Analyze RFP to extract questions first" : ""}
                                        >
                                            <EyeIcon className="h-4 w-4" />
                                            Submit for Review
                                        </button>
                                        <button
                                            onClick={() => updateStatus('draft')}
                                            className="w-full btn-secondary text-sm"
                                        >
                                            Back to Draft
                                        </button>
                                    </>
                                )}
                                {currentStatus === 'review' && (
                                    <>
                                        <button
                                            onClick={() => updateStatus('completed')}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <CheckCircleIcon className="h-4 w-4" />
                                            Mark Complete
                                        </button>
                                        <button
                                            onClick={() => updateStatus('in_progress')}
                                            className="w-full btn-secondary text-sm"
                                        >
                                            Back to In Progress
                                        </button>
                                    </>
                                )}
                                {currentStatus === 'completed' && (
                                    <button
                                        onClick={() => updateStatus('review')}
                                        className="w-full btn-secondary text-sm"
                                    >
                                        Reopen for Review
                                    </button>
                                )}

                                {/* Helper text when no documents */}
                                {documents.length === 0 && (
                                    <p className="text-xs text-text-muted text-center mt-2">
                                        Upload documents to enable actions
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Go/No-Go Analysis */}
                        <div className="card border border-amber-200 bg-amber-50/50">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                    <ScaleIcon className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-800">Go/No-Go Analysis</h3>
                                    <p className="text-xs text-gray-600">
                                        {(project as any).go_no_go_status === 'go' ? (
                                            <span className="text-green-600 font-medium">GO ({Math.round((project as any).go_no_go_score || 0)}%)</span>
                                        ) : (project as any).go_no_go_status === 'no_go' ? (
                                            <span className="text-red-600 font-medium">NO-GO ({Math.round((project as any).go_no_go_score || 0)}%)</span>
                                        ) : (
                                            'Pre-RFP evaluation'
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowGoNoGoWizard(true)}
                                className={clsx(
                                    'w-full py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2',
                                    (project as any).go_no_go_status !== 'pending'
                                        ? 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-100'
                                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                                )}
                            >
                                <SparklesIcon className="h-4 w-4" />
                                {(project as any).go_no_go_status !== 'pending' ? 'View Analysis' : 'Run Analysis'}
                            </button>
                        </div>

                        {/* Knowledge Context */}
                        {project.knowledge_profiles && project.knowledge_profiles.length > 0 && (
                            <div className="card bg-primary-light/30 border border-primary/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <BookOpenIcon className="h-5 w-5 text-primary" />
                                    <h3 className="font-medium text-text-primary">Knowledge Context</h3>
                                </div>
                                <div className="space-y-2">
                                    {project.knowledge_profiles.map((profile: any) => (
                                        <button
                                            key={profile.id}
                                            onClick={() => {
                                                setSelectedProfile(profile);
                                                setIsProfileSidebarOpen(true);
                                            }}
                                            className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-primary/10 text-sm hover:border-primary transition-all"
                                        >
                                            <span className="font-medium text-primary truncate">{profile.name}</span>
                                            {profile.items_count !== undefined && (
                                                <span className="px-1.5 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">
                                                    {profile.items_count} docs
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mobile Stats */}
                        <div className="lg:hidden card">
                            <h3 className="font-medium text-text-primary mb-3">Project Stats</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-background rounded-lg">
                                    <DocumentTextIcon className="h-5 w-5 text-primary mx-auto mb-1" />
                                    <p className="text-lg font-semibold">{documents.length}</p>
                                    <p className="text-xs text-text-muted">Documents</p>
                                </div>
                                <div className="text-center p-3 bg-background rounded-lg">
                                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                                    <p className="text-lg font-semibold">{questions.length}</p>
                                    <p className="text-xs text-text-muted">Queries</p>
                                </div>
                                <div className="text-center p-3 bg-background rounded-lg">
                                    <SparklesIcon className="h-5 w-5 text-green-600 mx-auto mb-1" />
                                    <p className="text-lg font-semibold">{completionPercent}%</p>
                                    <p className="text-xs text-text-muted">Complete</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Knowledge Profile Sidebar */}
            <KnowledgeProfileSidebar
                isOpen={isProfileSidebarOpen}
                profile={selectedProfile}
                onClose={() => setIsProfileSidebarOpen(false)}
            />

            {/* Upload Progress Modal */}
            <UploadProgressModal
                isOpen={showProgressModal}
                state={uploadState}
                percentage={uploadPercent}
                fileName={currentFileName}
                onClose={() => {
                    setShowProgressModal(false);
                    if (uploadState === 'complete') {
                        navigate(`/projects/${id}/proposal`);
                    }
                }}
            />

            {/* Go/No-Go Wizard */}
            <GoNoGoWizard
                project={project}
                isOpen={showGoNoGoWizard}
                onClose={() => setShowGoNoGoWizard(false)}
                onComplete={() => loadProject()}
            />
        </>
    );
}
