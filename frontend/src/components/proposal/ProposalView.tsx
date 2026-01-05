import React, { useState, useEffect } from 'react';
import {
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

interface ProposalViewProps {
    projectId: number;
}

const ProposalView: React.FC<ProposalViewProps> = ({ projectId }) => {
    const [project, setProject] = useState<ProjectInfo | null>(null);
    const [documents, setDocuments] = useState<DocumentInfo[]>([]);
    const [proposalSections, setProposalSections] = useState<ProposalSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['strengths', 'deviations']));
    const [isExporting, setIsExporting] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [totalPages, setTotalPages] = useState(1);

    const cleanContentForPreview = (content: string | null | undefined): string => {
        if (!content) return '';
        let cleaned = content.replace(/```mermaid[\s\S]*?```/g, '[Architecture Diagram - See Proposal Builder for full view]');
        cleaned = cleaned.replace(/```[\w]*[\s\S]*?```/g, '[Code Block]');
        return cleaned;
    };

    useEffect(() => {
        if (projectId) {
            fetchData();
        }
    }, [projectId]);

    useEffect(() => {
        if (project && proposalSections.length > 0) {
            generatePreview();
        }
    }, [project, proposalSections.length]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/projects/${projectId}/proposal-chat`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setProject(data.project);
                setDocuments(data.documents || []);
                setProposalSections(data.proposalSections || []);
                setTotalPages((data.proposalSections || []).length + 1);
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
            const response = await fetch(`/api/projects/${projectId}/export/proposal-preview`, {
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

    const generatedCount = proposalSections.filter(s => s.status === 'generated' || s.status === 'approved').length;
    const complianceScore = proposalSections.length > 0
        ? Math.round((generatedCount / proposalSections.length) * 100)
        : 0;

    const executiveSummary = proposalSections.find(s =>
        s.section_type?.slug === 'executive_summary' ||
        s.title.toLowerCase().includes('executive summary') ||
        s.title.toLowerCase().includes('introduction')
    );

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

    const otherSections = proposalSections.filter(s =>
        s.id !== executiveSummary?.id &&
        !strengthSections.includes(s) &&
        !deviationSections.includes(s)
    );

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-gray-50">
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Proposal Summary */}
                <div className="w-1/2 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                                <h1 className="text-lg font-semibold text-gray-900">Proposal Summary</h1>
                            </div>
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm font-medium"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Download
                            </button>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500">
                            <div className="flex items-center gap-3">
                                <span>Compliance Score</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={clsx(
                                    'text-xl font-bold',
                                    complianceScore >= 70 ? 'text-green-600' :
                                        complianceScore >= 40 ? 'text-amber-500' : 'text-red-600'
                                )}>
                                    {complianceScore}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {executiveSummary && (
                            <div>
                                <h2 className="text-base font-semibold text-gray-900 mb-2">Executive Summary</h2>
                                <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none">
                                    {executiveSummary.content ? (
                                        <SimpleMarkdown content={executiveSummary.content} />
                                    ) : (
                                        <p className="text-gray-400 italic">No content generated yet</p>
                                    )}
                                </div>
                            </div>
                        )}

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
                    </div>
                </div>

                {/* Right: Document Preview */}
                <div className="w-1/2 bg-gray-300 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-hidden relative">
                        {isGeneratingPreview ? (
                            <div className="flex items-center justify-center h-full bg-gray-100">
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
                            <div className="h-full bg-white flex items-center justify-center text-gray-400">
                                No preview available
                            </div>
                        )}
                    </div>

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

export default ProposalView;
