import { useState, useEffect, useCallback } from 'react';
import { sectionsApi } from '@/api/client';
import { RFPSectionType } from '@/types';
import toast from 'react-hot-toast';
import { XMarkIcon, MagnifyingGlassIcon, CheckCircleIcon, SparklesIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import SectionChatAssistant from './SectionChatAssistant';

interface SectionTypeSelectorProps {
    projectId: number;
    onSelect: (sectionType: RFPSectionType, inputs: Record<string, string>, initialContent?: string) => void;
    onClose: () => void;
    existingSectionSlugs?: string[];
}

export default function SectionTypeSelector({ projectId, onSelect, onClose, existingSectionSlugs = [] }: SectionTypeSelectorProps) {
    const [sectionTypes, setSectionTypes] = useState<RFPSectionType[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'types' | 'templates'>('types');
    const [selectedType, setSelectedType] = useState<RFPSectionType | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showChatAssistant, setShowChatAssistant] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [typesRes, templatesRes] = await Promise.all([
                sectionsApi.listTypes(),
                sectionsApi.listTemplates()
            ]);
            setSectionTypes(typesRes.data.section_types || []);
            setTemplates(templatesRes.data.templates || []);
        } catch {
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSelectType = (type: RFPSectionType) => {
        // Check if this section type already exists (for single-instance types like Q&A)
        const singleInstanceTypes = ['qa_questionnaire'];
        if (singleInstanceTypes.includes(type.slug) && existingSectionSlugs.includes(type.slug)) {
            toast.error('This section type already exists in your proposal');
            return;
        }

        setSelectedType(type);
        setSelectedTemplate(null);
        // Initialize inputs for required fields
        const initialInputs: Record<string, string> = {};
        (type.required_inputs || []).forEach(input => {
            initialInputs[input] = '';
        });
        setInputs(initialInputs);
    };

    const handleSelectTemplate = (template: any) => {
        if (!template.section_type) return;

        // Check if this section type already exists
        if (isSectionDisabled(template.section_type)) {
            toast.error('This section type already exists in your proposal');
            return;
        }

        setSelectedTemplate(template);
        setSelectedType(template.section_type);

        // Initialize inputs
        const initialInputs: Record<string, string> = {};
        (template.section_type.required_inputs || []).forEach((input: string) => {
            initialInputs[input] = '';
        });
        setInputs(initialInputs);
    };

    const handleConfirm = () => {
        if (!selectedType) return;

        // Validate required inputs
        const missing = (selectedType.required_inputs || []).filter(
            input => !inputs[input]?.trim()
        );

        if (missing.length > 0) {
            toast.error(`Please fill in: ${missing.join(', ')}`);
            return;
        }

        const content = selectedTemplate ? selectedTemplate.content : undefined;
        onSelect(selectedType, inputs, content);
    };

    const handleCreateWithAI = () => {
        if (!selectedType) return;
        setShowChatAssistant(true);
    };

    const handleContentReady = (content: string) => {
        if (!selectedType) return;
        // Create section with pre-generated content
        onSelect(selectedType, inputs, content);
    };

    const filteredTypes = sectionTypes.filter(type =>
        type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredTemplates = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatInputLabel = (input: string) => {
        return input.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    // Check if a section type is a single-instance type that already exists
    const isSectionDisabled = (type: RFPSectionType) => {
        const singleInstanceTypes = ['qa_questionnaire'];
        return singleInstanceTypes.includes(type.slug) && existingSectionSlugs.includes(type.slug);
    };

    // If chat assistant is shown, render it
    if (showChatAssistant && selectedType) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
                    <SectionChatAssistant
                        sectionType={selectedType}
                        projectId={projectId}
                        onContentReady={handleContentReady}
                        onClose={() => setShowChatAssistant(false)}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-text-primary">
                        {selectedType ? 'Configure Section' : 'Add Section'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-background transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5 text-text-secondary" />
                    </button>
                </div>

                {/* Tabs (only when selecting check type) */}
                {!selectedType && (
                    <div className="flex border-b border-border">
                        <button
                            onClick={() => setActiveTab('types')}
                            className={clsx(
                                'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
                                activeTab === 'types'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-secondary hover:text-text-primary'
                            )}
                        >
                            Section Types
                        </button>
                        <button
                            onClick={() => setActiveTab('templates')}
                            className={clsx(
                                'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
                                activeTab === 'templates'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-secondary hover:text-text-primary'
                            )}
                        >
                            My Templates
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {!selectedType ? (
                        <>
                            {/* Search */}
                            <div className="relative mb-4">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                                <input
                                    type="text"
                                    placeholder={activeTab === 'types' ? "Search section types..." : "Search templates..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            {/* Grid */}
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {activeTab === 'types' ? (
                                        filteredTypes.map((type) => {
                                            const isDisabled = isSectionDisabled(type);
                                            return (
                                                <button
                                                    key={type.id}
                                                    onClick={() => handleSelectType(type)}
                                                    disabled={isDisabled}
                                                    className={clsx(
                                                        'p-4 rounded-lg border transition-all text-left group relative',
                                                        isDisabled
                                                            ? 'border-border bg-gray-50 opacity-60 cursor-not-allowed'
                                                            : 'border-border hover:border-primary hover:bg-primary-light'
                                                    )}
                                                >
                                                    {isDisabled && (
                                                        <div className="absolute top-2 right-2">
                                                            <CheckCircleIcon className="h-5 w-5 text-success" />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="text-2xl">{type.icon}</span>
                                                        <span className={clsx(
                                                            'font-medium',
                                                            isDisabled ? 'text-text-muted' : 'text-text-primary group-hover:text-primary'
                                                        )}>
                                                            {type.name}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-text-muted line-clamp-2">
                                                        {isDisabled ? 'Already added to proposal' : type.description}
                                                    </p>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        filteredTemplates.length > 0 ? (
                                            filteredTemplates.map((template) => {
                                                const isDisabled = template.section_type && isSectionDisabled(template.section_type);
                                                return (
                                                    <button
                                                        key={template.id}
                                                        onClick={() => handleSelectTemplate(template)}
                                                        disabled={isDisabled}
                                                        className={clsx(
                                                            'p-4 rounded-lg border transition-all text-left group relative',
                                                            isDisabled
                                                                ? 'border-border bg-gray-50 opacity-60 cursor-not-allowed'
                                                                : 'border-border hover:border-primary hover:bg-primary-light'
                                                        )}
                                                    >
                                                        {isDisabled && (
                                                            <div className="absolute top-2 right-2">
                                                                <CheckCircleIcon className="h-5 w-5 text-success" />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="text-2xl">
                                                                {template.section_type?.icon || '📄'}
                                                            </span>
                                                            <span className={clsx(
                                                                'font-medium',
                                                                isDisabled ? 'text-text-muted' : 'text-text-primary group-hover:text-primary'
                                                            )}>
                                                                {template.name}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-text-muted line-clamp-2 mb-2">
                                                            {template.description}
                                                        </p>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                                            {template.section_type?.name || 'Unknown Type'}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-2 text-center py-8 text-text-muted">
                                                <DocumentPlusIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                                <p>No templates found.</p>
                                                <p className="text-xs mt-1">Create templates in Templates Manager.</p>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Selected Type Header */}
                            <div className="flex items-center gap-3 mb-6 p-4 rounded-lg bg-background">
                                <span className="text-3xl">{selectedType.icon}</span>
                                <div>
                                    <h3 className="font-medium text-text-primary flex items-center gap-2">
                                        {selectedType.name}
                                        {selectedTemplate && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-normal">
                                                Using Template: {selectedTemplate.name}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-text-secondary">
                                        {selectedTemplate ? selectedTemplate.description : selectedType.description}
                                    </p>
                                </div>
                            </div>

                            {/* Required Inputs Form */}
                            {selectedType.required_inputs && selectedType.required_inputs.length > 0 ? (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-text-secondary">
                                        Required Information
                                    </h4>
                                    {selectedType.required_inputs.map((input) => (
                                        <div key={input}>
                                            <label className="block text-sm font-medium text-text-primary mb-1">
                                                {formatInputLabel(input)} *
                                            </label>
                                            <textarea
                                                value={inputs[input] || ''}
                                                onChange={(e) => setInputs({
                                                    ...inputs,
                                                    [input]: e.target.value,
                                                })}
                                                placeholder={`Enter ${formatInputLabel(input).toLowerCase()}...`}
                                                rows={3}
                                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-text-muted mb-2">No additional information needed.</p>
                                    <p className="text-sm text-text-muted">
                                        {selectedTemplate
                                            ? "This section will be created with the template content."
                                            : "Choose how to create this section:"}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-border">
                    {selectedType ? (
                        <>
                            <button
                                onClick={() => {
                                    setSelectedType(null);
                                    setSelectedTemplate(null);
                                }}
                                className="btn-secondary"
                            >
                                Back
                            </button>
                            <div className="flex gap-2">
                                {selectedTemplate ? (
                                    <button
                                        onClick={handleConfirm}
                                        className="btn-primary flex items-center gap-2"
                                    >
                                        <DocumentPlusIcon className="h-4 w-4" />
                                        Create from Template
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleConfirm}
                                            className="btn-secondary flex items-center gap-2"
                                        >
                                            <DocumentPlusIcon className="h-4 w-4" />
                                            Create Empty
                                        </button>
                                        <button
                                            onClick={handleCreateWithAI}
                                            className="btn-primary flex items-center gap-2"
                                        >
                                            <SparklesIcon className="h-4 w-4" />
                                            Configure with AI
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-sm text-text-muted">
                                {activeTab === 'types'
                                    ? `${filteredTypes.length} types available`
                                    : `${filteredTemplates.length} templates available`}
                            </span>
                            <button onClick={onClose} className="btn-secondary">
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
