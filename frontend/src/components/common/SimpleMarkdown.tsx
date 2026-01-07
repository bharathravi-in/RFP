import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DiagramRenderer from '@/components/diagrams/DiagramRenderer';

interface SimpleMarkdownProps {
    content: string;
    className?: string;
    renderMermaid?: boolean;
}

/**
 * A markdown renderer using react-markdown for proper parsing.
 * Supports: bold, italic, headers, lists, code blocks, and optionally mermaid diagrams
 */
export default function SimpleMarkdown({ content, className = '', renderMermaid = true }: SimpleMarkdownProps) {
    if (!content) return null;

    // Check for mermaid code blocks and extract them
    const parts: { type: 'markdown' | 'mermaid'; content: string }[] = [];
    let remaining = content;
    const mermaidPattern = /```mermaid\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    if (renderMermaid) {
        while ((match = mermaidPattern.exec(content)) !== null) {
            // Add markdown content before this mermaid block
            if (match.index > lastIndex) {
                parts.push({ type: 'markdown', content: content.slice(lastIndex, match.index) });
            }
            // Add mermaid block
            parts.push({ type: 'mermaid', content: match[1] });
            lastIndex = match.index + match[0].length;
        }
    }

    // Add remaining markdown content
    if (lastIndex < content.length) {
        parts.push({ type: 'markdown', content: content.slice(lastIndex) });
    }

    // If no mermaid blocks found, just render the whole content as markdown
    if (parts.length === 0) {
        parts.push({ type: 'markdown', content });
    }

    return (
        <div className={`simple-markdown ${className}`}>
            {parts.map((part, index) => {
                if (part.type === 'mermaid') {
                    return (
                        <div key={index} className="my-4">
                            <DiagramRenderer
                                code={part.content}
                                title=""
                                showControls={false}
                            />
                        </div>
                    );
                }

                return (
                    <ReactMarkdown
                        key={index}
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ children }) => (
                                <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-3">{children}</h1>
                            ),
                            h2: ({ children }) => (
                                <h2 className="text-xl font-semibold text-gray-800 mt-5 mb-2">{children}</h2>
                            ),
                            h3: ({ children }) => (
                                <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">{children}</h3>
                            ),
                            p: ({ children }) => (
                                <p className="text-gray-700 mb-3 leading-relaxed">{children}</p>
                            ),
                            ul: ({ children }) => (
                                <ul className="list-disc pl-6 space-y-2 my-3 text-gray-700">{children}</ul>
                            ),
                            ol: ({ children }) => (
                                <ol className="list-decimal pl-6 space-y-2 my-3 text-gray-700">{children}</ol>
                            ),
                            li: ({ children }) => (
                                <li className="leading-relaxed">{children}</li>
                            ),
                            strong: ({ children }) => (
                                <strong className="font-semibold text-gray-900">{children}</strong>
                            ),
                            em: ({ children }) => (
                                <em className="italic">{children}</em>
                            ),
                            code: ({ className, children }) => {
                                // Check if this is a code block (has className with language)
                                const isBlock = className?.includes('language-');
                                if (isBlock) {
                                    return (
                                        <pre className="p-4 rounded-lg bg-gray-900 text-gray-100 overflow-x-auto my-3">
                                            <code>{children}</code>
                                        </pre>
                                    );
                                }
                                return (
                                    <code className="px-1.5 py-0.5 rounded bg-gray-100 text-sm font-mono text-gray-800">
                                        {children}
                                    </code>
                                );
                            },
                            a: ({ href, children }) => (
                                <a
                                    href={href}
                                    className="text-primary hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {children}
                                </a>
                            ),
                            hr: () => <hr className="my-4 border-gray-200" />,
                            // Table components for proper markdown table rendering
                            table: ({ children }) => (
                                <div className="overflow-x-auto my-4">
                                    <table className="min-w-full divide-y divide-gray-300 border border-gray-300 rounded-lg">
                                        {children}
                                    </table>
                                </div>
                            ),
                            thead: ({ children }) => (
                                <thead className="bg-gray-100">
                                    {children}
                                </thead>
                            ),
                            tbody: ({ children }) => (
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {children}
                                </tbody>
                            ),
                            tr: ({ children }) => (
                                <tr className="hover:bg-gray-50">
                                    {children}
                                </tr>
                            ),
                            th: ({ children }) => (
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                                    {children}
                                </th>
                            ),
                            td: ({ children }) => (
                                <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-200">
                                    {children}
                                </td>
                            ),
                        }}
                    >
                        {part.content}
                    </ReactMarkdown>
                );
            })}
        </div>
    );
}
