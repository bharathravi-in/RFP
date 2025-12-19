import { useState, useRef, useEffect } from 'react';
import api from '@/api/client';
import { RFPSectionType } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    PaperAirplaneIcon,
    DocumentIcon,
    FolderOpenIcon,
    XMarkIcon,
    SparklesIcon,
    ArrowPathIcon,
    CheckIcon,
    ArrowUpTrayIcon,
    DocumentTextIcon,
    LightBulbIcon,
} from '@heroicons/react/24/outline';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Array<{ title: string; snippet: string }>;
    isLoading?: boolean;
}

interface KnowledgeItem {
    id: number;
    title: string;
    content_type?: string;
}

interface SectionChatAssistantProps {
    sectionType: RFPSectionType;
    projectId: number;
    onContentReady: (content: string) => void;
    onClose: () => void;
}

export default function SectionChatAssistant({
    sectionType,
    projectId,
    onContentReady,
    onClose,
}: SectionChatAssistantProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);
    const [showContentPreview, setShowContentPreview] = useState(false);

    // Knowledge context
    const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
    const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<number[]>([]);
    const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);

    // File upload
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load available knowledge items
    useEffect(() => {
        const loadKnowledge = async () => {
            try {
                const response = await api.get('/knowledge', { params: { limit: 100 } });
                setKnowledgeItems(response.data.items || []);
            } catch {
                // Silent fail - knowledge is optional
            }
        };
        loadKnowledge();
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Add initial greeting
    useEffect(() => {
        const greeting: Message = {
            id: 'greeting',
            role: 'assistant',
            content: `I'll help you create content for your **${sectionType.name}** section.

**Here's how it works:**
1. 📚 Add knowledge documents for context (optional but recommended)
2. 💬 Tell me what you want - be specific about focus areas
3. 🔄 Review my draft and ask for changes
4. ✅ Click "Use This Content" when satisfied

**Ready?** Try one of the suggestions below or type your own request.`,
        };
        setMessages([greeting]);
    }, [sectionType.name]);

    const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const toggleKnowledgeItem = (id: number) => {
        setSelectedKnowledgeIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setUploadedFiles(prev => [...prev, ...files]);
            toast.success(`Added ${files.length} file(s) as reference`);
        }
    };

    const removeFile = (index: number) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendMessage = async () => {
        const message = inputValue.trim();
        if (!message || isLoading) return;

        const userMessage: Message = {
            id: generateMessageId(),
            role: 'user',
            content: message,
        };

        const loadingMessage: Message = {
            id: generateMessageId(),
            role: 'assistant',
            content: '',
            isLoading: true,
        };

        setMessages(prev => [...prev, userMessage, loadingMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Build conversation history
            const conversationHistory = messages
                .filter(m => m.id !== 'greeting' && !m.isLoading)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await api.post('/sections/chat', {
                project_id: projectId,
                section_type_id: sectionType.id,
                message,
                knowledge_item_ids: selectedKnowledgeIds,
                conversation_history: conversationHistory,
            });

            const assistantMessage: Message = {
                id: generateMessageId(),
                role: 'assistant',
                content: response.data.response,
                sources: response.data.sources,
            };

            // If response contains suggested content, save it
            if (response.data.suggested_content) {
                setGeneratedContent(response.data.suggested_content);
            } else {
                // Use the response as content for "generate" type requests
                setGeneratedContent(response.data.response);
            }

            setMessages(prev => prev.filter(m => !m.isLoading).concat(assistantMessage));
        } catch (error) {
            toast.error('Failed to get AI response');
            setMessages(prev => prev.filter(m => !m.isLoading));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleUseContent = () => {
        if (generatedContent) {
            onContentReady(generatedContent);
        } else {
            // Use the last assistant message as content
            const lastAssistantMessage = messages.filter(m => m.role === 'assistant' && !m.isLoading).pop();
            if (lastAssistantMessage) {
                onContentReady(lastAssistantMessage.content);
            }
        }
    };

    const handleQuickPrompt = (prompt: string) => {
        setInputValue(prompt);
        inputRef.current?.focus();
    };

    const quickPrompts = [
        {
            label: '✨ Generate Draft',
            prompt: `Generate a complete ${sectionType.name} section for this proposal`,
        },
        {
            label: '📝 Outline First',
            prompt: `Create an outline for the ${sectionType.name} section, then I'll tell you what to expand`,
        },
        {
            label: '🎯 Focus Areas',
            prompt: `What key points should I cover in a ${sectionType.name} section?`,
        },
    ];

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                        <SparklesIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-text-primary">AI Content Assistant</h3>
                        <p className="text-xs text-text-muted flex items-center gap-1">
                            <span className="text-lg">{sectionType.icon}</span>
                            Creating: {sectionType.name}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-background transition-colors"
                    title="Close"
                >
                    <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
            </div>

            {/* Knowledge & Files Context Bar */}
            <div className="px-5 py-3 bg-background/50 border-b border-border">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Knowledge Picker Button */}
                    <button
                        onClick={() => setShowKnowledgePicker(!showKnowledgePicker)}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
                            selectedKnowledgeIds.length > 0
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-surface border border-border hover:border-primary hover:bg-primary/5'
                        )}
                    >
                        <FolderOpenIcon className="h-4 w-4" />
                        {selectedKnowledgeIds.length > 0
                            ? `📚 ${selectedKnowledgeIds.length} Knowledge Docs`
                            : '📚 Add Knowledge Context'}
                    </button>

                    {/* File Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                        <ArrowUpTrayIcon className="h-4 w-4" />
                        📎 Upload Reference
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                    />

                    {/* Selected Items Display */}
                    {(selectedKnowledgeIds.length > 0 || uploadedFiles.length > 0) && (
                        <div className="flex-1 flex gap-2 flex-wrap items-center">
                            {selectedKnowledgeIds.slice(0, 2).map(id => {
                                const item = knowledgeItems.find(k => k.id === id);
                                return item ? (
                                    <span
                                        key={id}
                                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-xs text-primary border border-primary/20"
                                    >
                                        <DocumentIcon className="h-3 w-3" />
                                        <span className="max-w-[80px] truncate">{item.title}</span>
                                        <button onClick={() => toggleKnowledgeItem(id)} className="hover:text-error">
                                            <XMarkIcon className="h-3 w-3" />
                                        </button>
                                    </span>
                                ) : null;
                            })}
                            {selectedKnowledgeIds.length > 2 && (
                                <span className="text-xs text-primary">+{selectedKnowledgeIds.length - 2} more</span>
                            )}
                            {uploadedFiles.map((file, i) => (
                                <span
                                    key={i}
                                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-xs text-amber-700 border border-amber-200"
                                >
                                    <DocumentTextIcon className="h-3 w-3" />
                                    <span className="max-w-[80px] truncate">{file.name}</span>
                                    <button onClick={() => removeFile(i)} className="hover:text-error">
                                        <XMarkIcon className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Knowledge Picker Dropdown */}
                {showKnowledgePicker && (
                    <div className="mt-3 p-3 bg-surface rounded-xl border border-border shadow-lg max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-text-primary">Select Knowledge Documents</p>
                            <button
                                onClick={() => setShowKnowledgePicker(false)}
                                className="text-xs text-primary hover:underline"
                            >
                                Done
                            </button>
                        </div>
                        {knowledgeItems.length === 0 ? (
                            <p className="text-sm text-text-muted py-3 text-center">
                                No knowledge items available. Add documents in the Knowledge Base first.
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {knowledgeItems.map(item => (
                                    <label
                                        key={item.id}
                                        className={clsx(
                                            'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all',
                                            selectedKnowledgeIds.includes(item.id)
                                                ? 'bg-primary/10 border border-primary/30'
                                                : 'hover:bg-background border border-transparent'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedKnowledgeIds.includes(item.id)}
                                            onChange={() => toggleKnowledgeItem(item.id)}
                                            className="checkbox"
                                        />
                                        <DocumentIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                                        <span className="text-sm text-text-primary truncate">{item.title}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.map(message => (
                    <div
                        key={message.id}
                        className={clsx(
                            'flex gap-3',
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                    >
                        {message.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <SparklesIcon className="h-4 w-4 text-primary" />
                            </div>
                        )}
                        <div
                            className={clsx(
                                'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
                                message.role === 'user'
                                    ? 'bg-primary text-white rounded-br-md'
                                    : 'bg-surface border border-border text-text-primary rounded-bl-md'
                            )}
                        >
                            {message.isLoading ? (
                                <div className="flex items-center gap-2 py-1">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                    <span className="text-sm text-text-muted">Generating...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                        {message.content}
                                    </div>
                                    {message.sources && message.sources.length > 0 && (
                                        <div className="mt-3 pt-2 border-t border-border/50">
                                            <p className="text-xs text-text-muted mb-1 flex items-center gap-1">
                                                <DocumentIcon className="h-3 w-3" />
                                                Sources used:
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {message.sources.map((source, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-background text-text-secondary">
                                                        {source.title}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        {message.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-white text-sm font-medium">
                                You
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts - Only show at the beginning */}
            {messages.length <= 2 && (
                <div className="px-5 py-3 border-t border-border bg-gradient-to-t from-background/50 to-transparent">
                    <div className="flex items-center gap-2 mb-2">
                        <LightBulbIcon className="h-4 w-4 text-amber-500" />
                        <p className="text-xs font-medium text-text-secondary">Quick Start:</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {quickPrompts.map((item, i) => (
                            <button
                                key={i}
                                onClick={() => handleQuickPrompt(item.prompt)}
                                className="text-sm px-4 py-2 rounded-full bg-surface border border-border hover:border-primary hover:bg-primary/5 text-text-primary transition-all shadow-sm"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-border bg-surface">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Tell me what you want in this section..."
                            rows={2}
                            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        className="btn-primary p-4 rounded-xl disabled:opacity-50 self-end"
                        title="Send message"
                    >
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Use Content Button - Always visible after first response */}
                {messages.length > 2 && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-success/10 to-primary/10 rounded-xl border border-success/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckIcon className="h-5 w-5 text-success" />
                                <div>
                                    <p className="text-sm font-medium text-text-primary">Happy with the content?</p>
                                    <p className="text-xs text-text-muted">Click to create your section with this content</p>
                                </div>
                            </div>
                            <button
                                onClick={handleUseContent}
                                disabled={isLoading}
                                className="btn-primary flex items-center gap-2 px-6"
                            >
                                <CheckIcon className="h-4 w-4" />
                                Use This Content
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
