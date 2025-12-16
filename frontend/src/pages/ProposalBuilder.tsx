import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sectionsApi, projectsApi } from '@/api/client';
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
} from '@heroicons/react/24/outline';
import SectionTypeSelector from '@/components/sections/SectionTypeSelector';
import SectionEditor from '@/components/sections/SectionEditor';

export default function ProposalBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const projectId = Number(id);

    const [project, setProject] = useState<Project | null>(null);
    const [sections, setSections] = useState<RFPSection[]>([]);
    const [selectedSection, setSelectedSection] = useState<RFPSection | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (projectId) {
            loadProject();
            loadSections();
        }
    }, [projectId]);

    const loadProject = async () => {
        try {
            const response = await projectsApi.get(projectId);
            setProject(response.data.project);
        } catch {
            toast.error('Failed to load project');
        }
    };

    const loadSections = async () => {
        try {
            setIsLoading(true);
            const response = await sectionsApi.listSections(projectId);
            setSections(response.data.sections || []);
            if (response.data.sections?.length > 0 && !selectedSection) {
                setSelectedSection(response.data.sections[0]);
            }
        } catch {
            toast.error('Failed to load sections');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMoveSection = async (sectionId: number, direction: 'up' | 'down') => {
        const currentIndex = sections.findIndex(s => s.id === sectionId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sections.length) return;

        const newSections = [...sections];
        [newSections[currentIndex], newSections[newIndex]] = [newSections[newIndex], newSections[currentIndex]];
        setSections(newSections);

        const orderIds = newSections.map(s => s.id);
        await sectionsApi.reorderSections(projectId, orderIds);
    };

    const handleAddSection = async (sectionType: RFPSectionType, inputs: Record<string, string>) => {
        try {
            const response = await sectionsApi.addSection(projectId, {
                section_type_id: sectionType.id,
                inputs,
            });
            const newSection = response.data.section;
            setSections([...sections, newSection]);
            setSelectedSection(newSection);
            setShowTypeSelector(false);
            toast.success(`${sectionType.name} section added!`);
        } catch {
            toast.error('Failed to add section');
        }
    };

    const handleDeleteSection = async (sectionId: number) => {
        if (!confirm('Delete this section?')) return;

        try {
            await sectionsApi.deleteSection(projectId, sectionId);
            const newSections = sections.filter(s => s.id !== sectionId);
            setSections(newSections);
            if (selectedSection?.id === sectionId) {
                setSelectedSection(newSections[0] || null);
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

    const handleExport = async (format: 'docx' | 'xlsx') => {
        setIsExporting(true);
        try {
            const response = await sectionsApi.exportProposal(projectId, format, true);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${project?.name?.replace(/\s+/g, '_') || 'proposal'}_proposal.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`Proposal exported as ${format.toUpperCase()}`);
            setShowExportMenu(false);
        } catch {
            toast.error('Failed to export proposal');
        } finally {
            setIsExporting(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircleIcon className="h-4 w-4 text-success" />;
            case 'generated':
                return <SparklesIcon className="h-4 w-4 text-primary" />;
            case 'rejected':
                return <XCircleIcon className="h-4 w-4 text-error" />;
            default:
                return <DocumentTextIcon className="h-4 w-4 text-text-muted" />;
        }
    };

    const approvedCount = sections.filter(s => s.status === 'approved').length;
    const completionPercent = sections.length > 0 ? (approvedCount / sections.length) * 100 : 0;

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
                    <h1 className="text-lg font-semibold text-text-primary">
                        Proposal Builder
                    </h1>
                    <p className="text-sm text-text-secondary">
                        {project?.name} • {approvedCount} / {sections.length} sections approved
                    </p>
                </div>
                <div className="h-2 w-32 bg-background rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${completionPercent}%` }}
                    />
                </div>

                {/* Export Button */}
                <div className="relative">
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        disabled={isExporting}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export
                    </button>
                    {showExportMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-surface rounded-lg shadow-lg border border-border z-50">
                            <button
                                onClick={() => handleExport('docx')}
                                disabled={isExporting}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors text-left"
                            >
                                <DocumentIcon className="h-5 w-5 text-blue-500" />
                                <div>
                                    <p className="text-sm font-medium text-text-primary">Word Document</p>
                                    <p className="text-xs text-text-muted">.docx format</p>
                                </div>
                            </button>
                            <button
                                onClick={() => handleExport('xlsx')}
                                disabled={isExporting}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors text-left border-t border-border"
                            >
                                <TableCellsIcon className="h-5 w-5 text-green-500" />
                                <div>
                                    <p className="text-sm font-medium text-text-primary">Excel Spreadsheet</p>
                                    <p className="text-xs text-text-muted">.xlsx format</p>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setShowTypeSelector(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <PlusIcon className="h-4 w-4" />
                    Add Section
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Section Navigator */}
                <div className="w-[280px] border-r border-border bg-surface overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                        <h2 className="text-sm font-medium text-text-secondary mb-3">
                            Proposal Sections
                        </h2>

                        {sections.length === 0 ? (
                            <div className="text-center py-8">
                                <DocumentTextIcon className="h-10 w-10 mx-auto text-text-muted mb-3" />
                                <p className="text-sm text-text-muted mb-4">No sections yet</p>
                                <button
                                    onClick={() => setShowTypeSelector(true)}
                                    className="btn-secondary text-sm"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add First Section
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {sections.map((section, index) => (
                                    <div
                                        key={section.id}
                                        className={clsx(
                                            'group rounded-lg transition-all',
                                            selectedSection?.id === section.id
                                                ? 'bg-primary-light border border-primary'
                                                : 'hover:bg-background border border-transparent'
                                        )}
                                    >
                                        <div className="flex items-center">
                                            <div className="flex flex-col p-1">
                                                <button
                                                    onClick={() => handleMoveSection(section.id, 'up')}
                                                    disabled={index === 0}
                                                    className="p-0.5 hover:bg-background rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <ChevronUpIcon className="h-3 w-3 text-text-muted" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveSection(section.id, 'down')}
                                                    disabled={index === sections.length - 1}
                                                    className="p-0.5 hover:bg-background rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <ChevronDownIcon className="h-3 w-3 text-text-muted" />
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => setSelectedSection(section)}
                                                className="flex-1 text-left p-3 pl-0"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-lg">
                                                        {section.section_type?.icon || '📄'}
                                                    </span>
                                                    {getStatusIcon(section.status)}
                                                </div>
                                                <p className="text-sm font-medium text-text-primary line-clamp-1">
                                                    {section.title}
                                                </p>
                                            </button>

                                            <button
                                                onClick={() => handleDeleteSection(section.id)}
                                                className="p-2 opacity-0 group-hover:opacity-100 hover:text-error transition-opacity"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <DocumentTextIcon className="h-16 w-16 text-text-muted mb-4" />
                            <h3 className="text-lg font-medium text-text-primary mb-2">
                                No Section Selected
                            </h3>
                            <p className="text-text-secondary mb-6 max-w-md">
                                Select a section from the left panel to edit, or add a new section to get started.
                            </p>
                            <button
                                onClick={() => setShowTypeSelector(true)}
                                className="btn-primary"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Section
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Section Type Selector Modal */}
            {showTypeSelector && (
                <SectionTypeSelector
                    onSelect={handleAddSection}
                    onClose={() => setShowTypeSelector(false)}
                    existingSectionSlugs={sections.map(s => s.section_type?.slug || '').filter(Boolean)}
                />
            )}
        </div>
    );
}
