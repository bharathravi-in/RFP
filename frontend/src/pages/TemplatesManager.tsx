import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { sectionsApi, exportTemplatesApi } from '@/api/client';
import { SectionTemplate, RFPSectionType } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    DocumentDuplicateIcon,
    XMarkIcon,
    CheckIcon,
    ArrowUpTrayIcon,
    DocumentIcon,
    PresentationChartBarIcon,
    StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

interface ExportTemplate {
    id: number;
    name: string;
    description?: string;
    template_type: 'docx' | 'pptx';
    file_name: string;
    file_size: number;
    is_default: boolean;
    created_at: string;
    created_by?: string;
}

export default function TemplatesManager() {
    const [activeTab, setActiveTab] = useState<'section' | 'export'>('section');

    // Section templates state
    const [templates, setTemplates] = useState<SectionTemplate[]>([]);
    const [sectionTypes, setSectionTypes] = useState<RFPSectionType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<SectionTemplate | null>(null);
    const [filterType, setFilterType] = useState<number | null>(null);

    // Export templates state
    const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
    const [exportLoading, setExportLoading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state for section templates
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formSectionTypeId, setFormSectionTypeId] = useState<number | null>(null);
    const [formVariables, setFormVariables] = useState<string[]>([]);

    // Form state for export template upload
    const [uploadName, setUploadName] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadIsDefault, setUploadIsDefault] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Load section templates
    const loadSectionTemplates = useCallback(async () => {
        try {
            setIsLoading(true);
            const [templatesRes, typesRes] = await Promise.all([
                sectionsApi.listTemplates(filterType || undefined),
                sectionsApi.listTypes(),
            ]);
            setTemplates(templatesRes.data.templates || []);
            setSectionTypes(typesRes.data.section_types || []);
        } catch {
            toast.error('Failed to load templates');
        } finally {
            setIsLoading(false);
        }
    }, [filterType]);

    // Load export templates
    const loadExportTemplates = useCallback(async () => {
        try {
            setExportLoading(true);
            const res = await exportTemplatesApi.list();
            setExportTemplates(res.data.templates || []);
        } catch {
            toast.error('Failed to load export templates');
        } finally {
            setExportLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'section') {
            loadSectionTemplates();
        } else {
            loadExportTemplates();
        }
    }, [activeTab, loadSectionTemplates, loadExportTemplates]);

    // Section template handlers
    const openEditor = (template?: SectionTemplate) => {
        if (template) {
            setEditingTemplate(template);
            setFormName(template.name);
            setFormContent(template.content);
            setFormDescription(template.description || '');
            setFormSectionTypeId(template.section_type_id);
            setFormVariables(template.variables || []);
        } else {
            setEditingTemplate(null);
            setFormName('');
            setFormContent('');
            setFormDescription('');
            setFormSectionTypeId(null);
            setFormVariables([]);
        }
        setShowEditor(true);
    };

    const closeEditor = () => {
        setShowEditor(false);
        setEditingTemplate(null);
    };

    const extractVariables = (content: string): string[] => {
        const regex = /\{\{(\w+)\}\}/g;
        const matches = content.matchAll(regex);
        const vars = new Set<string>();
        for (const match of matches) {
            vars.add(match[1]);
        }
        return Array.from(vars);
    };

    const handleContentChange = (content: string) => {
        setFormContent(content);
        setFormVariables(extractVariables(content));
    };

    const handleSave = async () => {
        if (!formName.trim() || !formContent.trim()) {
            toast.error('Name and content are required');
            return;
        }

        try {
            if (editingTemplate) {
                await sectionsApi.updateTemplate(editingTemplate.id, {
                    name: formName,
                    content: formContent,
                    description: formDescription,
                    section_type_id: formSectionTypeId || undefined,
                    variables: formVariables,
                });
                toast.success('Template updated');
            } else {
                await sectionsApi.createTemplate({
                    name: formName,
                    content: formContent,
                    description: formDescription,
                    section_type_id: formSectionTypeId || undefined,
                    variables: formVariables,
                });
                toast.success('Template created');
            }
            closeEditor();
            loadSectionTemplates();
        } catch {
            toast.error('Failed to save template');
        }
    };

    const handleDelete = async (templateId: number) => {
        if (!confirm('Delete this template?')) return;

        try {
            await sectionsApi.deleteTemplate(templateId);
            setTemplates(templates.filter(t => t.id !== templateId));
            toast.success('Template deleted');
        } catch {
            toast.error('Failed to delete template');
        }
    };

    // Export template handlers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext !== 'docx' && ext !== 'pptx') {
                toast.error('Only DOCX and PPTX files are allowed');
                return;
            }
            setUploadFile(file);
            setUploadName(file.name.replace(/\.(docx|pptx)$/i, ''));
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || !uploadName.trim()) {
            toast.error('Please select a file and enter a name');
            return;
        }

        try {
            setUploading(true);
            await exportTemplatesApi.upload(uploadFile, uploadName, uploadDescription, uploadIsDefault);
            toast.success('Template uploaded successfully');
            setShowUploadModal(false);
            setUploadFile(null);
            setUploadName('');
            setUploadDescription('');
            setUploadIsDefault(false);
            loadExportTemplates();
        } catch {
            toast.error('Failed to upload template');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteExport = async (templateId: number) => {
        if (!confirm('Delete this export template?')) return;

        try {
            await exportTemplatesApi.delete(templateId);
            setExportTemplates(exportTemplates.filter(t => t.id !== templateId));
            toast.success('Template deleted');
        } catch {
            toast.error('Failed to delete template');
        }
    };

    const handleSetDefault = async (templateId: number) => {
        try {
            await exportTemplatesApi.setDefault(templateId);
            loadExportTemplates();
            toast.success('Set as default template');
        } catch {
            toast.error('Failed to set default');
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Templates</h1>
                    <p className="text-text-secondary mt-1">
                        Manage section and export templates
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('section')}
                    className={clsx(
                        'px-4 py-2 rounded-md text-sm font-medium transition-all',
                        activeTab === 'section'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                    )}
                >
                    <DocumentDuplicateIcon className="h-4 w-4 inline mr-2" />
                    Section Templates
                </button>
                <button
                    onClick={() => setActiveTab('export')}
                    className={clsx(
                        'px-4 py-2 rounded-md text-sm font-medium transition-all',
                        activeTab === 'export'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                    )}
                >
                    <ArrowUpTrayIcon className="h-4 w-4 inline mr-2" />
                    Export Templates
                </button>
            </div>

            {/* Section Templates Tab */}
            {activeTab === 'section' && (
                <>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="text-sm text-text-secondary">Filter by type:</label>
                            <select
                                value={filterType || ''}
                                onChange={(e) => setFilterType(e.target.value ? Number(e.target.value) : null)}
                                className="px-3 py-2 border border-border rounded-lg bg-background text-text-primary"
                            >
                                <option value="">All Types</option>
                                {sectionTypes.map(type => (
                                    <option key={type.id} value={type.id}>
                                        {type.icon} {type.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button onClick={() => openEditor()} className="btn-primary">
                            <PlusIcon className="h-5 w-5" />
                            New Template
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[200px]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-16 bg-surface rounded-xl border border-border">
                            <DocumentDuplicateIcon className="h-12 w-12 mx-auto text-text-muted mb-4" />
                            <h3 className="text-lg font-medium text-text-primary mb-2">No Templates Yet</h3>
                            <p className="text-text-secondary mb-6">
                                Create templates to speed up your proposal writing
                            </p>
                            <button onClick={() => openEditor()} className="btn-primary">
                                <PlusIcon className="h-4 w-4" />
                                Create First Template
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {templates.map(template => (
                                <div
                                    key={template.id}
                                    className="card hover:border-primary transition-colors cursor-pointer"
                                    onClick={() => openEditor(template)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{template.section_type?.icon || '📝'}</span>
                                            <h3 className="font-medium text-text-primary">{template.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openEditor(template); }}
                                                className="p-1 hover:bg-background rounded"
                                            >
                                                <PencilIcon className="h-4 w-4 text-text-muted" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                                                className="p-1 hover:bg-error-light rounded"
                                            >
                                                <TrashIcon className="h-4 w-4 text-error" />
                                            </button>
                                        </div>
                                    </div>
                                    {template.description && (
                                        <p className="text-sm text-text-secondary mb-3 line-clamp-2">{template.description}</p>
                                    )}
                                    <div className="text-xs text-text-muted line-clamp-3 font-mono bg-background p-2 rounded">
                                        {template.content.substring(0, 150)}...
                                    </div>
                                    {template.variables && template.variables.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-3">
                                            {template.variables.map(v => (
                                                <span key={v} className="text-xs px-2 py-0.5 bg-primary-light text-primary rounded-full">
                                                    {`{{${v}}}`}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Export Templates Tab */}
            {activeTab === 'export' && (
                <>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-text-secondary">
                            Upload DOCX or PPTX templates to use when exporting proposals
                        </p>
                        <button onClick={() => setShowUploadModal(true)} className="btn-primary">
                            <ArrowUpTrayIcon className="h-5 w-5" />
                            Upload Template
                        </button>
                    </div>

                    {exportLoading ? (
                        <div className="flex items-center justify-center min-h-[200px]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : exportTemplates.length === 0 ? (
                        <div className="text-center py-16 bg-surface rounded-xl border border-border">
                            <ArrowUpTrayIcon className="h-12 w-12 mx-auto text-text-muted mb-4" />
                            <h3 className="text-lg font-medium text-text-primary mb-2">No Export Templates</h3>
                            <p className="text-text-secondary mb-6">
                                Upload DOCX or PPTX templates to use when exporting proposals
                            </p>
                            <button onClick={() => setShowUploadModal(true)} className="btn-primary">
                                <ArrowUpTrayIcon className="h-4 w-4" />
                                Upload First Template
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {exportTemplates.map(template => (
                                <div
                                    key={template.id}
                                    className={clsx(
                                        'card hover:border-primary transition-colors',
                                        template.is_default && 'border-primary ring-2 ring-primary/20'
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            {template.template_type === 'docx' ? (
                                                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <DocumentIcon className="h-5 w-5 text-blue-600" />
                                                </div>
                                            ) : (
                                                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                                    <PresentationChartBarIcon className="h-5 w-5 text-orange-600" />
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-medium text-text-primary">{template.name}</h3>
                                                <p className="text-xs text-text-muted">
                                                    {template.template_type.toUpperCase()} • {formatFileSize(template.file_size)}
                                                </p>
                                            </div>
                                        </div>
                                        {template.is_default && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-primary text-white rounded-full">
                                                Default
                                            </span>
                                        )}
                                    </div>

                                    {template.description && (
                                        <p className="text-sm text-text-secondary mb-3 line-clamp-2">{template.description}</p>
                                    )}

                                    <p className="text-xs text-text-muted mb-4">
                                        {template.file_name}
                                    </p>

                                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                                        {!template.is_default && (
                                            <button
                                                onClick={() => handleSetDefault(template.id)}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-primary hover:bg-primary-light rounded-lg transition-colors"
                                            >
                                                <StarIcon className="h-4 w-4" />
                                                Set Default
                                            </button>
                                        )}
                                        {template.is_default && (
                                            <div className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-primary">
                                                <StarSolidIcon className="h-4 w-4" />
                                                Default
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleDeleteExport(template.id)}
                                            className="p-1.5 text-error hover:bg-error-light rounded-lg transition-colors"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Section Template Editor Modal */}
            {showEditor && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-text-primary">
                                {editingTemplate ? 'Edit Template' : 'New Template'}
                            </h2>
                            <button onClick={closeEditor} className="p-2 hover:bg-background rounded-lg">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Template Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g., Company Introduction"
                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Section Type
                                    </label>
                                    <select
                                        value={formSectionTypeId || ''}
                                        onChange={(e) => setFormSectionTypeId(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary"
                                    >
                                        <option value="">Any Section Type</option>
                                        {sectionTypes.map(type => (
                                            <option key={type.id} value={type.id}>
                                                {type.icon} {type.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Brief description of this template"
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">
                                    Content * <span className="text-text-muted font-normal">(use {'{{variable}}'} for placeholders)</span>
                                </label>
                                <textarea
                                    value={formContent}
                                    onChange={(e) => handleContentChange(e.target.value)}
                                    placeholder="Enter template content here..."
                                    rows={12}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary font-mono text-sm resize-none"
                                />
                            </div>

                            {formVariables.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Detected Variables
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {formVariables.map(v => (
                                            <span
                                                key={v}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-light text-primary rounded-full text-sm"
                                            >
                                                <CheckIcon className="h-3 w-3" />
                                                {v}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
                            <button onClick={closeEditor} className="btn-secondary">Cancel</button>
                            <button onClick={handleSave} className="btn-primary">
                                {editingTemplate ? 'Update Template' : 'Create Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Export Template Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-text-primary">
                                Upload Export Template
                            </h2>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-background rounded-lg">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Template File *
                                </label>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".docx,.pptx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                {uploadFile ? (
                                    <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                                        {uploadFile.name.endsWith('.docx') ? (
                                            <DocumentIcon className="h-8 w-8 text-blue-600" />
                                        ) : (
                                            <PresentationChartBarIcon className="h-8 w-8 text-orange-600" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-text-primary truncate">{uploadFile.name}</p>
                                            <p className="text-xs text-text-muted">{formatFileSize(uploadFile.size)}</p>
                                        </div>
                                        <button
                                            onClick={() => setUploadFile(null)}
                                            className="p-1 hover:bg-surface rounded"
                                        >
                                            <XMarkIcon className="h-4 w-4 text-text-muted" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full p-6 border-2 border-dashed border-border rounded-lg text-center hover:border-primary hover:bg-primary-light/30 transition-colors"
                                    >
                                        <ArrowUpTrayIcon className="h-8 w-8 mx-auto text-text-muted mb-2" />
                                        <p className="text-sm text-text-secondary">Click to upload DOCX or PPTX</p>
                                    </button>
                                )}
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">
                                    Template Name *
                                </label>
                                <input
                                    type="text"
                                    value={uploadName}
                                    onChange={(e) => setUploadName(e.target.value)}
                                    placeholder="e.g., Company Proposal Template"
                                    className="input"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">
                                    Description <span className="text-text-muted">(optional)</span>
                                </label>
                                <textarea
                                    value={uploadDescription}
                                    onChange={(e) => setUploadDescription(e.target.value)}
                                    placeholder="Brief description of this template"
                                    rows={2}
                                    className="input resize-none"
                                />
                            </div>

                            {/* Set as default */}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={uploadIsDefault}
                                    onChange={(e) => setUploadIsDefault(e.target.checked)}
                                    className="checkbox"
                                />
                                <span className="text-sm text-text-primary">Set as default template</span>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-6">
                            <button onClick={() => setShowUploadModal(false)} className="btn-secondary">
                                Cancel
                            </button>
                            <button onClick={handleUpload} disabled={uploading || !uploadFile} className="btn-primary">
                                {uploading ? 'Uploading...' : 'Upload Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
