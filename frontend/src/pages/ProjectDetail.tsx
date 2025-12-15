import { useState, useEffect, useCallback } from 'react';
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
    TrashIcon,
    PlayIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'documents' | 'questions'>('documents');

    useEffect(() => {
        if (id) {
            loadProject();
        }
    }, [id]);

    const loadProject = async () => {
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
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!id) return;

        setIsUploading(true);
        try {
            for (const file of acceptedFiles) {
                await documentsApi.upload(Number(id), file);
                toast.success(`Uploaded ${file.name}`);
            }
            loadProject();
        } catch {
            toast.error('Failed to upload document');
        } finally {
            setIsUploading(false);
        }
    }, [id]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
        maxSize: 50 * 1024 * 1024, // 50MB
    });

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
                    to={`/projects/${id}/workspace`}
                    className="btn-primary"
                >
                    <SparklesIcon className="h-5 w-5" />
                    Open Workspace
                </Link>
            </div>

            {/* Progress Bar */}
            <div className="card">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">Completion Progress</span>
                    <span className="text-sm font-semibold text-primary">
                        {Math.round(project.completion_percent)}%
                    </span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${project.completion_percent}%` }}
                    />
                </div>
                <div className="flex items-center gap-6 mt-4 text-sm text-text-secondary">
                    <span>{questions.length} total questions</span>
                    <span>{questions.filter(q => q.status === 'answered').length} answered</span>
                    <span>{questions.filter(q => q.status === 'approved').length} approved</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={clsx(
                            'pb-3 text-sm font-medium border-b-2 transition-colors',
                            activeTab === 'documents'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                        )}
                    >
                        Documents
                    </button>
                    <button
                        onClick={() => setActiveTab('questions')}
                        className={clsx(
                            'pb-3 text-sm font-medium border-b-2 transition-colors',
                            activeTab === 'questions'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                        )}
                    >
                        Questions ({questions.length})
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'documents' ? (
                <div className="space-y-4">
                    {/* Upload Zone */}
                    <div
                        {...getRootProps()}
                        className={clsx(
                            'card border-2 border-dashed cursor-pointer transition-all text-center py-12',
                            isDragActive
                                ? 'border-primary bg-primary-light'
                                : 'border-border hover:border-primary hover:bg-primary-50',
                            isUploading && 'opacity-50 pointer-events-none'
                        )}
                    >
                        <input {...getInputProps()} />
                        <DocumentArrowUpIcon className="h-12 w-12 text-primary mx-auto mb-4" />
                        <p className="text-text-primary font-medium">
                            {isDragActive ? 'Drop files here' : 'Drag & drop RFP documents'}
                        </p>
                        <p className="text-sm text-text-secondary mt-1">
                            or click to browse (PDF, DOCX, XLSX up to 50MB)
                        </p>
                        {isUploading && (
                            <p className="text-sm text-primary mt-4">Uploading...</p>
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
                                            {(doc.file_size / 1024 / 1024).toFixed(2)} MB • {doc.question_count} questions extracted
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
                            No documents uploaded yet
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {questions.length > 0 ? (
                        questions.map((question, index) => (
                            <div
                                key={question.id}
                                className="card flex items-start gap-4 hover:border-primary transition-colors cursor-pointer"
                                onClick={() => navigate(`/projects/${id}/workspace?q=${question.id}`)}
                            >
                                <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center text-sm font-medium text-text-secondary flex-shrink-0">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-text-primary line-clamp-2">{question.text}</p>
                                    {question.section && (
                                        <p className="text-sm text-text-muted mt-1">Section: {question.section}</p>
                                    )}
                                </div>
                                <span className={`badge flex-shrink-0 ${question.status === 'approved' ? 'badge-success' :
                                    question.status === 'answered' ? 'badge-primary' :
                                        question.status === 'review' ? 'badge-warning' :
                                            'badge-neutral'
                                    }`}>
                                    {question.status}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-text-secondary">
                            <DocumentTextIcon className="h-12 w-12 text-text-muted mx-auto mb-4" />
                            <p>No questions extracted yet</p>
                            <p className="text-sm mt-1">Upload a document to get started</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
