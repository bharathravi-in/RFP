import React from 'react';
import DiagramRenderer from '@/components/diagrams/DiagramRenderer';

interface SimpleMarkdownProps {
    content: string;
    className?: string;
    renderMermaid?: boolean; // Enable mermaid diagram rendering
}

/**
 * A simple markdown renderer that handles basic formatting without external dependencies.
 * Supports: bold, italic, headers, lists, code blocks, and optionally mermaid diagrams
 */
export default function SimpleMarkdown({ content, className = '', renderMermaid = true }: SimpleMarkdownProps) {
    if (!content) return null;

    // Process the content line by line
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let isInCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = ''; // Track the code block language for mermaid detection

    const processInlineFormatting = (text: string): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let key = 0;

        // Process bold and italic
        const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            // Add text before match
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            if (match[2]) {
                // Bold italic ***text***
                parts.push(<strong key={key++}><em>{match[2]}</em></strong>);
            } else if (match[3]) {
                // Bold **text**
                parts.push(<strong key={key++}>{match[3]}</strong>);
            } else if (match[4]) {
                // Italic *text*
                parts.push(<em key={key++}>{match[4]}</em>);
            } else if (match[5]) {
                // Inline code `code`
                parts.push(
                    <code key={key++} className="px-1.5 py-0.5 rounded bg-gray-100 text-sm font-mono text-gray-800">
                        {match[5]}
                    </code>
                );
            } else if (match[6] && match[7]) {
                // Link [text](url)
                parts.push(
                    <a key={key++} href={match[7]} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                        {match[6]}
                    </a>
                );
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts.length > 0 ? parts : [text];
    };

    const flushList = () => {
        if (currentList.length > 0) {
            const isOrdered = /^\d+\./.test(currentList[0]);
            const ListTag = isOrdered ? 'ol' : 'ul';
            elements.push(
                <ListTag key={elements.length} className={isOrdered ? 'list-decimal list-inside space-y-1 my-2' : 'list-disc list-inside space-y-1 my-2'}>
                    {currentList.map((item, i) => (
                        <li key={i} className="text-gray-700">
                            {processInlineFormatting(item.replace(/^[\d]+\.\s*|^[-*]\s*/, ''))}
                        </li>
                    ))}
                </ListTag>
            );
            currentList = [];
        }
    };

    lines.forEach((line, index) => {
        // Code block detection
        if (line.startsWith('```')) {
            if (isInCodeBlock) {
                // End code block - check if it was mermaid
                const codeContent = codeBlockContent.join('\n');
                if (renderMermaid && codeBlockContent.length > 0 && line.startsWith('```') && elements.length > 0) {
                    // Check if the opening was mermaid
                    const lastElement = elements[elements.length - 1];
                    if (lastElement && (lastElement as any).props?.['data-mermaid']) {
                        // Already handled as mermaid
                    }
                }

                // Check for mermaid by looking at the stored language
                if (renderMermaid && codeBlockLanguage === 'mermaid') {
                    elements.push(
                        <div key={elements.length} className="my-4">
                            <DiagramRenderer
                                code={codeContent}
                                title=""
                                showControls={false}
                            />
                        </div>
                    );
                } else {
                    elements.push(
                        <pre key={elements.length} className="p-4 rounded-lg bg-gray-900 text-gray-100 overflow-x-auto my-3">
                            <code>{codeContent}</code>
                        </pre>
                    );
                }
                codeBlockContent = [];
                isInCodeBlock = false;
                codeBlockLanguage = '';
            } else {
                flushList();
                isInCodeBlock = true;
                // Extract language from opening fence (e.g., ```mermaid)
                codeBlockLanguage = line.slice(3).trim().toLowerCase();
            }
            return;
        }

        if (isInCodeBlock) {
            codeBlockContent.push(line);
            return;
        }

        // Headers
        if (line.startsWith('### ')) {
            flushList();
            elements.push(
                <h3 key={elements.length} className="text-lg font-semibold text-gray-800 mt-4 mb-2">
                    {processInlineFormatting(line.slice(4))}
                </h3>
            );
            return;
        }
        if (line.startsWith('## ')) {
            flushList();
            elements.push(
                <h2 key={elements.length} className="text-xl font-semibold text-gray-800 mt-5 mb-2">
                    {processInlineFormatting(line.slice(3))}
                </h2>
            );
            return;
        }
        if (line.startsWith('# ')) {
            flushList();
            elements.push(
                <h1 key={elements.length} className="text-2xl font-bold text-gray-900 mt-6 mb-3">
                    {processInlineFormatting(line.slice(2))}
                </h1>
            );
            return;
        }

        // Lists
        if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
            currentList.push(line);
            return;
        } else {
            flushList();
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(line.trim())) {
            elements.push(<hr key={elements.length} className="my-4 border-gray-200" />);
            return;
        }

        // Empty line
        if (line.trim() === '') {
            elements.push(<div key={elements.length} className="h-2" />);
            return;
        }

        // Regular paragraph
        elements.push(
            <p key={elements.length} className="text-gray-700 mb-2 leading-relaxed">
                {processInlineFormatting(line)}
            </p>
        );
    });

    // Flush any remaining list
    flushList();

    return <div className={`simple-markdown ${className}`}>{elements}</div>;
}
