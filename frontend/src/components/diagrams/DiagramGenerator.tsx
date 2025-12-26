import { useState, useEffect } from 'react';
import {
    CubeIcon,
    ArrowPathIcon,
    ArrowsRightLeftIcon,
    CalendarIcon,
    CircleStackIcon,
    SparklesIcon,
    PlusIcon,
    TrashIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import DiagramRenderer from './DiagramRenderer';
import { diagramsApi } from '@/api/client';

interface DiagramType {
    id: string;
    name: string;
    description: string;
    mermaid_type: string;
    icon: string;
}

interface GeneratedDiagram {
    id?: string;
    diagram_type: string;
    title: string;
    description: string;
    mermaid_code: string;
    notes?: string;
    diagram_type_info?: DiagramType;
}

interface DiagramGeneratorProps {
    projectId: number;
    documentId?: number;
}

const DIAGRAM_ICONS: Record<string, typeof CubeIcon> = {
    CubeIcon,
    ArrowPathIcon,
    ArrowsRightLeftIcon,
    CalendarIcon,
    CircleStackIcon,
    SparklesIcon,
};

export default function DiagramGenerator({ projectId, documentId }: DiagramGeneratorProps) {
    const [diagramTypes, setDiagramTypes] = useState<DiagramType[]>([]);
    const [selectedType, setSelectedType] = useState<string>('architecture');
    const [diagrams, setDiagrams] = useState<GeneratedDiagram[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load available diagram types
    useEffect(() => {
        const loadDiagramTypes = async () => {
            try {
                const response = await diagramsApi.getDiagramTypes();
                setDiagramTypes(response.data.diagram_types || []);
            } catch (err) {
                console.error('Failed to load diagram types:', err);
                // Fallback to default types
                setDiagramTypes([
                    { id: 'architecture', name: 'Architecture Diagram', description: 'System components and relationships', mermaid_type: 'flowchart TB', icon: 'CubeIcon' },
                    { id: 'flowchart', name: 'Business Process', description: 'Process flows and decision points', mermaid_type: 'flowchart LR', icon: 'ArrowPathIcon' },
                    { id: 'sequence', name: 'Sequence Diagram', description: 'System interactions', mermaid_type: 'sequenceDiagram', icon: 'ArrowsRightLeftIcon' },
                    { id: 'timeline', name: 'Timeline / Gantt', description: 'Project milestones', mermaid_type: 'gantt', icon: 'CalendarIcon' },
                    { id: 'er', name: 'ER Diagram', description: 'Data entities', mermaid_type: 'erDiagram', icon: 'CircleStackIcon' },
                    { id: 'mindmap', name: 'Mind Map', description: 'Topic overview', mermaid_type: 'mindmap', icon: 'SparklesIcon' },
                ]);
            } finally {
                setIsLoadingTypes(false);
            }
        };

        loadDiagramTypes();
    }, []);

    // Generate diagram
    const handleGenerateDiagram = async () => {
        if (!documentId) {
            toast.error('No document selected for diagram generation');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await diagramsApi.generateDiagram(documentId, selectedType);

            if (response.data.success && response.data.diagram) {
                const newDiagram: GeneratedDiagram = {
                    id: `diagram-${Date.now()}`,
                    ...response.data.diagram,
                };
                setDiagrams(prev => [...prev, newDiagram]);
                toast.success(`${response.data.diagram.title || 'Diagram'} generated!`);
            } else {
                throw new Error(response.data.error || 'Failed to generate diagram');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate diagram';
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    // Generate all diagrams
    const handleGenerateAll = async () => {
        if (!documentId) {
            toast.error('No document selected for diagram generation');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await diagramsApi.generateAllDiagrams(documentId, ['architecture', 'flowchart', 'timeline']);

            if (response.data.success && response.data.diagrams) {
                const newDiagrams = response.data.diagrams.map((d: GeneratedDiagram, i: number) => ({
                    id: `diagram-${Date.now()}-${i}`,
                    ...d,
                }));
                setDiagrams(prev => [...prev, ...newDiagrams]);
                toast.success(`Generated ${response.data.diagrams.length} diagrams!`);
            } else {
                throw new Error(response.data.error || 'Failed to generate diagrams');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate diagrams';
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    // Remove diagram
    const handleRemoveDiagram = (diagramId: string) => {
        setDiagrams(prev => prev.filter(d => d.id !== diagramId));
        toast.success('Diagram removed');
    };

    const getIcon = (iconName: string) => {
        return DIAGRAM_ICONS[iconName] || CubeIcon;
    };

    if (isLoadingTypes) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 bg-gray-50 overflow-auto">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">AI Diagram Generator</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Generate architecture diagrams, flowcharts, and more from your RFP document
                </p>
            </div>

            {/* Diagram Type Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Select Diagram Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {diagramTypes.map((type) => {
                        const IconComponent = getIcon(type.icon);
                        return (
                            <button
                                key={type.id}
                                onClick={() => setSelectedType(type.id)}
                                className={clsx(
                                    'flex flex-col items-center p-3 rounded-lg border-2 transition-all',
                                    selectedType === type.id
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                                )}
                            >
                                <IconComponent className="h-6 w-6 mb-2" />
                                <span className="text-xs font-medium text-center">{type.name}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Generate Buttons */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                    <button
                        onClick={handleGenerateDiagram}
                        disabled={isLoading || !documentId}
                        className="btn-primary flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Generating...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="h-4 w-4" />
                                Generate {diagramTypes.find(t => t.id === selectedType)?.name || 'Diagram'}
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleGenerateAll}
                        disabled={isLoading || !documentId}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Generate All (3 types)
                    </button>

                    {!documentId && (
                        <span className="text-sm text-amber-600">
                            ⚠️ Upload an RFP document first
                        </span>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Generation Error</p>
                        <p className="text-sm text-red-600 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {/* Generated Diagrams */}
            {diagrams.length > 0 ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-700">
                            Generated Diagrams ({diagrams.length})
                        </h3>
                    </div>

                    <div className="grid gap-6">
                        {diagrams.map((diagram) => (
                            <div key={diagram.id} className="relative group">
                                <button
                                    onClick={() => diagram.id && handleRemoveDiagram(diagram.id)}
                                    className="absolute top-2 right-2 z-10 p-2 bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remove diagram"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                                <DiagramRenderer
                                    code={diagram.mermaid_code}
                                    title={diagram.title}
                                    description={diagram.description}
                                />
                                {diagram.notes && (
                                    <p className="mt-2 text-xs text-gray-500 italic px-4">
                                        📝 {diagram.notes}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <CubeIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No diagrams yet</h3>
                    <p className="text-sm text-gray-500 max-w-md">
                        Select a diagram type above and click "Generate" to create AI-powered visualizations from your RFP document.
                    </p>
                </div>
            )}
        </div>
    );
}
