import { useState, useRef, useEffect } from 'react';
import api from '@/api/client';
import { RFPSection } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import SimpleMarkdown from '@/components/common/SimpleMarkdown';
import {
    PaperAirplaneIcon,
    SparklesIcon,
    XMarkIcon,
    CheckIcon,
    FolderOpenIcon,
    ArrowUpTrayIcon,
    DocumentIcon,
} from '@heroicons/react/24/outline';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isLoading?: boolean;
}

interface KnowledgeItem {
    id: number;
    title: string;
}

interface SectionAIChatSidebarProps {
    section: RFPSection;
    projectId: number;
    isOpen: boolean;
    onClose: () => void;
    onContentGenerated: (content: string) => void;
}

export default function SectionAIChatSidebar({
    section,
    projectId,
    isOpen,
    onClose,
    onContentGenerated,
}: SectionAIChatSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);

    // Knowledge context
    const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
    const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<number[]>([]);

    // File upload
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load knowledge items
    useEffect(() => {
        const loadKnowledge = async () => {
            try {
                const response = await api.get('/knowledge', { params: { limit: 50 } });
                setKnowledgeItems(response.data.items || []);
            } catch {
                // Silent fail
            }
        };
        if (isOpen) loadKnowledge();
    }, [isOpen]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Reset when section changes
    useEffect(() => {
        setMessages([]);
        setGeneratedContent(null);
        setSelectedKnowledgeIds([]);
        setUploadedFiles([]);
    }, [section.id]);

    const generateMessageId = () => `msg-${Date.now()}`;

    const toggleKnowledgeItem = (id: number) => {
        setSelectedKnowledgeIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setUploadedFiles(prev => [...prev, ...files]);
            toast.success(`Added ${files.length} file(s)`);
        }
    };

    const removeFile = (index: number) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendMessage = async () => {
        const message = inputValue.trim();
        if (!message || isLoading) return;

        const userMessage: Message = { id: generateMessageId(), role: 'user', content: message };
        const loadingMessage: Message = { id: generateMessageId(), role: 'assistant', content: '', isLoading: true };

        setMessages(prev => [...prev, userMessage, loadingMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const conversationHistory = messages
                .filter(m => !m.isLoading)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await api.post('/sections/chat', {
                project_id: projectId,
                section_type_id: section.section_type?.id,
                message,
                knowledge_item_ids: selectedKnowledgeIds,
                conversation_history: conversationHistory,
            });

            const assistantMessage: Message = {
                id: generateMessageId(),
                role: 'assistant',
                content: response.data.response,
            };

            setGeneratedContent(response.data.suggested_content || response.data.response);
            setMessages(prev => prev.filter(m => !m.isLoading).concat(assistantMessage));
        } catch {
            toast.error('AI request failed');
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

    const handleApply = () => {
        if (generatedContent) {
            onContentGenerated(generatedContent);
            toast.success('Content applied!');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Full Screen Panel */}
            <div className="relative ml-auto w-full max-w-3xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary/5 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <SparklesIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">AI Content Assistant</h2>
                            <p className="text-sm text-gray-500">{section.section_type?.name || section.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
                        <XMarkIcon className="h-6 w-6 text-gray-500" />
                    </button>
                </div>

                {/* Two Column Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Context Panel */}
                    <div className="w-64 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto flex-shrink-0">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">CONTEXT</h3>

                        {/* Knowledge Docs */}
                        <div className="mb-4">
                            <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">
                                Knowledge Documents
                            </label>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {knowledgeItems.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">No documents available</p>
                                ) : (
                                    knowledgeItems.map(item => (
                                        <label key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedKnowledgeIds.includes(item.id)}
                                                onChange={() => toggleKnowledgeItem(item.id)}
                                                className="rounded text-primary"
                                            />
                                            <span className="text-gray-700 truncate">{item.title}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* File Upload */}
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">
                                Reference Files
                            </label>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors"
                            >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                                Upload files
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.txt"
                                onChange={handleFileUpload}
                                className="hidden"
                            />

                            {uploadedFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {uploadedFiles.map((file, i) => (
                                        <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-xs">
                                            <span className="flex items-center gap-1.5 truncate text-gray-600">
                                                <DocumentIcon className="h-3.5 w-3.5 text-gray-400" />
                                                {file.name}
                                            </span>
                                            <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                                                <XMarkIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected Count */}
                        {(selectedKnowledgeIds.length > 0 || uploadedFiles.length > 0) && (
                            <div className="mt-4 p-2 rounded-lg bg-primary/10 text-xs text-primary">
                                {selectedKnowledgeIds.length > 0 && <div>✓ {selectedKnowledgeIds.length} knowledge doc(s)</div>}
                                {uploadedFiles.length > 0 && <div>✓ {uploadedFiles.length} uploaded file(s)</div>}
                            </div>
                        )}
                    </div>

                    {/* Right: Chat Area */}
                    <div className="flex-1 flex flex-col bg-white">
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.length === 0 ? (
                                <div className="text-center py-12">
                                    <SparklesIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-700 mb-2">How can I help?</h3>
                                    <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                                        {section.content
                                            ? 'I can help improve, expand, or rewrite your existing content.'
                                            : 'I can generate content for this section based on your knowledge base.'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {(section.content
                                            ? ['Make it more concise', 'Add more details', 'Improve the tone', 'Rewrite professionally']
                                            : ['Generate full content', 'Create an outline', 'What should I cover?', 'Draft an introduction']
                                        ).map(prompt => (
                                            <button
                                                key={prompt}
                                                onClick={() => setInputValue(prompt)}
                                                className="px-4 py-2 text-sm rounded-full bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary transition-colors"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                        <div className={clsx(
                                            'max-w-[75%] px-4 py-3 rounded-2xl text-sm',
                                            msg.role === 'user'
                                                ? 'bg-primary text-white rounded-br-md'
                                                : 'bg-gray-100 text-gray-700 rounded-bl-md'
                                        )}>
                                            {msg.isLoading ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex gap-1">
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                                                    </div>
                                                    <span className="text-gray-400">Thinking...</span>
                                                </div>
                                            ) : msg.role === 'assistant' ? (
                                                <SimpleMarkdown content={msg.content} />
                                            ) : (
                                                <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50">
                            <div className="flex gap-3">
                                <input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your request..."
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isLoading}
                                    className="px-4 py-3 rounded-xl bg-primary text-white disabled:opacity-50 hover:bg-primary-dark transition-colors"
                                >
                                    <PaperAirplaneIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {generatedContent && messages.length > 0 && (
                                <button
                                    onClick={handleApply}
                                    className="w-full mt-3 py-3 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                                >
                                    <CheckIcon className="h-5 w-5" />
                                    Apply Content to Section
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
