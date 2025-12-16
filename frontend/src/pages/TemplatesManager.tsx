import { useState, useEffect, useCallback } from 'react';
import { sectionsApi } from '@/api/client';
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
} from '@heroicons/react/24/outline';

export default function TemplatesManager() {
    const [templates, setTemplates] = useState<SectionTemplate[]>([]);
    const [sectionTypes, setSectionTypes] = useState<RFPSectionType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<SectionTemplate | null>(null);
    const [filterType, setFilterType] = useState<number | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formSectionTypeId, setFormSectionTypeId] = useState<number | null>(null);
    const [formVariables, setFormVariables] = useState<string[]>([]);

    const loadData = useCallback(async () => {
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

    useEffect(() => {
        loadData();
    }, [loadData]);

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
            loadData();
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Section Templates</h1>
                    <p className="text-text-secondary mt-1">
                        Create reusable templates for proposal sections
                    </p>
                </div>
                <button
                    onClick={() => openEditor()}
                    className="btn-primary"
                >
                    <PlusIcon className="h-5 w-5" />
                    New Template
                </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-4">
                <label className="text-sm text-text-secondary">Filter by section type:</label>
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

            {/* Templates Grid */}
            {templates.length === 0 ? (
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
                                    <span className="text-xl">
                                        {template.section_type?.icon || '📝'}
                                    </span>
                                    <h3 className="font-medium text-text-primary">
                                        {template.name}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditor(template);
                                        }}
                                        className="p-1 hover:bg-background rounded"
                                    >
                                        <PencilIcon className="h-4 w-4 text-text-muted" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(template.id);
                                        }}
                                        className="p-1 hover:bg-error-light rounded"
                                    >
                                        <TrashIcon className="h-4 w-4 text-error" />
                                    </button>
                                </div>
                            </div>

                            {template.description && (
                                <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                                    {template.description}
                                </p>
                            )}

                            <div className="text-xs text-text-muted line-clamp-3 font-mono bg-background p-2 rounded">
                                {template.content.substring(0, 150)}...
                            </div>

                            {template.variables && template.variables.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                    {template.variables.map(v => (
                                        <span
                                            key={v}
                                            className="text-xs px-2 py-0.5 bg-primary-light text-primary rounded-full"
                                        >
                                            {`{{${v}}}`}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Template Editor Modal */}
            {showEditor && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-text-primary">
                                {editingTemplate ? 'Edit Template' : 'New Template'}
                            </h2>
                            <button
                                onClick={closeEditor}
                                className="p-2 hover:bg-background rounded-lg"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
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
                                    placeholder="Enter template content here...

Use {{company_name}}, {{project_name}}, etc. for variables that will be replaced when applying the template."
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

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
                            <button onClick={closeEditor} className="btn-secondary">
                                Cancel
                            </button>
                            <button onClick={handleSave} className="btn-primary">
                                {editingTemplate ? 'Update Template' : 'Create Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
