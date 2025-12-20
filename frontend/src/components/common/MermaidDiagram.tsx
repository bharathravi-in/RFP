import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
    code: string;
    className?: string;
    onError?: (error: string) => void;
}

// Initialize mermaid with dark/light theme support
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
    },
    themeVariables: {
        primaryColor: '#3B82F6',
        primaryTextColor: '#1F2937',
        primaryBorderColor: '#2563EB',
        lineColor: '#6B7280',
        secondaryColor: '#E5E7EB',
        tertiaryColor: '#F3F4F6',
    },
});

// Clean up any stray Mermaid error elements from DOM
const cleanupMermaidErrors = () => {
    // Mermaid creates error elements with specific patterns
    const errorElements = document.querySelectorAll('[id^="dmermaid-"], .mermaid-error, .error-icon, .error-text');
    errorElements.forEach(el => el.remove());

    // Also clean up any elements containing "syntax error" text
    const allElements = document.body.querySelectorAll('*');
    allElements.forEach(el => {
        if (el.textContent?.includes('Syntax error in text') ||
            el.textContent?.includes('ax error in text')) {
            if (el.parentElement && !el.closest('.mermaid-diagram')) {
                el.remove();
            }
        }
    });
};

export default function MermaidDiagram({ code, className = '', onError }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Check if code looks like valid Mermaid syntax
    const isValidMermaidCode = (codeToCheck: string): boolean => {
        if (!codeToCheck || codeToCheck.trim().length < 5) return false;
        const trimmed = codeToCheck.trim().toLowerCase();
        const validStarts = ['graph ', 'graph\n', 'flowchart ', 'flowchart\n', 'sequencediagram', 'erdiagram', 'gantt', 'pie', 'classdiagram', 'statediagram'];
        return validStarts.some(start => trimmed.startsWith(start));
    };

    useEffect(() => {
        // Clean up any stray errors from previous renders
        cleanupMermaidErrors();

        const renderDiagram = async () => {
            // Only check if code exists
            if (!code || code.trim().length === 0) {
                setSvg('');
                setError(null);
                return;
            }

            console.log('[MermaidDiagram] Attempting to render code:', code.substring(0, 100));

            // Quick validation - check if it looks like Mermaid code
            if (!isValidMermaidCode(code)) {
                console.log('[MermaidDiagram] Invalid code detected');
                setError('Content does not appear to be valid Mermaid code. Click "Regenerate Diagram" to generate a new diagram.');
                setSvg('');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                // Generate unique ID for this diagram
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Add timeout to prevent hanging
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Diagram rendering timed out')), 10000)
                );

                // Validate and render with timeout
                const renderPromise = mermaid.render(id, code);
                const { svg: renderedSvg } = await Promise.race([renderPromise, timeoutPromise]);

                console.log('[MermaidDiagram] Successfully rendered diagram');
                setSvg(renderedSvg);
                setError(null);
                setIsLoading(false);

                // Clean up after successful render
                cleanupMermaidErrors();
            } catch (err: any) {
                console.error('[MermaidDiagram] Render error:', err);
                const errorMessage = err?.message || 'Failed to render diagram';
                setError(errorMessage);
                onError?.(errorMessage);
                setSvg('');
                setIsLoading(false);

                // Clean up any error elements Mermaid may have created
                cleanupMermaidErrors();
            }
        };

        renderDiagram();

        // Cleanup on unmount
        return () => {
            cleanupMermaidErrors();
        };
    }, [code, onError]);

    if (error) {
        return (
            <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
                <div className="flex items-center gap-2 text-red-700 mb-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span className="font-medium">Diagram Error</span>
                </div>
                <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
                <details className="mt-2">
                    <summary className="text-xs text-red-500 cursor-pointer">View code</summary>
                    <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-x-auto">
                        {code}
                    </pre>
                </details>
            </div>
        );
    }

    if (isLoading || (!svg && code)) {
        return (
            <div className={`flex items-center justify-center p-8 bg-gray-50 rounded-lg ${className}`}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`mermaid-diagram bg-white p-4 rounded-lg border border-gray-200 overflow-auto ${className}`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
