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
    MagnifyingGlassCircleIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import RFPAnalysisModal from '@/components/RFPAnalysisModal';
import WorkflowStepper from '@/components/ui/WorkflowStepper';

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [analysisDoc, setAnalysisDoc] = useState<Document | null>(null);

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
        try {
            for (const file of acceptedFiles) {
                const result = await documentsApi.upload(Number(id), file);
                const response = result.data;

                // Show upload success
                toast.success(`Uploaded ${file.name}`);

                // Check if auto-analysis created sections
                if (response.sections_created && response.sections_created > 0) {
                    toast.success(
                        `✨ Auto-analyzed RFP and created ${response.sections_created} sections!`,
                        { duration: 4000 }
                    );
                    // Redirect to proposal builder
                    navigate(`/projects/${id}/proposal`);
                    return;
                } else if (response.analysis && !response.analysis.error) {
                    toast.success('RFP analysis complete', { duration: 3000 });
                }
            }
            loadProject();
        } catch {
            toast.error('Failed to upload document');
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
                                {doc.status === 'completed' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAnalysisDoc(doc);
                                        }}
                                        className="btn-primary text-sm px-3 py-1.5"
                                    >
                                        <MagnifyingGlassCircleIcon className="h-4 w-4" />
                                        Analyze & Build
                                    </button>
                                )}
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

            {/* RFP Analysis Modal */}
            {analysisDoc && (
                <RFPAnalysisModal
                    documentId={analysisDoc.id}
                    documentName={analysisDoc.original_filename}
                    projectId={Number(id)}
                    onClose={() => setAnalysisDoc(null)}
                    onComplete={() => {
                        setAnalysisDoc(null);
                        loadProject();
                    }}
                />
            )}
        </div>
    );
}
