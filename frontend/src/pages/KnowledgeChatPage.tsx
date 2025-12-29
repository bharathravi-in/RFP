import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PaperAirplaneIcon, SparklesIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    documentReferences?: any;
}

interface ChatSession {
    id: number;
    knowledgeItemId: number;
    summary: string;
    keyPoints: string[];
    suggestions: string[];
}

interface KnowledgeInfo {
    id: number;
    title: string;
    fileType: string;
    previewUrl: string;
    storageType?: string;
    msViewerUrl?: string;
}

const KnowledgeChatPage: React.FC = () => {
    // Helper function to render markdown bold text
    const renderMarkdown = (text: string) => {
        // Replace **text** with bold
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };
    const { itemId } = useParams<{ itemId: string }>();
    const navigate = useNavigate();

    const [session, setSession] = useState<ChatSession | null>(null);
    const [knowledgeItem, setKnowledgeItem] = useState<KnowledgeInfo | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (itemId) {
            fetchChatSession();
        }
    }, [itemId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchChatSession = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/knowledge/${itemId}/chat`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setSession(data.session);
                setMessages(data.messages || []);

                // Set knowledge item info
                let itemInfo: KnowledgeInfo = data.knowledgeItem;

                // For Office documents stored in GCP, try to get MS Office viewer URL
                const fileType = itemInfo.fileType?.toLowerCase() || '';
                const isOfficeFile = ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt'].includes(fileType) ||
                    fileType.includes('spreadsheetml') ||
                    fileType.includes('wordprocessingml') ||
                    fileType.includes('presentationml');
                const isGcpStorage = data.knowledgeItem?.storageType === 'gcp';

                if (isOfficeFile && isGcpStorage) {
                    try {
                        const signedUrlResponse = await fetch(`/api/preview/${itemId}/signed-url`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (signedUrlResponse.ok) {
                            const signedData = await signedUrlResponse.json();
                            itemInfo = {
                                ...itemInfo,
                                msViewerUrl: signedData.microsoft_viewer_url
                            };
                        }
                    } catch (err) {
                        console.warn('Failed to get MS viewer URL, using default preview:', err);
                    }
                }

                setKnowledgeItem(itemInfo);
            } else {
                const errData = await response.json();
                setError(errData.error || 'Failed to load chat session');
            }
        } catch (err) {
            console.error('Failed to fetch chat session:', err);
            setError('Failed to connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async (message: string) => {
        if (!message.trim() || isSending) return;

        const userMessage: Message = {
            id: Date.now(),
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsSending(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/knowledge/${itemId}/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(prev => [...prev, data.message]);
                setSession(data.session);
            }
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setIsSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputValue);
        }
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-background text-text-primary">
                <p className="text-red-500 mb-4">{error}</p>
                <button onClick={() => navigate(-1)} className="btn-secondary">Go Back</button>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background text-text-primary">
            {/* Header */}
            <header className="flex items-center gap-4 px-6 py-4 border-b border-border bg-surface shrink-0">
                <button
                    onClick={() => navigate('/knowledge')}
                    className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                    <span>Go to Knowledge Base</span>
                </button>
                {knowledgeItem && (
                    <span className="text-text-muted ml-auto truncate max-w-xs">{knowledgeItem.title}</span>
                )}
            </header>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0">
                {/* Left Panel - Chat */}
                <div className="w-2/5 flex flex-col border-r border-border bg-surface min-h-0">
                    {/* Summary Section - Scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        {session?.summary && (
                            <div className="p-6 border-b border-border">
                                <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm mb-4">
                                    Summary
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-start gap-2">
                                        <SparklesIcon className="w-4 h-4 text-yellow-500 mt-1 shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-text-primary">- Overview:</p>
                                            <p className="text-sm text-text-secondary mt-1">{session.summary}</p>
                                        </div>
                                    </div>
                                </div>

                                {session.keyPoints && session.keyPoints.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-text-primary mb-2">- Key Points:</p>
                                        <ul className="space-y-2 text-sm text-text-secondary">
                                            {session.keyPoints.map((point, index) => (
                                                <li key={index} className="flex items-start gap-2">
                                                    <span className="text-text-muted">-</span>
                                                    <span>{renderMarkdown(point)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Suggestions */}
                                {session.suggestions && session.suggestions.length > 0 && messages.length === 0 && (
                                    <div className="mt-6 space-y-2">
                                        <p className="text-sm font-medium text-text-primary mb-2">Suggested Questions:</p>
                                        {session.suggestions.slice(0, 2).map((suggestion, index) => (
                                            <button
                                                key={index}
                                                onClick={() => sendMessage(suggestion)}
                                                className="w-full text-left px-4 py-3 bg-background hover:bg-primary/5 rounded-lg text-sm text-text-primary border border-border hover:border-primary transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Messages */}
                        <div className="p-6 space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-lg p-3 ${message.role === 'user'
                                            ? 'bg-primary text-white'
                                            : 'bg-background text-text-primary border border-border'
                                            }`}
                                    >
                                        {message.role === 'assistant' && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <SparklesIcon className="w-4 h-4 text-yellow-500" />
                                            </div>
                                        )}
                                        <div className="text-sm whitespace-pre-wrap">
                                            {message.role === 'assistant'
                                                ? message.content.split('\n').map((line, i) => (
                                                    <p key={i} className={i > 0 ? 'mt-2' : ''}>
                                                        {renderMarkdown(line)}
                                                    </p>
                                                ))
                                                : message.content
                                            }
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {isSending && (
                                <div className="flex justify-start">
                                    <div className="bg-background border border-border rounded-lg p-3">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-border bg-surface shrink-0">
                        <div className="flex items-center gap-3 bg-background rounded-lg px-4 py-3 border border-border">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder-text-muted"
                                disabled={isSending}
                            />
                            <button
                                onClick={() => sendMessage(inputValue)}
                                disabled={!inputValue.trim() || isSending}
                                className="p-2 bg-primary hover:bg-primary-hover disabled:bg-border disabled:cursor-not-allowed rounded-full transition-colors"
                            >
                                <PaperAirplaneIcon className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Document Preview */}
                <div className="w-3/5 flex flex-col bg-background min-h-0">
                    {knowledgeItem && (
                        <>
                            <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-surface shrink-0">
                                <DocumentTextIcon className="w-5 h-5 text-text-muted" />
                                <span className="text-sm text-text-secondary truncate">{knowledgeItem.title}</span>
                            </div>

                            <div className="flex-1 min-h-0">
                                {knowledgeItem.msViewerUrl ? (
                                    // Use MS Office Online viewer for best Office file rendering
                                    <iframe
                                        src={knowledgeItem.msViewerUrl}
                                        className="w-full h-full border-0"
                                        title="Document Preview"
                                    />
                                ) : knowledgeItem.fileType?.toLowerCase() === 'pdf' ||
                                    knowledgeItem.fileType?.toLowerCase() === 'application/pdf' ? (
                                    // Use embed for PDF with /view endpoint
                                    <embed
                                        src={`/api/preview/${knowledgeItem.id}/view?token=${localStorage.getItem('access_token')}`}
                                        type="application/pdf"
                                        className="w-full h-full"
                                        title="PDF Preview"
                                    />
                                ) : ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt'].includes(knowledgeItem.fileType?.toLowerCase() || '') ||
                                    knowledgeItem.fileType?.includes('spreadsheetml') ||
                                    knowledgeItem.fileType?.includes('wordprocessingml') ||
                                    knowledgeItem.fileType?.includes('presentationml') ||
                                    knowledgeItem.fileType?.includes('ms-excel') ||
                                    knowledgeItem.fileType?.includes('ms-word') ||
                                    knowledgeItem.fileType?.includes('ms-powerpoint') ? (
                                    // Fallback: Use view endpoint for Office files (converts to HTML)
                                    <iframe
                                        src={`/api/preview/${knowledgeItem.id}/view?token=${localStorage.getItem('access_token')}`}
                                        className="w-full h-full border-0"
                                        title="Document Preview"
                                    />
                                ) : (
                                    // Default iframe for other types
                                    <iframe
                                        src={`${knowledgeItem.previewUrl}?token=${localStorage.getItem('access_token')}`}
                                        className="w-full h-full border-0"
                                        title="Document Preview"
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KnowledgeChatPage;
