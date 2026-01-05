import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { RFPSection, RFPSectionType, Project } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    ArrowLeftIcon,
    PlusIcon,
    SparklesIcon,
    CheckCircleIcon,
    XCircleIcon,
    TrashIcon,
    DocumentTextIcon,
    ArrowDownTrayIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    DocumentIcon,
    TableCellsIcon,
    ShieldCheckIcon,
    CurrencyDollarIcon,
    CodeBracketIcon,
    UserGroupIcon,
    BuildingOfficeIcon,
    ChatBubbleLeftRightIcon,
    BookOpenIcon,
    ClipboardDocumentListIcon,
    LightBulbIcon,
    QuestionMarkCircleIcon,
    DocumentDuplicateIcon,
    ClipboardDocumentCheckIcon,
    FlagIcon,
    UserIcon,
    ExclamationCircleIcon,
    CalendarDaysIcon,
    CubeTransparentIcon,
    PresentationChartBarIcon,
    ChevronRightIcon,
    Squares2X2Icon,
    EllipsisHorizontalIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import SectionTypeSelector from '@/components/sections/SectionTypeSelector';
import SectionEditor from '@/components/sections/SectionEditor';
import ComplianceMatrix from '@/components/compliance/ComplianceMatrix';
import DiagramGenerator from '@/components/diagrams/DiagramGenerator';
import { StrategyToolsPanel } from '@/components/strategy';
import BatchRegenerateModal from '@/components/proposal/BatchRegenerateModal';
import TemplateSelector from '@/components/export/TemplateSelector';
import WorkflowStepper, { WorkflowPhase } from '@/components/proposal/WorkflowStepper';
import ProposalView from '@/components/proposal/ProposalView';
import VersionHistory from '@/components/proposal/VersionHistory';
import { sectionsApi, projectsApi, documentsApi, pptApi } from '@/api/client';

// Section type styling configuration
const SECTION_STYLES: Record<string, {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof DocumentIcon;
    description: string;
}> = {
    executive_summary: {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: DocumentTextIcon,
        description: 'High-level overview'
    },
    company_overview: {
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        icon: BuildingOfficeIcon,
        description: 'Company background'
    },
    technical_approach: {
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        icon: CodeBracketIcon,
        description: 'Technical solution'
    },
    pricing: {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CurrencyDollarIcon,
        description: 'Cost breakdown'
    },
    compliance: {
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        icon: ShieldCheckIcon,
        description: 'Compliance requirements'
    },
    team: {
        color: 'text-pink-600',
        bgColor: 'bg-pink-50',
        borderColor: 'border-pink-200',
        icon: UserGroupIcon,
        description: 'Team qualifications'
    },
    case_studies: {
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        borderColor: 'border-cyan-200',
        icon: BookOpenIcon,
        description: 'Past project examples'
    },
    implementation: {
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        borderColor: 'border-teal-200',
        icon: ClipboardDocumentListIcon,
        description: 'Implementation plan'
    },
    qa_responses: {
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: ChatBubbleLeftRightIcon,
        description: 'Q&A responses'
    },
    clarification_questions: {
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        icon: QuestionMarkCircleIcon,
        description: 'Clarifications needed'
    },
    appendix: {
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: DocumentIcon,
        description: 'Supporting documents'
    },
    custom: {
        color: 'text-violet-600',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-200',
        icon: LightBulbIcon,
        description: 'Custom content'
    },
};

const getDefaultStyle = () => ({
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: DocumentTextIcon,
    description: 'Section content'
});

const getSectionStyle = (slug: string | undefined) => {
    if (!slug) return getDefaultStyle();
    return SECTION_STYLES[slug] || getDefaultStyle();
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircleIcon; color: string; bg: string; label: string }> = {
    approved: { icon: CheckCircleSolidIcon, color: 'text-green-600', bg: 'bg-green-100', label: 'Approved' },
    generated: { icon: SparklesIcon, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Generated' },
    draft: { icon: DocumentTextIcon, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Draft' },
    pending: { icon: ExclamationCircleIcon, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Pending' },
};

const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'approved') return false;
    return new Date(dueDate) < new Date();
};

export default function ProposalBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const projectId = Number(id);

    const [project, setProject] = useState<Project | null>(null);
    // State management
    const [searchParams, setSearchParams] = useSearchParams();
    const [layoutMode, setLayoutMode] = useState<'standard' | 'stepper'>((searchParams.get('mode') as any) || 'standard');
    const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>((searchParams.get('phase') as any) || 'sections');
    const [viewSubPhase, setViewSubPhase] = useState<'summary' | 'view' | 'versions'>((searchParams.get('subphase') as any) || 'summary');



    const [sections, setSections] = useState<RFPSection[]>([]);
    const [selectedSection, setSelectedSection] = useState<RFPSection | null>(null);
    const [isSelectionInitialized, setIsSelectionInitialized] = useState(false);


    const [isLoading, setIsLoading] = useState(true);
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState<'docx' | 'pptx' | null>(null);
    const [isImportingQA, setIsImportingQA] = useState(false);
    const [viewMode, setViewMode] = useState<'sections' | 'compliance' | 'diagrams' | 'strategy'>('sections');
    const [primaryDocumentId, setPrimaryDocumentId] = useState<number | null>(null);
    const [showKnowledgeContext, setShowKnowledgeContext] = useState(true);
    const [showBatchRegenerate, setShowBatchRegenerate] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);

    const loadProject = useCallback(async () => {
        if (!projectId) return;
        try {
            const response = await projectsApi.get(projectId);
            setProject(response.data.project);
        } catch {
            toast.error('Failed to load project');
        }
    }, [projectId]);

    const loadSections = useCallback(async () => {
        if (!projectId) return;
        try {
            setIsLoading(true);
            const response = await sectionsApi.listSections(projectId);
            const loadedSections = response.data.sections || [];
            setSections(loadedSections);

            // On initial load, try to select section from URL params
            if (loadedSections.length > 0 && !isSelectionInitialized) {
                const sectionIdFromUrl = searchParams.get('section');
                if (sectionIdFromUrl) {
                    const sectionFromUrl = loadedSections.find(s => s.id === Number(sectionIdFromUrl));
                    if (sectionFromUrl) {
                        setSelectedSection(sectionFromUrl);
                    } else {
                        setSelectedSection(loadedSections[0]);
                    }
                } else {
                    setSelectedSection(loadedSections[0]);
                }
                setIsSelectionInitialized(true);
            }
        } catch {
            toast.error('Failed to load sections');
        } finally {
            setIsLoading(false);
        }
    }, [projectId, isSelectionInitialized, searchParams]);

    const loadDocuments = useCallback(async () => {
        if (!projectId) return;
        try {
            const response = await documentsApi.list(projectId);
            const docs = response.data.documents || [];
            if (docs.length > 0) {
                const primaryDoc = docs.find((d: any) => d.is_primary) || docs[0];
                setPrimaryDocumentId(primaryDoc.id);
            }
        } catch { /* Ignore */ }
    }, [projectId]);

    useEffect(() => {
        loadProject();
        loadSections();
        loadDocuments();
    }, [loadProject, loadSections, loadDocuments]);

    // Sync all state to URL (mode, phase, subphase, section)
    useEffect(() => {
        if (isSelectionInitialized) {
            const newParams = new URLSearchParams();
            newParams.set('mode', layoutMode);
            newParams.set('phase', currentPhase);
            if (viewSubPhase) {
                newParams.set('subphase', viewSubPhase);
            }
            if (selectedSection) {
                newParams.set('section', String(selectedSection.id));
            }
            setSearchParams(newParams, { replace: true });
        }
    }, [selectedSection, layoutMode, currentPhase, viewSubPhase, isSelectionInitialized, setSearchParams]);

    const handleMoveSection = async (sectionId: number, direction: 'up' | 'down') => {
        const currentIndex = sections.findIndex(s => s.id === sectionId);
        if (currentIndex === -1) return;
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sections.length) return;

        // Create new order array by swapping positions
        const newSections = [...sections];
        [newSections[currentIndex], newSections[newIndex]] = [newSections[newIndex], newSections[currentIndex]];
        const newOrder = newSections.map(s => s.id);

        try {
            await sectionsApi.reorderSections(projectId, newOrder);
            await loadSections();
        } catch {
            toast.error('Failed to reorder section');
        }
    };

    const handleAddSection = async (sectionType: RFPSectionType, inputs: Record<string, string>, initialContent?: string) => {
        try {
            const response = await sectionsApi.addSection(projectId, {
                section_type_id: sectionType.id,
                title: inputs.title || sectionType.name,
                inputs: { ...inputs, content: initialContent || '' },
            });
            setSections([...sections, response.data.section]);
            setSelectedSection(response.data.section);
            setShowTypeSelector(false);
            toast.success('Section added');
        } catch {
            toast.error('Failed to create section');
        }
    };

    const handleDeleteSection = async (sectionId: number) => {
        if (!confirm('Delete this section?')) return;
        try {
            await sectionsApi.deleteSection(projectId, sectionId);
            setSections(sections.filter(s => s.id !== sectionId));
            if (selectedSection?.id === sectionId) {
                setSelectedSection(sections.find(s => s.id !== sectionId) || null);
            }
            toast.success('Section deleted');
        } catch {
            toast.error('Failed to delete section');
        }
    };

    const handleSectionUpdate = (updatedSection: RFPSection) => {
        setSections(sections.map(s => s.id === updatedSection.id ? updatedSection : s));
        setSelectedSection(updatedSection);
    };

    const performExport = async (format: 'docx' | 'xlsx' | 'pptx', templateId?: number) => {
        setIsExporting(true);
        try {
            let blob: Blob;
            let filename: string;
            if (format === 'pptx') {
                const response = await pptApi.generate(projectId, { template_id: templateId });
                blob = response.data;
                filename = `${project?.name || 'proposal'}.pptx`;
            } else {
                const response = await sectionsApi.exportProposal(projectId, format, templateId);
                blob = response.data;
                filename = `${project?.name || 'proposal'}.${format}`;
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(`Exported as ${format.toUpperCase()}`);
        } catch {
            toast.error('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExport = async (format: 'docx' | 'xlsx' | 'pptx') => {
        setShowExportMenu(false);

        // For Excel, export immediately
        if (format === 'xlsx') {
            performExport(format);
            return;
        }

        // For DOCX/PPTX, open template selector
        setExportFormat(format);
        setShowTemplateSelector(true);
    };

    const approvedCount = sections.filter(s => s.status === 'approved').length;
    // Use approved sections for completion percentage (consistent with all views)
    const completionPercent = sections.length > 0 ? Math.round((approvedCount / sections.length) * 100) : 0;

    // Handler to import Q&A answers into proposal sections
    const handleImportFromQA = async () => {
        if (!projectId) return;

        setIsImportingQA(true);
        try {
            const result = await sectionsApi.populateFromQA(projectId, {
                create_qa_section: true,
                inject_into_sections: false,
            });

            if (result.data.success) {
                await loadSections();
                const qaSection = result.data.qa_section;
                const mapping = result.data.mapping || {};
                const totalAnswers = Object.values(mapping).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);

                toast.success(
                    `✅ Imported ${totalAnswers} Q&A answers into proposal!${qaSection ? ' Created Q&A Responses section.' : ''}`,
                    { duration: 4000 }
                );

                // Select the new Q&A section if created
                if (qaSection) {
                    const newSection = sections.find(s => s.id === qaSection.id);
                    if (newSection) setSelectedSection(newSection);
                }
            } else {
                toast.error(result.data.message || 'No Q&A answers found to import');
            }
        } catch (error) {
            console.error('Failed to import Q&A:', error);
            toast.error('Failed to import Q&A answers. Make sure you have answered questions in the workspace.');
        } finally {
            setIsImportingQA(false);
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
        <div className="h-[calc(100vh-140px)] flex flex-col -m-content overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 border-b border-border bg-white flex-wrap">
                {/* Back + Title */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => navigate(`/projects/${id}`)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4 text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-sm sm:text-base font-semibold text-gray-900">Proposal Builder</h1>
                        <p className="text-xs text-gray-500 truncate max-w-[150px] sm:max-w-none">{project?.name}</p>
                    </div>
                </div>

                {/* Progress Circle */}
                <div className="flex items-center gap-2 ml-auto">
                    <div className="relative h-10 w-10">
                        <svg className="h-10 w-10 -rotate-90">
                            <circle
                                cx="20"
                                cy="20"
                                r="16"
                                fill="none"
                                stroke="#E5E7EB"
                                strokeWidth="3"
                            />
                            <circle
                                cx="20"
                                cy="20"
                                r="16"
                                fill="none"
                                stroke={completionPercent === 100 ? '#22C55E' : '#6366F1'}
                                strokeWidth="3"
                                strokeDasharray={`${completionPercent} 100`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                            {completionPercent}%
                        </span>
                    </div>
                    <span className="text-xs text-gray-500 hidden sm:block">
                        {approvedCount}/{sections.length} approved
                    </span>
                </div>

                {/* Layout Toggle - Standard vs Stepper */}
                {viewMode === 'sections' && (
                    <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setLayoutMode('standard')}
                            className={clsx(
                                'px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1',
                                layoutMode === 'standard'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            )}
                            title="Standard sidebar view"
                        >
                            <Squares2X2Icon className="h-3.5 w-3.5" />
                            Standard
                        </button>
                        <button
                            onClick={() => setLayoutMode('stepper')}
                            className={clsx(
                                'px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1',
                                layoutMode === 'stepper'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            )}
                            title="Step-by-step wizard view"
                        >
                            <FlagIcon className="h-3.5 w-3.5" />
                            Stepper
                        </button>
                    </div>
                )}

                {/* View Tabs - scrollable on mobile - hide in stepper mode */}
                {layoutMode === 'standard' && (
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 overflow-x-auto flex-shrink-0 max-w-full">
                        <button
                            onClick={() => navigate(`/projects/${id}/versions`)}
                            className="px-2 sm:px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
                        >
                            <DocumentDuplicateIcon className="h-4 w-4 inline sm:mr-1" />
                            <span className="hidden sm:inline">Versions</span>
                        </button>
                        <button
                            onClick={() => setViewMode('sections')}
                            className={clsx(
                                'px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                                viewMode === 'sections'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            )}
                        >
                            <DocumentTextIcon className="h-4 w-4 inline sm:mr-1" />
                            <span className="hidden sm:inline">Sections</span>
                        </button>
                        <button
                            onClick={() => setViewMode('compliance')}
                            className={clsx(
                                'px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                                viewMode === 'compliance'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            )}
                        >
                            <ClipboardDocumentCheckIcon className="h-4 w-4 inline sm:mr-1" />
                            <span className="hidden sm:inline">Compliance</span>
                        </button>
                        <button
                            onClick={() => setViewMode('diagrams')}
                            className={clsx(
                                'px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                                viewMode === 'diagrams'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            )}
                        >
                            <CubeTransparentIcon className="h-4 w-4 inline sm:mr-1" />
                            <span className="hidden sm:inline">Diagrams</span>
                        </button>
                        <button
                            onClick={() => setViewMode('strategy')}
                            className={clsx(
                                'px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                                viewMode === 'strategy'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            )}
                        >
                            <SparklesIcon className="h-4 w-4 inline sm:mr-1" />
                            <span className="hidden sm:inline">Strategy</span>
                        </button>
                    </div>
                )}

                {/* Action buttons - hide in stepper mode and on mobile */}
                {layoutMode === 'standard' && (
                    <>
                        <div className="hidden md:flex items-center gap-2 ml-auto">
                            {/* View Proposal */}
                            <button
                                onClick={() => navigate(`/projects/${id}/proposal-chat`)}
                                className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                                title="View and chat about the proposal"
                            >
                                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                View Proposal
                            </button>

                            {/* Export */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    disabled={isExporting}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    Export
                                    <ChevronDownIcon className="h-3 w-3" />
                                </button>
                                {showExportMenu && (
                                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                                        <button
                                            onClick={() => handleExport('docx')}
                                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <DocumentIcon className="h-4 w-4 text-blue-500" />
                                            Word (.docx)
                                        </button>
                                        <button
                                            onClick={() => handleExport('xlsx')}
                                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <TableCellsIcon className="h-4 w-4 text-green-500" />
                                            Excel (.xlsx)
                                        </button>
                                        <button
                                            onClick={() => handleExport('pptx')}
                                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <PresentationChartBarIcon className="h-4 w-4 text-orange-500" />
                                            PowerPoint (.pptx)
                                        </button>
                                        <hr className="my-1 border-gray-100" />
                                        <button
                                            onClick={() => {
                                                setShowExportMenu(false);
                                                setShowTemplateSelector(true);
                                            }}
                                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <DocumentDuplicateIcon className="h-4 w-4 text-purple-500" />
                                            Use Template...
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Batch Regenerate */}
                            <button
                                onClick={() => setShowBatchRegenerate(true)}
                                className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1.5"
                                title="Regenerate multiple sections at once"
                            >
                                <SparklesIcon className="h-4 w-4" />
                                Batch AI
                            </button>

                            {/* Import from Q&A */}
                            <button
                                onClick={handleImportFromQA}
                                disabled={isImportingQA}
                                className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                                title="Import answers from Q&A Workspace into proposal sections"
                            >
                                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                {isImportingQA ? 'Importing...' : 'Import Q&A'}
                            </button>
                        </div>

                        {/* Add Section - only visible in standard mode */}
                        <button
                            onClick={() => setShowTypeSelector(true)}
                            className="ml-auto md:ml-0 px-2 sm:px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-1.5"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Add Section</span>
                        </button>
                    </>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden bg-gray-50 min-h-0">
                {viewMode === 'strategy' ? (
                    <div className="flex-1 overflow-auto bg-white">
                        <StrategyToolsPanel projectId={projectId} />
                    </div>
                ) : viewMode === 'diagrams' ? (
                    <DiagramGenerator projectId={projectId} documentId={primaryDocumentId || undefined} />
                ) : viewMode === 'compliance' ? (
                    <div className="flex-1 overflow-auto p-6">
                        <ComplianceMatrix projectId={projectId} sections={sections} />
                    </div>
                ) : (
                    <>
                        {/* Stepper Mode - Workflow Phases */}
                        {layoutMode === 'stepper' ? (
                            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                                {/* Workflow Stepper Progress */}
                                <WorkflowStepper
                                    currentPhase={currentPhase}
                                    onPhaseClick={(phase) => setCurrentPhase(phase)}
                                />

                                {/* Phase Content */}
                                <div className={clsx(
                                    "flex-1 min-h-0",
                                    currentPhase !== 'sections' && "overflow-auto"
                                )}>
                                    {currentPhase === 'sections' && (
                                        <div className="flex h-full">
                                            {/* Section list */}
                                            <div className="w-64 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
                                                <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
                                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sections ({sections.length})</span>
                                                    <button
                                                        onClick={() => setShowTypeSelector(true)}
                                                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-all shadow-sm"
                                                        title="Add Section"
                                                    >
                                                        <PlusIcon className="h-3.5 w-3.5" />
                                                        Add
                                                    </button>
                                                </div>
                                                <div className="flex-1 overflow-auto">
                                                    {sections.map((section) => (
                                                        <button
                                                            key={section.id}
                                                            onClick={() => setSelectedSection(section)}
                                                            className={clsx(
                                                                'w-full text-left px-3 py-2 text-sm border-b border-gray-50 hover:bg-gray-50',
                                                                selectedSection?.id === section.id && 'bg-indigo-50 border-l-2 border-l-indigo-500'
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {section.status === 'approved' && <CheckCircleSolidIcon className="h-4 w-4 text-green-500" />}
                                                                <span className="truncate">{section.title}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="p-3 border-t border-gray-100 bg-gray-50 flex flex-col gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => setShowBatchRegenerate(true)}
                                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                                                    >
                                                        <SparklesIcon className="h-3.5 w-3.5" />
                                                        Batch AI
                                                    </button>
                                                    <button
                                                        onClick={handleImportFromQA}
                                                        disabled={isImportingQA}
                                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                                                    >
                                                        <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                                                        {isImportingQA ? 'Importing...' : 'Import Q&A'}
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Section editor */}
                                            <div className="flex-1 overflow-auto">
                                                {selectedSection ? (
                                                    <SectionEditor
                                                        section={selectedSection}
                                                        projectId={projectId}
                                                        onUpdate={handleSectionUpdate}
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-gray-500">
                                                        Select a section to edit
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {currentPhase === 'compliance' && (
                                        <div className="p-6">
                                            <ComplianceMatrix projectId={projectId} sections={sections} />
                                        </div>
                                    )}

                                    {currentPhase === 'strategy' && (
                                        <StrategyToolsPanel projectId={projectId} />
                                    )}

                                    {currentPhase === 'diagrams' && (
                                        <DiagramGenerator projectId={projectId} documentId={primaryDocumentId || undefined} />
                                    )}

                                    {currentPhase === 'view' && (
                                        <div className="flex flex-col h-full overflow-hidden">
                                            {/* Sub-navigation */}
                                            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-6">
                                                <button
                                                    onClick={() => setViewSubPhase('summary')}
                                                    className={clsx(
                                                        'px-3 py-1.5 text-sm font-medium border-b-2 transition-all',
                                                        viewSubPhase === 'summary' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                                    )}
                                                >
                                                    Summary
                                                </button>
                                                <button
                                                    onClick={() => setViewSubPhase('view')}
                                                    className={clsx(
                                                        'px-3 py-1.5 text-sm font-medium border-b-2 transition-all',
                                                        viewSubPhase === 'view' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                                    )}
                                                >
                                                    Full Proposal
                                                </button>
                                                <button
                                                    onClick={() => setViewSubPhase('versions')}
                                                    className={clsx(
                                                        'px-3 py-1.5 text-sm font-medium border-b-2 transition-all',
                                                        viewSubPhase === 'versions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                                    )}
                                                >
                                                    Version History
                                                </button>
                                            </div>

                                            {/* Sub-phase Content */}
                                            <div className="flex-1 overflow-hidden">
                                                {viewSubPhase === 'summary' && (
                                                    <div className="p-6 overflow-auto h-full">
                                                        <div className="max-w-4xl mx-auto">
                                                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                                                                <h2 className="text-xl font-semibold text-gray-900 mb-2">Review Your Proposal</h2>
                                                                <p className="text-gray-600 mb-6 font-medium">Your proposal is complete. Review the summary below or check the full document and version history using the tabs above.</p>

                                                                <div className="flex flex-wrap gap-3">
                                                                    {/* Export Dropdown in View Phase */}
                                                                    <div className="relative">
                                                                        <button
                                                                            onClick={() => setShowExportMenu(!showExportMenu)}
                                                                            disabled={isExporting}
                                                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all text-sm font-medium"
                                                                        >
                                                                            <ArrowDownTrayIcon className="h-5 w-5" />
                                                                            Export Final Proposal
                                                                            <ChevronDownIcon className="h-3 w-3" />
                                                                        </button>
                                                                        {showExportMenu && (
                                                                            <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                                                                                <button
                                                                                    onClick={() => handleExport('docx')}
                                                                                    className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex items-center gap-3 transition-colors text-gray-700"
                                                                                >
                                                                                    <DocumentIcon className="h-4 w-4 text-blue-500" />
                                                                                    Word (.docx)
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleExport('xlsx')}
                                                                                    className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex items-center gap-3 transition-colors text-gray-700"
                                                                                >
                                                                                    <TableCellsIcon className="h-4 w-4 text-green-500" />
                                                                                    Excel (.xlsx)
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleExport('pptx')}
                                                                                    className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex items-center gap-3 transition-colors text-gray-700"
                                                                                >
                                                                                    <PresentationChartBarIcon className="h-4 w-4 text-orange-500" />
                                                                                    PowerPoint (.pptx)
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setViewSubPhase('view')}
                                                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-all text-sm font-medium"
                                                                    >
                                                                        <EyeIcon className="h-5 w-5 text-indigo-500" />
                                                                        Preview Document
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Summary Stats */}
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                <div className="bg-white rounded-lg border p-4 text-center">
                                                                    <div className="text-2xl font-bold text-indigo-600">{sections.length}</div>
                                                                    <div className="text-xs text-gray-500 font-medium">Sections</div>
                                                                </div>
                                                                <div className="bg-white rounded-lg border p-4 text-center">
                                                                    <div className="text-2xl font-bold text-green-600">{sections.filter(s => s.status === 'approved').length}</div>
                                                                    <div className="text-xs text-gray-500 font-medium">Approved</div>
                                                                </div>
                                                                <div className="bg-white rounded-lg border p-4 text-center">
                                                                    <div className="text-2xl font-bold text-purple-600">100%</div>
                                                                    <div className="text-xs text-gray-500 font-medium">Complete</div>
                                                                </div>
                                                                <div className="bg-white rounded-lg border p-4 text-center">
                                                                    <div className="text-2xl font-bold text-amber-600">{project?.status || 'Active'}</div>
                                                                    <div className="text-xs text-gray-500 font-medium">Status</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {viewSubPhase === 'view' && (
                                                    <ProposalView projectId={projectId} />
                                                )}

                                                {viewSubPhase === 'versions' && (
                                                    <VersionHistory
                                                        projectId={projectId}
                                                        onRestoreSuccess={() => {
                                                            loadSections();
                                                            setViewSubPhase('summary');
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Phase Navigation */}
                                <div className="border-t border-gray-200 bg-white p-4 flex items-center justify-between flex-shrink-0 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                                    <button
                                        onClick={() => {
                                            const phases: WorkflowPhase[] = ['sections', 'compliance', 'strategy', 'diagrams', 'view'];
                                            const idx = phases.indexOf(currentPhase);
                                            if (idx > 0) setCurrentPhase(phases[idx - 1]);
                                        }}
                                        disabled={currentPhase === 'sections'}
                                        className={clsx(
                                            'group flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all',
                                            currentPhase === 'sections'
                                                ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                                                : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600 border border-gray-200'
                                        )}
                                    >
                                        <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                                        Previous
                                    </button>

                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Current Phase</span>
                                        <span className="text-sm font-bold text-indigo-600 capitalize">{currentPhase}</span>
                                    </div>

                                    <button
                                        onClick={() => {
                                            const phases: WorkflowPhase[] = ['sections', 'compliance', 'strategy', 'diagrams', 'view'];
                                            const idx = phases.indexOf(currentPhase);
                                            if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
                                        }}
                                        disabled={currentPhase === 'view'}
                                        className={clsx(
                                            'group flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-md',
                                            currentPhase === 'view'
                                                ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg active:scale-95'
                                        )}
                                    >
                                        Next
                                        <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Standard Mode - Left: Section Navigator - hidden on mobile by default */}
                                <div className="hidden md:flex w-64 lg:w-72 bg-white border-r border-gray-200 flex-col overflow-hidden">
                                    {/* Knowledge Context - Collapsible */}
                                    {project?.knowledge_profiles && project.knowledge_profiles.length > 0 && (
                                        <div className="border-b border-gray-100">
                                            <button
                                                onClick={() => setShowKnowledgeContext(!showKnowledgeContext)}
                                                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <BookOpenIcon className="h-4 w-4 text-purple-600" />
                                                    <span className="text-xs font-medium text-gray-700">Knowledge Context</span>
                                                </div>
                                                <ChevronRightIcon className={clsx(
                                                    "h-4 w-4 text-gray-400 transition-transform",
                                                    showKnowledgeContext && "rotate-90"
                                                )} />
                                            </button>
                                            {showKnowledgeContext && (
                                                <div className="px-4 pb-3">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {project.knowledge_profiles.map((p: any) => (
                                                            <span
                                                                key={p.id}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100"
                                                            >
                                                                📁 {p.name}
                                                                {p.items_count !== undefined && (
                                                                    <span className="text-purple-500">({p.items_count})</span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Section List Header */}
                                    <div className="px-4 py-3 flex items-center justify-between">
                                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            Sections ({sections.length})
                                        </h2>
                                    </div>

                                    {/* Section List */}
                                    <div className="flex-1 overflow-y-auto px-2 pb-4">
                                        {sections.length === 0 ? (
                                            <div className="text-center py-12 px-4">
                                                <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                                    <DocumentTextIcon className="h-7 w-7 text-gray-400" />
                                                </div>
                                                <p className="text-sm font-medium text-gray-700 mb-1">No sections yet</p>
                                                <p className="text-xs text-gray-500 mb-4">Add your first section to get started</p>
                                                <button
                                                    onClick={() => setShowTypeSelector(true)}
                                                    className="text-xs font-medium text-primary hover:text-primary-dark"
                                                >
                                                    + Add First Section
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {sections.map((section, index) => {
                                                    const style = getSectionStyle(section.section_type?.slug);
                                                    const IconComponent = style.icon;
                                                    const status = STATUS_CONFIG[section.status] || STATUS_CONFIG.draft;
                                                    const StatusIcon = status.icon;
                                                    const overdue = isOverdue(section.due_date, section.status);

                                                    return (
                                                        <div
                                                            key={section.id}
                                                            className={clsx(
                                                                'group rounded-lg transition-all cursor-pointer',
                                                                selectedSection?.id === section.id
                                                                    ? 'bg-primary/10 border border-primary/30'
                                                                    : 'hover:bg-gray-50 border border-transparent'
                                                            )}
                                                            onClick={() => setSelectedSection(section)}
                                                        >
                                                            <div className="flex items-center p-3 gap-3">
                                                                {/* Icon */}
                                                                <div className={clsx(
                                                                    'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                                                    style.bgColor
                                                                )}>
                                                                    <IconComponent className={clsx('h-5 w-5', style.color)} />
                                                                </div>

                                                                {/* Content */}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                                        {section.title}
                                                                    </p>
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        <span className={clsx(
                                                                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                                                                            status.bg, status.color
                                                                        )}>
                                                                            <StatusIcon className="h-3 w-3" />
                                                                            {status.label}
                                                                        </span>
                                                                        {overdue && (
                                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                                                                                <ExclamationCircleIcon className="h-3 w-3" />
                                                                                Overdue
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Actions - vertical layout on right */}
                                                                <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleMoveSection(section.id, 'up'); }}
                                                                        disabled={index === 0}
                                                                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-gray-400 hover:text-gray-600"
                                                                    >
                                                                        <ChevronUpIcon className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleMoveSection(section.id, 'down'); }}
                                                                        disabled={index === sections.length - 1}
                                                                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-gray-400 hover:text-gray-600"
                                                                    >
                                                                        <ChevronDownIcon className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}
                                                                        className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                                                                    >
                                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                    </div>
                                </div>

                                {/* Right: Section Editor */}
                                <div className="flex-1 overflow-hidden">
                                    {selectedSection ? (
                                        <SectionEditor
                                            section={selectedSection}
                                            projectId={projectId}
                                            onUpdate={handleSectionUpdate}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50">
                                            <div className="h-20 w-20 rounded-2xl bg-white border-2 border-dashed border-gray-200 flex items-center justify-center mb-6">
                                                <DocumentTextIcon className="h-10 w-10 text-gray-300" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                No Section Selected
                                            </h3>
                                            <p className="text-sm text-gray-500 mb-6 max-w-sm">
                                                Select a section from the left panel to edit, or add a new section to get started.
                                            </p>
                                            <button
                                                onClick={() => setShowTypeSelector(true)}
                                                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                                Add Section
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Section Type Selector Modal */}
            {showTypeSelector && (
                <SectionTypeSelector
                    projectId={projectId}
                    onSelect={handleAddSection}
                    onClose={() => setShowTypeSelector(false)}
                    existingSectionSlugs={sections.map(s => s.section_type?.slug || '').filter(Boolean)}
                />
            )}

            {/* Batch Regenerate Modal */}
            <BatchRegenerateModal
                isOpen={showBatchRegenerate}
                onClose={() => setShowBatchRegenerate(false)}
                sections={sections}
                projectId={projectId}
                onComplete={() => {
                    loadSections();
                    setShowBatchRegenerate(false);
                }}
            />

            {/* Template Selector Modal */}
            <TemplateSelector
                isOpen={showTemplateSelector}
                onSelect={(templateId) => {
                    if (exportFormat) {
                        performExport(exportFormat, templateId);
                    }
                    setShowTemplateSelector(false);
                    setExportFormat(null);
                }}
                onClose={() => {
                    setShowTemplateSelector(false);
                    setExportFormat(null);
                }}
            />
        </div>
    );
}
