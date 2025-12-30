import { useState, useEffect } from 'react';
import { XMarkIcon, DocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { templatesApi } from '@/api/client';
import clsx from 'clsx';

interface Template {
    id: number;
    name: string;
    description?: string;
    type: string;
    preview_url?: string;
}

interface TemplateSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (templateId: number) => void;
    currentTemplateId?: number;
}

/**
 * Modal for selecting export templates.
 */
export default function TemplateSelector({
    isOpen,
    onClose,
    onSelect,
    currentTemplateId
}: TemplateSelectorProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(currentTemplateId || null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen]);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const response = await templatesApi.list();
            setTemplates(response.data.templates || []);
        } catch (error) {
            console.error('Failed to load templates:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        if (selectedId) {
            onSelect(selectedId);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
                onClick={onClose}
            >
                {/* Modal */}
                <div
                    className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Select Template</h2>
                            <p className="text-sm text-gray-500">Choose a template for your export</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                            <XMarkIcon className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full" />
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-12">
                                <DocumentIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No templates available</p>
                                <p className="text-sm text-gray-400">Upload templates in Settings → Templates</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => setSelectedId(template.id)}
                                        className={clsx(
                                            'relative p-4 border-2 rounded-xl text-left transition-all hover:shadow-md',
                                            selectedId === template.id
                                                ? 'border-primary bg-primary/5'
                                                : 'border-gray-200 hover:border-gray-300'
                                        )}
                                    >
                                        {/* Preview/Icon */}
                                        <div className="h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                                            {template.preview_url ? (
                                                <img
                                                    src={template.preview_url}
                                                    alt={template.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <DocumentIcon className="h-10 w-10 text-gray-400" />
                                            )}
                                        </div>

                                        <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
                                        {template.description && (
                                            <p className="text-sm text-gray-500 line-clamp-2">
                                                {template.description}
                                            </p>
                                        )}

                                        {/* Selected Indicator */}
                                        {selectedId === template.id && (
                                            <div className="absolute top-2 right-2 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                                                <CheckIcon className="h-4 w-4 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <button onClick={onClose} className="btn-secondary">
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedId}
                            className="btn-primary"
                        >
                            Use Template
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
