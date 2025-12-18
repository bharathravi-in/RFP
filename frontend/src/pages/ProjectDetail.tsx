import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsApi, documentsApi, questionsApi } from '@/api/client';
import { Project, Document, Question } from '@/types';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import {
    ArrowLeftIcon,
    DocumentArrowUpIcon,
    DocumentTextIcon,
    SparklesIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import WorkflowStepper from '@/components/ui/WorkflowStepper';
import KnowledgeProfileSidebar from '@/components/knowledge/KnowledgeProfileSidebar';

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // Knowledge profile sidebar state
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);

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
        if (!id) return;

        setIsUploading(true);
        let shouldNavigateToProposal = false;
        let totalSectionsCreated = 0;

        try {
            // Upload all files first, then navigate at the end
            for (const file of acceptedFiles) {
                try {
                    const uploadResult = await documentsApi.upload(Number(id), file);
                    const uploadedDoc = uploadResult.data.document;

                    toast.success(`Uploaded ${file.name}`);

                    // Auto-analyze the document after upload
                    try {
                        const analysisResult = await documentsApi.analyze(uploadedDoc.id);

                        if (analysisResult.data.suggested_sections && analysisResult.data.suggested_sections.length > 0) {
                            // Auto-build the proposal with suggested sections
                            const sectionIds = analysisResult.data.suggested_sections
                                .filter((s: any) => s.selected !== false)
                                .map((s: any) => s.section_type_id);

                            if (sectionIds.length > 0) {
                                await documentsApi.autoBuildProposal(uploadedDoc.id, sectionIds, true);
                                totalSectionsCreated += sectionIds.length;
                                shouldNavigateToProposal = true;
                            }
                        }

                        toast.success(`RFP analysis complete for ${file.name}`, { duration: 3000 });
                    } catch (analysisError) {
                        toast.error(`Analysis failed for ${file.name}, but document uploaded successfully`);
                    }
                } catch (uploadError) {
                    toast.error(`Failed to upload ${file.name}`);
                }
            }

            await loadProject();

            // Navigate to proposal builder after all files are processed
            if (shouldNavigateToProposal) {
                toast.success(
                    `✨ Auto-analyzed ${acceptedFiles.length} RFP(s) and created ${totalSectionsCreated} proposal sections with AI content!`,
                    { duration: 4000 }
                );
                navigate(`/projects/${id}/proposal`);
            }
        } catch {
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
        },
        maxSize: 50 * 1024 * 1024,
    });

    // Calculate these values before early returns to comply with Rules of Hooks
    const answeredQueries = questions.filter(q => q.status === 'answered' || q.status === 'approved').length;

    // Calculate current workflow step
    const getCurrentStep = useMemo(() => {
        if (documents.length === 0) return 'upload';
        if (questions.length === 0) return 'analyze';
        if (answeredQueries < questions.length) return 'answer';
        if (project?.status === 'review') return 'review';
        if (project?.status === 'completed') return 'export';
        return 'answer';
    }, [documents.length, questions.length, answeredQueries, project?.status]);

    const getCompletedSteps = useMemo(() => {
        const steps: string[] = [];
        if (documents.length > 0) steps.push('upload');
        if (questions.length > 0) steps.push('analyze');
        if (answeredQueries === questions.length && questions.length > 0) steps.push('answer');
        if (project?.status === 'completed') {
            steps.push('review', 'export');
        } else if (project?.status === 'review') {
            steps.push('review');
        }
        return steps;
    }, [documents.length, questions.length, answeredQueries, project?.status]);

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

    return (
        <>
            <div className="space-y-6 animate-fade-in">
                {/* Workflow Progress */}
                <div className="card">
                    <h3 className="text-sm font-medium text-text-secondary mb-4">Workflow Progress</h3>
                    <WorkflowStepper
                        currentStep={getCurrentStep as 'upload' | 'analyze' | 'answer' | 'review' | 'export'}
                        completedSteps={getCompletedSteps}
                        onStepClick={(stepId) => {
                            if (stepId === 'answer') navigate(`/projects/${id}/workspace`);
                            else if (stepId === 'review' || stepId === 'export') navigate(`/projects/${id}/proposal`);
                        }}
                    />
                </div>

                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/projects')}
                        className="p-2 rounded-lg hover:bg-background transition-colors"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-text-secondary" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-semibold text-text-primary">{project.name}</h1>
                        {project.description && (
                            <p className="text-text-secondary mt-1">{project.description}</p>
                        )}
                    </div>
                    <Link
                        to={`/projects/${id}/proposal`}
                        className="btn-primary flex items-center gap-2"
                    >
                        <SparklesIcon className="h-5 w-5" />
                        Build Proposal
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="card">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center">
                                <DocumentTextIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold text-text-primary">{documents.length}</p>
                                <p className="text-sm text-text-muted">RFP Documents</p>
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <ChatBubbleLeftRightIcon className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold text-text-primary">{questions.length}</p>
                                <p className="text-sm text-text-muted">Customer Queries</p>
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-success-light flex items-center justify-center">
                                <SparklesIcon className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold text-text-primary">{answeredQueries}/{questions.length}</p>
                                <p className="text-sm text-text-muted">Queries Answered</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Knowledge Context Section */}
                {project.knowledge_profiles && project.knowledge_profiles.length > 0 && (
                    <div className="card bg-primary-light/30 border border-primary/20">
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            <h3 className="font-medium text-text-primary">Knowledge Context</h3>
                        </div>
                        <p className="text-sm text-text-secondary mb-3">
                            AI will use knowledge items from these profiles when generating proposals:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {project.knowledge_profiles.map((profile: any) => (
                                <button
                                    key={profile.id}
                                    onClick={() => {
                                        setSelectedProfile(profile);
                                        setIsProfileSidebarOpen(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-primary/20 text-sm hover:border-primary hover:shadow-sm transition-all cursor-pointer"
                                >
                                    <span className="font-medium text-primary">{profile.name}</span>
                                    {profile.geographies?.length > 0 && (
                                        <span className="text-text-muted">• {profile.geographies.slice(0, 2).join(', ')}</span>
                                    )}
                                    <span className="text-xs text-text-muted">→</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Documents Section */}
                <div>
                    <h2 className="text-lg font-semibold text-text-primary mb-4">RFP Documents</h2>

                    {/* Upload Zone */}
                    <div
                        {...getRootProps()}
                        className={clsx(
                            'card border-2 border-dashed cursor-pointer transition-all text-center py-8 mb-4',
                            isDragActive
                                ? 'border-primary bg-primary-light'
                                : 'border-border hover:border-primary',
                            isUploading && 'opacity-50 pointer-events-none'
                        )}
                    >
                        <input {...getInputProps()} />
                        <DocumentArrowUpIcon className="h-10 w-10 text-primary mx-auto mb-3" />
                        <p className="text-text-primary font-medium">
                            {isDragActive ? 'Drop files here' : 'Drag & drop RFP documents'}
                        </p>
                        <p className="text-sm text-text-secondary mt-1">
                            PDF, DOCX, XLSX up to 50MB
                        </p>
                        {isUploading && (
                            <p className="text-sm text-primary mt-3">Uploading...</p>
                        )}
                    </div>

                    {/* Document List */}
                    {documents.length > 0 ? (
                        <div className="space-y-3">
                            {documents.map((doc) => (
                                <div key={doc.id} className="card flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center">
                                        <DocumentTextIcon className="h-5 w-5 text-text-secondary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-text-primary truncate">
                                            {doc.original_filename}
                                        </p>
                                        <p className="text-sm text-text-secondary">
                                            {(doc.file_size / 1024 / 1024).toFixed(2)} MB • {doc.question_count || 0} queries extracted
                                        </p>
                                    </div>
                                    <span className={`badge ${doc.status === 'completed' ? 'badge-success' :
                                        doc.status === 'processing' ? 'badge-warning' :
                                            doc.status === 'failed' ? 'badge-error' :
                                                'badge-neutral'
                                        }`}>
                                        {doc.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-text-secondary">
                            No documents uploaded yet. Upload an RFP to get started.
                        </div>
                    )}
                </div>

                {/* Quick Action Card */}
                {documents.length > 0 && questions.length > 0 && (
                    <div className="card bg-gradient-to-r from-primary to-purple-600 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Ready to Build Your Proposal?</h3>
                                <p className="text-white/80 mt-1">
                                    {questions.length} customer queries extracted. Answer them and generate your proposal in the builder.
                                </p>
                            </div>
                            <Link
                                to={`/projects/${id}/proposal`}
                                className="bg-white text-primary px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
                            >
                                <SparklesIcon className="h-5 w-5" />
                                Open Builder
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Knowledge Profile Sidebar */}
            <KnowledgeProfileSidebar
                isOpen={isProfileSidebarOpen}
                profile={selectedProfile}
                onClose={() => setIsProfileSidebarOpen(false)}
            />
        </>
    );
}
