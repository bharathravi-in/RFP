import React, { useState, useEffect } from 'react';
import {
    CheckIcon,
    XMarkIcon,
    ArrowsPointingOutIcon,
    DocumentDuplicateIcon,
    SparklesIcon,
    TableCellsIcon
} from '@heroicons/react/24/outline';
import DiagramRenderer from '../diagrams/DiagramRenderer';
import { agentsApi } from '@/api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface DiagramEditorProps {
    projectId: number;
    content: string;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    isSaving?: boolean;
    color?: string;
}

export const DiagramEditor: React.FC<DiagramEditorProps> = ({
    projectId,
    content: initialContent,
    onSave,
    onCancel,
    isSaving = false,
    color = '#6366F1',
}) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [mermaidCode, setMermaidCode] = useState('');
    const [notes, setNotes] = useState('');
    const [savedDiagrams, setSavedDiagrams] = useState<any[]>([]);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [viewMode, setViewMode] = useState<'editor' | 'selector'>('editor');

    useEffect(() => {
        try {
            const parsed = JSON.parse(initialContent || '{}');
            setTitle(parsed.title || '');
            setDescription(parsed.description || '');
            setMermaidCode(parsed.mermaid_code || parsed.code || '');
            setNotes(parsed.notes || '');
        } catch (e) {
            setMermaidCode(initialContent || '');
        }
    }, [initialContent]);

    const loadSavedDiagrams = async () => {
        setIsLoadingSaved(true);
        try {
            const response = await agentsApi.getProjectStrategy(projectId);
            if (response.data.success && response.data.strategy?.diagrams) {
                setSavedDiagrams(response.data.strategy.diagrams);
            }
        } catch (err) {
            console.error('Failed to load saved diagrams:', err);
            toast.error('Failed to load saved diagrams');
        } finally {
            setIsLoadingSaved(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'selector') {
            loadSavedDiagrams();
        }
    }, [viewMode]);

    const handleSave = async () => {
        const data = {
            type: 'diagram',
            title,
            description,
            mermaid_code: mermaidCode,
            notes,
        };
        await onSave(data);
    };

    const handleSelectDiagram = (diagram: any) => {
        setTitle(diagram.title || '');
        setDescription(diagram.description || '');
        setMermaidCode(diagram.mermaid_code || '');
        setNotes(diagram.notes || '');
        setViewMode('editor');
        toast.success('Diagram selected');
    };

    return (
        <div className="w-full bg-background rounded-lg shadow border border-border h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-border px-6 py-4 flex items-center justify-between" style={{ borderLeftWidth: '4px', borderLeftColor: color }}>
                <div>
                    <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                        <ArrowsPointingOutIcon className="h-5 w-5" />
                        Architecture Diagram Editor
                    </h2>
                    <p className="text-sm text-text-muted mt-1">
                        Visualize system architecture using Mermaid.js
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode(viewMode === 'editor' ? 'selector' : 'editor')}
                        className={clsx(
                            "btn-secondary text-sm",
                            viewMode === 'selector' && "bg-primary/10 text-primary border-primary"
                        )}
                    >
                        <TableCellsIcon className="h-4 w-4" />
                        {viewMode === 'editor' ? 'Import from Library' : 'Back to Editor'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {viewMode === 'editor' ? (
                    <>
                        {/* Editor Side */}
                        <div className="w-1/2 p-6 border-r border-border overflow-auto space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">Diagram Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., System Architecture Overview"
                                    className="w-full p-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-text-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">Short Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Briefly explain what this diagram shows..."
                                    rows={2}
                                    className="w-full p-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-text-primary resize-none"
                                />
                            </div>
                            <div className="flex-1 flex flex-col">
                                <label className="block text-sm font-medium text-text-primary mb-1">Mermaid Code</label>
                                <textarea
                                    value={mermaidCode}
                                    onChange={(e) => setMermaidCode(e.target.value)}
                                    placeholder="graph TD\n  A[Start] --> B(Process)"
                                    className="w-full flex-1 p-3 border border-border rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-background text-text-primary resize-none min-h-[300px]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">Technical Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any technical details or rationale..."
                                    rows={2}
                                    className="w-full p-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-text-primary resize-none"
                                />
                            </div>
                        </div>

                        {/* Preview Side */}
                        <div className="w-1/2 p-6 bg-gray-50 overflow-auto flex flex-col">
                            <h3 className="text-sm font-medium text-gray-700 mb-4">Live Preview</h3>
                            {mermaidCode.trim() ? (
                                <DiagramRenderer
                                    code={mermaidCode}
                                    title={title}
                                    description={description}
                                    showControls={false}
                                    className="bg-white border border-gray-200"
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                    <SparklesIcon className="h-12 w-12 mb-2 opacity-20" />
                                    <p>Enter Mermaid code to see preview</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Library/Selector Side */
                    <div className="flex-1 p-6 overflow-auto">
                        <h3 className="text-sm font-medium text-text-primary mb-4">Project Diagram Library</h3>
                        {isLoadingSaved ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : savedDiagrams.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {savedDiagrams.map((diagram, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 bg-white border border-border rounded-lg hover:border-primary cursor-pointer transition-colors group relative"
                                        onClick={() => handleSelectDiagram(diagram)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-medium text-text-primary">{diagram.title || 'Untitled Diagram'}</h4>
                                            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded uppercase font-bold text-gray-500">
                                                {diagram.diagram_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-secondary line-clamp-2 mb-3">{diagram.description}</p>
                                        <div className="h-32 bg-gray-50 rounded overflow-hidden pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                                            <DiagramRenderer
                                                code={diagram.mermaid_code}
                                                compact={true}
                                                showControls={false}
                                            />
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 h-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-gray-500">No diagrams saved for this project yet.</p>
                                <p className="text-xs text-gray-400 mt-1">Generate some in the Diagrams tab first!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 bg-surface flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="btn-secondary"
                >
                    <XMarkIcon className="h-4 w-4" />
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving || !mermaidCode.trim()}
                    className="btn-primary"
                >
                    {isSaving ? (
                        <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Saving...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <CheckIcon className="h-4 w-4" />
                            Save Diagram
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default DiagramEditor;
