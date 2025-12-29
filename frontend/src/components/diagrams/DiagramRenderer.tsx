import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import {
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    ArrowDownTrayIcon,
    DocumentDuplicateIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface DiagramRendererProps {
    code: string;
    title?: string;
    description?: string;
    className?: string;
    showControls?: boolean;
    compact?: boolean;
}

// Initialize mermaid with dark mode support
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif',
    flowchart: {
        htmlLabels: true,
        curve: 'basis',
    },
    sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
    },
    gantt: {
        titleTopMargin: 25,
        barHeight: 20,
        barGap: 4,
    },
});

export default function DiagramRenderer({
    code,
    title,
    description,
    className,
    showControls = true,
    compact = false,
}: DiagramRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoom, setZoom] = useState(1);

    // Clean mermaid code - handle various formatting issues
    const cleanMermaidCode = useCallback((rawCode: string): string => {
        if (!rawCode) return '';

        let cleaned = rawCode;

        // Convert escaped newlines to actual newlines
        cleaned = cleaned.replace(/\\n/g, '\n');
        cleaned = cleaned.replace(/\\\\n/g, '\n');

        // Remove markdown code fences if present
        cleaned = cleaned.replace(/^```mermaid\n?/i, '');
        cleaned = cleaned.replace(/^```\n?/i, '');
        cleaned = cleaned.replace(/\n?```$/i, '');

        // Replace Unicode arrows with Mermaid-compatible arrows
        cleaned = cleaned.replace(/→/g, '-->');
        cleaned = cleaned.replace(/←/g, '<--');
        cleaned = cleaned.replace(/↔/g, '<-->');
        cleaned = cleaned.replace(/➡/g, '-->');
        cleaned = cleaned.replace(/⬅/g, '<--');
        cleaned = cleaned.replace(/⇒/g, '-->');
        cleaned = cleaned.replace(/⇐/g, '<--');

        // Remove other problematic non-ASCII characters
        cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, '');

        // Fix malformed arrows that result from unicode removal
        // <- > or < -> should become <-->
        cleaned = cleaned.replace(/<-\s*>/g, '<-->');
        cleaned = cleaned.replace(/<\s*->/g, '<-->');
        cleaned = cleaned.replace(/<-\s+->/g, '<-->');
        // - > should become -->
        cleaned = cleaned.replace(/-\s+>/g, '-->');
        // < - should become <--
        cleaned = cleaned.replace(/<\s+-/g, '<--');
        // Fix any remaining weird arrow patterns
        cleaned = cleaned.replace(/--\s+>/g, '-->');
        cleaned = cleaned.replace(/<\s+--/g, '<--');
        // Fix patterns like "> D B" that result from mangled arrows
        cleaned = cleaned.replace(/>\s+([A-Z])/g, '> $1');

        // Fix colon-based labels (invalid syntax: "A --> B: label" should be "A -->|label| B")
        cleaned = cleaned.replace(/(\S+)\s*(-->|<--|---)\s*(\S+):\s*([^\n]+)/g,
            (_match, nodeA, arrow, nodeB, label) => {
                // Clean the label
                const cleanLabel = label.replace(/[^\w\s]/g, '').substring(0, 30).trim();
                return `${nodeA} ${arrow}|${cleanLabel}| ${nodeB}`;
            }
        );

        // Fix malformed connection lines with multiple arrows
        // e.g., "A --> B --> C" should become "A --> B" and "B --> C"
        const lines = cleaned.split('\n');
        const fixedLines: string[] = [];

        for (const line of lines) {
            const stripped = line.trim();

            // Skip empty lines, comments, or keywords
            if (!stripped || stripped.startsWith('%') || stripped.startsWith('flowchart') ||
                stripped.startsWith('graph') || stripped.startsWith('subgraph') || stripped === 'end') {
                fixedLines.push(line);
                continue;
            }

            // Count arrows in the line
            const arrowCount = (stripped.match(/-->/g) || []).length +
                (stripped.match(/<--/g) || []).length +
                (stripped.match(/---/g) || []).length;

            if (arrowCount > 1) {
                // Multiple arrows - try to fix by splitting into valid connections
                const parts = stripped.split(/(-->|<--|---)/);
                if (parts.length >= 3) {
                    let currentNode = parts[0].trim();
                    for (let i = 1; i < parts.length; i += 2) {
                        if (i + 1 < parts.length) {
                            const arrow = parts[i];
                            const nextNode = parts[i + 1].trim();
                            // Only add valid looking nodes
                            if (currentNode && nextNode && currentNode.length < 50 && nextNode.length < 50) {
                                fixedLines.push(`    ${currentNode} ${arrow} ${nextNode}`);
                            }
                            currentNode = nextNode;
                        }
                    }
                }
                // Skip original line if we processed it
            } else {
                fixedLines.push(line);
            }
        }

        cleaned = fixedLines.join('\n');

        // Clean node labels - this is the key fix for "NODE_STRING" errors
        // Clean labels inside square brackets [label]
        cleaned = cleaned.replace(/\[([^\]]+)\]/g, (_match, label) => {
            let cleanLabel = label;
            // Remove parentheses and their content
            cleanLabel = cleanLabel.replace(/\([^)]*\)/g, '');
            // Replace colons with dashes (except in URLs)
            if (!cleanLabel.toLowerCase().includes('http')) {
                cleanLabel = cleanLabel.replace(/:/g, ' -');
            }
            // Remove quotes
            cleanLabel = cleanLabel.replace(/["']/g, '');
            // Replace ampersands
            cleanLabel = cleanLabel.replace(/&/g, 'and');
            // Limit length
            cleanLabel = cleanLabel.trim();
            if (cleanLabel.length > 30) {
                cleanLabel = cleanLabel.substring(0, 27) + '...';
            }
            // Clean up multiple spaces
            cleanLabel = cleanLabel.replace(/\s+/g, ' ');
            return `[${cleanLabel || 'Node'}]`;
        });

        // Clean labels inside curly brackets {label}
        cleaned = cleaned.replace(/\{([^}]+)\}/g, (_match, label) => {
            let cleanLabel = label;
            cleanLabel = cleanLabel.replace(/\([^)]*\)/g, '');
            if (!cleanLabel.toLowerCase().includes('http')) {
                cleanLabel = cleanLabel.replace(/:/g, ' -');
            }
            cleanLabel = cleanLabel.replace(/["']/g, '');
            cleanLabel = cleanLabel.replace(/&/g, 'and');
            cleanLabel = cleanLabel.trim();
            if (cleanLabel.length > 30) {
                cleanLabel = cleanLabel.substring(0, 27) + '...';
            }
            cleanLabel = cleanLabel.replace(/\s+/g, ' ');
            return `{${cleanLabel || 'Decision'}}`;
        });

        // Fix colon issues in arrow labels (e.g., "A --> B : Label" should be "A -->|Label| B")
        cleaned = cleaned.replace(/ : /g, ' ');

        // Clean up multiple spaces
        cleaned = cleaned.replace(/  +/g, ' ');

        // Remove empty lines
        cleaned = cleaned
            .split('\n')
            .filter(line => line.trim().length > 0)
            .join('\n');

        // Trim whitespace
        cleaned = cleaned.trim();

        console.log('Cleaned mermaid code:', cleaned.substring(0, 200));

        return cleaned;
    }, []);

    // Render mermaid diagram
    const renderDiagram = useCallback(async () => {
        if (!code) {
            setError('No diagram code provided');
            return;
        }

        try {
            setError(null);
            setSvgContent(''); // Reset while loading

            // Clean the code first
            const cleanedCode = cleanMermaidCode(code);

            if (!cleanedCode) {
                setError('Empty diagram code after cleaning');
                return;
            }

            console.log('Rendering mermaid diagram:', cleanedCode.substring(0, 100) + '...');

            // Generate unique ID for diagram
            const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Render mermaid diagram
            const { svg } = await mermaid.render(id, cleanedCode);
            setSvgContent(svg);
        } catch (err) {
            console.error('Mermaid render error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
            setError(errorMessage);

            // Try to show the raw code for debugging
            console.error('Failed code was:', code);
        }
    }, [code, cleanMermaidCode]);

    useEffect(() => {
        // Add a small delay to ensure mermaid is fully initialized
        const timer = setTimeout(() => {
            renderDiagram();
        }, 100);

        return () => clearTimeout(timer);
    }, [renderDiagram]);

    // Copy diagram code to clipboard
    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            toast.success('Diagram code copied to clipboard');
        } catch {
            toast.error('Failed to copy code');
        }
    };

    // Export as SVG
    const handleExportSVG = () => {
        if (!svgContent) return;

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title?.replace(/\s+/g, '_') || 'diagram'}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('SVG exported');
    };

    // Export as PNG
    const handleExportPNG = async () => {
        if (!svgContent) return;

        try {
            const svgElement = new DOMParser().parseFromString(svgContent, 'image/svg+xml').documentElement;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const svgData = new XMLSerializer().serializeToString(svgElement);
            const img = new Image();
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            img.onload = () => {
                canvas.width = img.width * 2;
                canvas.height = img.height * 2;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const pngUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = pngUrl;
                link.download = `${title?.replace(/\s+/g, '_') || 'diagram'}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.success('PNG exported');
            };

            img.src = url;
        } catch {
            toast.error('Failed to export PNG');
        }
    };

    // Toggle fullscreen
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        setZoom(1);
    };

    // Zoom controls
    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
    const handleZoomReset = () => setZoom(1);

    if (error) {
        return (
            <div className={clsx(
                'rounded-lg border border-red-200 bg-red-50 p-6',
                className
            )}>
                <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-800">Diagram Render Error</h3>
                        <p className="mt-1 text-sm text-red-600">{error}</p>
                        <details className="mt-3">
                            <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                                Show diagram code
                            </summary>
                            <pre className="mt-2 p-3 bg-red-100 rounded text-xs overflow-auto max-h-40">
                                {code}
                            </pre>
                        </details>
                    </div>
                </div>
            </div>
        );
    }

    const diagramContent = (
        <div
            ref={containerRef}
            className="diagram-content overflow-auto"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );

    return (
        <>
            <div className={clsx(
                'rounded-lg border border-gray-200 bg-white shadow-sm',
                compact && 'border-none shadow-none',
                className
            )}>
                {/* Header */}
                {!compact && (title || showControls) && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div>
                            {title && (
                                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                            )}
                            {description && (
                                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                            )}
                        </div>

                        {showControls && (
                            <div className="flex items-center gap-1">
                                {/* Zoom controls */}
                                <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-gray-50 rounded-md">
                                    <button
                                        onClick={handleZoomOut}
                                        className="p-1 text-gray-500 hover:text-gray-700"
                                        title="Zoom out"
                                    >
                                        <span className="text-sm font-medium">−</span>
                                    </button>
                                    <button
                                        onClick={handleZoomReset}
                                        className="px-2 text-xs text-gray-600 hover:text-gray-800"
                                    >
                                        {Math.round(zoom * 100)}%
                                    </button>
                                    <button
                                        onClick={handleZoomIn}
                                        className="p-1 text-gray-500 hover:text-gray-700"
                                        title="Zoom in"
                                    >
                                        <span className="text-sm font-medium">+</span>
                                    </button>
                                </div>

                                <button
                                    onClick={handleCopyCode}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                                    title="Copy Mermaid code"
                                >
                                    <DocumentDuplicateIcon className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={handleExportSVG}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                                    title="Export as SVG"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={handleExportPNG}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                                    title="Export as PNG"
                                >
                                    <span className="text-xs font-medium">PNG</span>
                                </button>
                                <button
                                    onClick={toggleFullscreen}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                                    title="Fullscreen"
                                >
                                    <ArrowsPointingOutIcon className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Diagram */}
                <div className={clsx(
                    'p-4 overflow-auto',
                    compact ? 'min-h-[150px] max-h-[300px]' : 'min-h-[200px] max-h-[500px]'
                )}>
                    {svgContent ? diagramContent : (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Fullscreen Modal */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
                    <div className="relative w-full h-full bg-white rounded-xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                {title && (
                                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                                )}
                                {description && (
                                    <p className="text-sm text-gray-500">{description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 mr-4 px-3 py-1.5 bg-gray-100 rounded-lg">
                                    <button onClick={handleZoomOut} className="p-1 text-gray-600 hover:text-gray-800">−</button>
                                    <span className="px-2 text-sm text-gray-700">{Math.round(zoom * 100)}%</span>
                                    <button onClick={handleZoomIn} className="p-1 text-gray-600 hover:text-gray-800">+</button>
                                </div>
                                <button
                                    onClick={handleExportSVG}
                                    className="btn-secondary text-sm"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    SVG
                                </button>
                                <button
                                    onClick={handleExportPNG}
                                    className="btn-secondary text-sm"
                                >
                                    PNG
                                </button>
                                <button
                                    onClick={toggleFullscreen}
                                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                                >
                                    <ArrowsPointingInIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-8 bg-gray-50">
                            <div
                                className="inline-block min-w-full"
                                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                                dangerouslySetInnerHTML={{ __html: svgContent }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
