import { useState, useEffect } from 'react';
import { sectionsApi } from '@/api/client';
import MermaidDiagram from '@/components/common/MermaidDiagram';
import toast from 'react-hot-toast';
import {
    SparklesIcon,
    ArrowPathIcon,
    CodeBracketIcon,
    EyeIcon,
    PencilIcon,
} from '@heroicons/react/24/outline';

interface DiagramType {
    type: string;
    name: string;
    description: string;
}

interface DiagramEditorProps {
    sectionId: number;
    content: string;
    onContentChange: (content: string) => void;
}

export default function DiagramEditor({
    sectionId,
    content,
    onContentChange,
}: DiagramEditorProps) {
    const [diagramTypes, setDiagramTypes] = useState<DiagramType[]>([]);
    const [selectedType, setSelectedType] = useState('architecture');
    const [mermaidCode, setMermaidCode] = useState(content || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showCode, setShowCode] = useState(false);
    const [context, setContext] = useState('');
    const [additionalInstructions, setAdditionalInstructions] = useState('');
    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);

    // Load diagram types on mount
    useEffect(() => {
        const loadDiagramTypes = async () => {
            try {
                const response = await sectionsApi.getDiagramTypes();
                setDiagramTypes(response.data.diagram_types || []);
            } catch (error) {
                console.error('Failed to load diagram types:', error);
                // Use default types if API fails
                setDiagramTypes([
                    { type: 'architecture', name: 'Architecture Diagram', description: 'System architecture' },
                    { type: 'org_chart', name: 'Organization Chart', description: 'Team structure' },
                    { type: 'flowchart', name: 'Flowchart', description: 'Process flow' },
                    { type: 'sequence', name: 'Sequence Diagram', description: 'Interaction sequence' },
                    { type: 'erd', name: 'ERD', description: 'Database schema' },
                    { type: 'gantt', name: 'Gantt Chart', description: 'Project timeline' },
                ]);
            }
        };
        loadDiagramTypes();
    }, []);

    // Parse existing content to extract mermaid code
    useEffect(() => {
        if (content) {
            // Check if content is wrapped in mermaid code block
            const match = content.match(/```mermaid\n([\s\S]*?)```/);
            if (match) {
                setMermaidCode(match[1].trim());
            } else {
                setMermaidCode(content);
            }
        }
    }, [content]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const response = await sectionsApi.generateDiagram(sectionId, {
                diagram_type: selectedType,
                context: context || undefined,
                additional_instructions: additionalInstructions || undefined,
            });

            if (response.data.mermaid_code) {
                setMermaidCode(response.data.mermaid_code);
                // Store as markdown code block for proper rendering
                onContentChange(`\`\`\`mermaid\n${response.data.mermaid_code}\n\`\`\``);
                toast.success('Diagram generated!');
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to generate diagram');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRegenerate = async () => {
        if (!feedback.trim()) {
            toast.error('Please provide feedback for regeneration');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await sectionsApi.regenerateDiagram({
                mermaid_code: mermaidCode,
                diagram_type: selectedType,
                feedback: feedback,
            });

            if (response.data.mermaid_code) {
                setMermaidCode(response.data.mermaid_code);
                onContentChange(`\`\`\`mermaid\n${response.data.mermaid_code}\n\`\`\``);
                toast.success('Diagram regenerated!');
                setFeedback('');
                setShowFeedback(false);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to regenerate diagram');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCodeChange = (newCode: string) => {
        setMermaidCode(newCode);
        onContentChange(`\`\`\`mermaid\n${newCode}\n\`\`\``);
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {/* Diagram Type Selector */}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 font-medium">Type:</label>
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {diagramTypes.map((type) => (
                            <option key={type.type} value={type.type}>
                                {type.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex-1" />

                {/* Toggle Code/Preview */}
                <button
                    onClick={() => setShowCode(!showCode)}
                    className="btn-secondary text-sm flex items-center gap-1.5"
                >
                    {showCode ? (
                        <>
                            <EyeIcon className="h-4 w-4" />
                            Preview
                        </>
                    ) : (
                        <>
                            <CodeBracketIcon className="h-4 w-4" />
                            Edit Code
                        </>
                    )}
                </button>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="btn-primary text-sm flex items-center gap-1.5"
                >
                    {isGenerating ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                        <SparklesIcon className="h-4 w-4" />
                    )}
                    {mermaidCode ? 'Regenerate' : 'Generate'} Diagram
                </button>
            </div>

            {/* Context Input (collapsed by default) */}
            <details className="group">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-primary flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform">▶</span>
                    AI Context & Instructions
                </summary>
                <div className="mt-2 space-y-3 p-3 bg-gray-50 rounded-lg">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Context (describe what this diagram should show)
                        </label>
                        <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="E.g., A microservices architecture with API gateway, 3 backend services, and PostgreSQL database..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Additional Instructions
                        </label>
                        <input
                            type="text"
                            value={additionalInstructions}
                            onChange={(e) => setAdditionalInstructions(e.target.value)}
                            placeholder="E.g., Use subgraphs to group related components, highlight security layer..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>
            </details>

            {/* Main Content Area */}
            <div className="min-h-[300px] border border-gray-200 rounded-lg overflow-hidden">
                {showCode ? (
                    /* Code Editor */
                    <div className="h-full">
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b">
                            <span className="text-sm text-gray-600 font-medium">Mermaid Code</span>
                        </div>
                        <textarea
                            value={mermaidCode}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            placeholder={`Enter Mermaid code here...

Example:
graph TB
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D`}
                            className="w-full h-[300px] p-4 font-mono text-sm focus:outline-none resize-none"
                        />
                    </div>
                ) : (
                    /* Diagram Preview */
                    <div className="p-4 bg-white min-h-[300px]">
                        {mermaidCode ? (
                            <MermaidDiagram code={mermaidCode} className="max-w-full" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
                                <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                                </svg>
                                <p className="text-lg font-medium mb-2">No Diagram Yet</p>
                                <p className="text-sm">Click "Generate Diagram" to create one</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Regenerate with Feedback */}
            {mermaidCode && (
                <div className="space-y-2">
                    {!showFeedback ? (
                        <button
                            onClick={() => setShowFeedback(true)}
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                            <PencilIcon className="h-4 w-4" />
                            Modify diagram with feedback
                        </button>
                    ) : (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <label className="block text-sm font-medium text-blue-800 mb-2">
                                What changes would you like?
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    placeholder="E.g., Add a cache layer between API and database, use horizontal layout..."
                                    className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRegenerate()}
                                />
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isGenerating || !feedback.trim()}
                                    className="btn-primary text-sm flex items-center gap-1.5"
                                >
                                    {isGenerating ? (
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <SparklesIcon className="h-4 w-4" />
                                    )}
                                    Apply
                                </button>
                                <button
                                    onClick={() => {
                                        setShowFeedback(false);
                                        setFeedback('');
                                    }}
                                    className="btn-secondary text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
