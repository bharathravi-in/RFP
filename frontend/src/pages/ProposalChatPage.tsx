import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeftIcon,
    ArrowDownTrayIcon,
    SparklesIcon,
    DocumentTextIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import SimpleMarkdown from '@/components/common/SimpleMarkdown';
import { sectionsApi } from '@/api/client';

interface ProposalSection {
    id: number;
    title: string;
    content: string;
    status: string;
    section_type?: {
        name: string;
        slug: string;
    };
}

interface ProjectInfo {
    id: number;
    name: string;
    description: string;
    clientName: string;
    dueDate: string | null;
}

interface DocumentInfo {
    id: number;
    filename: string;
    fileType: string;
    previewUrl: string;
}

const ProposalViewPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const projectId = Number(id);

    const [project, setProject] = useState<ProjectInfo | null>(null);
    const [documents, setDocuments] = useState<DocumentInfo[]>([]);
    const [proposalSections, setProposalSections] = useState<ProposalSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['strengths', 'deviations']));
    const [isExporting, setIsExporting] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [currentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Helper function to clean content for document preview
    const cleanContentForPreview = (content: string | null | undefined): string => {
        if (!content) return '';
        // Remove mermaid code blocks which cause rendering issues
        let cleaned = content.replace(/```mermaid[\s\S]*?```/g, '[Architecture Diagram - See Proposal Builder for full view]');
        // Remove other code blocks for cleaner display
        cleaned = cleaned.replace(/```[\w]*[\s\S]*?```/g, '[Code Block]');
        return cleaned;
    };

    // Get a summary of content (first 300 chars without code blocks)
    const getContentSummary = (content: string | null | undefined, maxLength: number = 300): string => {
        const cleaned = cleanContentForPreview(content);
        if (cleaned.length <= maxLength) return cleaned;
        return cleaned.substring(0, maxLength) + '...';
    };

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    // Generate preview on load
    useEffect(() => {
        if (project && proposalSections.length > 0) {
            generatePreview();
        }
    }, [project, proposalSections.length]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/projects/${id}/proposal-chat`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setProject(data.project);
                setDocuments(data.documents || []);
                setProposalSections(data.proposalSections || []);
                setTotalPages((data.proposalSections || []).length + 1); // +1 for cover page
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const generatePreview = async () => {
        try {
            setIsGeneratingPreview(true);
            const token = localStorage.getItem('access_token');

            // Generate the proposal document and get the URL
            const response = await fetch(`/api/projects/${id}/export/proposal-preview`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ format: 'docx' })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.preview_url) {
                    // Use Microsoft Office Online viewer
                    const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.preview_url)}`;
                    setPreviewUrl(officeViewerUrl);
                }
            }
        } catch (err) {
            console.error('Failed to generate preview:', err);
        } finally {
            setIsGeneratingPreview(false);
        }
    };

    const toggleSection = (sectionKey: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionKey)) {
                newSet.delete(sectionKey);
            } else {
                newSet.add(sectionKey);
            }
            return newSet;
        });
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await sectionsApi.exportProposal(projectId, 'docx');
            const blob = response.data;
            const filename = `${project?.name || 'proposal'}.docx`;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            console.error('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    // Calculate compliance score
    const approvedCount = proposalSections.filter(s => s.status === 'approved').length;
    const generatedCount = proposalSections.filter(s => s.status === 'generated' || s.status === 'approved').length;
    const complianceScore = proposalSections.length > 0
        ? Math.round((generatedCount / proposalSections.length) * 100)
        : 0;

    // Get executive summary section
    const executiveSummary = proposalSections.find(s =>
        s.section_type?.slug === 'executive_summary' ||
        s.title.toLowerCase().includes('executive summary') ||
        s.title.toLowerCase().includes('introduction')
    );

    // Group sections into Strengths and Deviations
    const strengthSections = proposalSections.filter(s =>
        s.section_type?.slug === 'company_strengths' ||
        s.title.toLowerCase().includes('strength') ||
        s.status === 'approved'
    );

    const deviationSections = proposalSections.filter(s =>
        s.section_type?.slug === 'clarifications_questions' ||
        s.title.toLowerCase().includes('deviation') ||
        s.title.toLowerCase().includes('gap') ||
        s.status === 'draft'
    );

    // Other sections
    const otherSections = proposalSections.filter(s =>
        s.id !== executiveSummary?.id &&
        !strengthSections.includes(s) &&
        !deviationSections.includes(s)
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-3">
                <button
                    onClick={() => navigate(`/projects/${id}/proposal`)}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Go to Proposals
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Proposal Summary */}
                <div className="w-1/2 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                    {/* Summary Header */}
                    <div className="p-4 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                                <h1 className="text-lg font-semibold text-gray-900">Proposal Summary</h1>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm font-medium"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    Download Proposal
                                </button>
                                <Link
                                    to={`/projects/${id}/proposal`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                                >
                                    <SparklesIcon className="h-4 w-4" />
                                    Create New Proposal
                                </Link>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-between text-sm text-gray-500">
                            <div className="flex items-center gap-3">
                                <span>Compliance Score</span>
                                <span className="text-gray-400">Size: 0.06 MB</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={clsx(
                                    'text-xl font-bold',
                                    complianceScore >= 70 ? 'text-green-600' :
                                        complianceScore >= 40 ? 'text-amber-500' : 'text-red-600'
                                )}>
                                    {complianceScore}%
                                </span>
                                <span className="text-xs text-gray-400">⏱ 3 minutes ago</span>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Executive Summary - Always expanded */}
                        {executiveSummary && (
                            <div>
                                <h2 className="text-base font-semibold text-gray-900 mb-3">Executive Summary</h2>
                                <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none">
                                    {executiveSummary.content ? (
                                        <SimpleMarkdown content={executiveSummary.content} />
                                    ) : (
                                        <p className="text-gray-400 italic">No content generated yet</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Strengths Section */}
                        {strengthSections.length > 0 && (
                            <div className="border-t border-gray-200 pt-4">
                                <button
                                    onClick={() => toggleSection('strengths')}
                                    className="flex items-center gap-2 w-full text-left"
                                >
                                    {expandedSections.has('strengths') ? (
                                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                    ) : (
                                        <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                                    )}
                                    <h2 className="text-base font-semibold text-gray-900">Strengths</h2>
                                </button>
                                {expandedSections.has('strengths') && (
                                    <div className="mt-3 space-y-3 pl-6">
                                        {strengthSections.map(section => (
                                            <div key={section.id} className="text-sm text-gray-700">
                                                <p className="font-medium text-gray-800 mb-1">• {section.title}</p>
                                                {section.content && (
                                                    <div className="pl-3 prose prose-sm max-w-none">
                                                        <SimpleMarkdown content={section.content.substring(0, 300) + (section.content.length > 300 ? '...' : '')} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Deviations Section */}
                        {deviationSections.length > 0 && (
                            <div className="border-t border-gray-200 pt-4">
                                <button
                                    onClick={() => toggleSection('deviations')}
                                    className="flex items-center gap-2 w-full text-left"
                                >
                                    {expandedSections.has('deviations') ? (
                                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                    ) : (
                                        <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                                    )}
                                    <h2 className="text-base font-semibold text-gray-900">Deviations</h2>
                                </button>
                                {expandedSections.has('deviations') && (
                                    <div className="mt-3 space-y-3 pl-6">
                                        {deviationSections.map(section => (
                                            <div key={section.id} className="text-sm text-gray-700">
                                                <p className="font-medium text-gray-800 mb-1">• {section.title}</p>
                                                {section.content && (
                                                    <div className="pl-3 prose prose-sm max-w-none">
                                                        <SimpleMarkdown content={section.content.substring(0, 300) + (section.content.length > 300 ? '...' : '')} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Other Sections */}
                        {otherSections.length > 0 && (
                            <div className="border-t border-gray-200 pt-4">
                                <button
                                    onClick={() => toggleSection('other')}
                                    className="flex items-center gap-2 w-full text-left"
                                >
                                    {expandedSections.has('other') ? (
                                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                    ) : (
                                        <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                                    )}
                                    <h2 className="text-base font-semibold text-gray-900">Other Sections ({otherSections.length})</h2>
                                </button>
                                {expandedSections.has('other') && (
                                    <div className="mt-3 space-y-3 pl-6">
                                        {otherSections.map(section => (
                                            <div key={section.id} className="text-sm text-gray-700">
                                                <p className="font-medium text-gray-800 mb-1">• {section.title}</p>
                                                {section.content && (
                                                    <div className="pl-3 prose prose-sm max-w-none">
                                                        <SimpleMarkdown content={section.content.substring(0, 200) + (section.content.length > 200 ? '...' : '')} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty State */}
                        {proposalSections.length === 0 && (
                            <div className="text-center py-12">
                                <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="font-medium text-gray-900 mb-2">No proposal sections yet</h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    Create sections in the Proposal Builder
                                </p>
                                <Link
                                    to={`/projects/${id}/proposal`}
                                    className="text-primary hover:underline text-sm"
                                >
                                    + Create Proposal
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Document Preview - Page by Page DOCX Format */}
                <div className="w-1/2 bg-gray-300 flex flex-col overflow-hidden">
                    {/* Preview Area - Scrollable with distinct pages */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {isGeneratingPreview ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                                    <p className="text-sm text-gray-500">Generating preview...</p>
                                </div>
                            </div>
                        ) : previewUrl ? (
                            <iframe
                                src={previewUrl}
                                className="w-full h-full border-0"
                                title="Proposal Document Preview"
                                allowFullScreen
                            />
                        ) : (
                            // Page-by-Page DOCX Format
                            <div className="space-y-6">
                                {/* Cover Page */}
                                <div
                                    className="bg-white mx-auto shadow-lg"
                                    style={{
                                        width: '595px', // A4 width in pixels at 72dpi
                                        minHeight: '842px', // A4 height
                                        fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    <div className="p-12 h-full flex flex-col justify-center">
                                        <div className="text-center">
                                            <h1 className="text-3xl font-bold text-gray-900 mb-6">
                                                PROPOSAL
                                            </h1>
                                            <div className="text-xl text-gray-700 mb-8">
                                                {project?.name || 'Untitled Project'}
                                            </div>
                                            {project?.clientName && (
                                                <p className="text-lg text-gray-600 mb-4">
                                                    Prepared for: {project.clientName}
                                                </p>
                                            )}
                                            <div className="mt-16 text-sm text-gray-500 space-y-2">
                                                <p><strong>RFP Document:</strong> {documents[0]?.filename || 'Document.docx'}</p>
                                                <p><strong>Generated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                <p><strong>Version:</strong> 1</p>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Page footer */}
                                    <div className="absolute bottom-0 left-0 right-0 px-12 py-4 text-center text-xs text-gray-400">
                                        Page 1 of {totalPages}
                                    </div>
                                </div>

                                {/* Content Pages - One section per page */}
                                {proposalSections.map((section, idx) => (
                                    <div
                                        key={section.id}
                                        className="bg-white mx-auto shadow-lg relative"
                                        style={{
                                            width: '595px',
                                            minHeight: '842px',
                                            fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                                        }}
                                    >
                                        <div className="p-12">
                                            {/* Section Title */}
                                            <h2 className="text-lg font-bold text-primary mb-4 pb-2 border-b-2 border-primary">
                                                {idx + 1}. {section.title}
                                            </h2>

                                            {/* Section Content */}
                                            {section.content ? (
                                                <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none">
                                                    <SimpleMarkdown content={cleanContentForPreview(section.content)} />
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">Content pending...</p>
                                            )}
                                        </div>

                                        {/* Page footer */}
                                        <div className="absolute bottom-4 left-0 right-0 px-12 text-center text-xs text-gray-400">
                                            Page {idx + 2} of {totalPages}
                                        </div>
                                    </div>
                                ))}

                                {/* Empty state */}
                                {proposalSections.length === 0 && (
                                    <div
                                        className="bg-white mx-auto shadow-lg flex items-center justify-center"
                                        style={{
                                            width: '595px',
                                            minHeight: '842px',
                                        }}
                                    >
                                        <div className="text-center">
                                            <DocumentTextIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                            <p className="text-gray-500">No sections to preview</p>
                                            <p className="text-sm text-gray-400 mt-2">Add sections in the Proposal Builder</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
                        <span>PAGE 1 OF {totalPages}</span>
                        <div className="flex items-center gap-4">
                            <span>100%</span>
                            <button className="p-1 hover:bg-gray-100 rounded">
                                <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-primary" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProposalViewPage;
