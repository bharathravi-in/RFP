import { useState, useRef, useEffect } from 'react';
import api from '@/api/client';
import { RFPSection } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    PaperAirplaneIcon,
    SparklesIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isLoading?: boolean;
}

interface SectionAIChatPanelProps {
    section: RFPSection;
    projectId: number;
    onContentGenerated: (content: string) => void;
    isExpanded: boolean;
    onToggle: () => void;
}

export default function SectionAIChatPanel({
    section,
    projectId,
    onContentGenerated,
    isExpanded,
    onToggle,
}: SectionAIChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Reset messages when section changes
    useEffect(() => {
        setMessages([]);
        setGeneratedContent(null);
    }, [section.id]);

    const generateMessageId = () => `msg-${Date.now()}`;

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
                knowledge_item_ids: [],
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
        }
    };

    // Collapsed state
    if (!isExpanded) {
        return (
            <button
                onClick={onToggle}
                className="w-full p-3 bg-primary/5 border-t border-primary/20 hover:bg-primary/10 transition-colors flex items-center justify-between"
            >
                <span className="flex items-center gap-2 text-sm text-primary font-medium">
                    <SparklesIcon className="h-4 w-4" />
                    AI Assistant
                </span>
                <ChevronUpIcon className="h-4 w-4 text-primary" />
            </button>
        );
    }

    return (
        <div className="border-t border-border bg-white flex flex-col" style={{ height: '300px' }}>
            {/* Header */}
            <button
                onClick={onToggle}
                className="px-4 py-2 border-b border-border flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <SparklesIcon className="h-4 w-4 text-primary" />
                    AI Assistant
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            </button>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-sm text-gray-500 mb-3">
                            {section.content ? 'Ask AI to improve this content' : 'Ask AI to generate content'}
                        </p>
                        <div className="flex gap-2 justify-center flex-wrap">
                            {(section.content ? ['Improve', 'Shorten', 'Expand'] : ['Generate', 'Outline']).map(label => (
                                <button
                                    key={label}
                                    onClick={() => setInputValue(label + ' this section')}
                                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                            <div className={clsx(
                                'max-w-[80%] px-3 py-2 rounded-lg text-sm',
                                msg.role === 'user' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700'
                            )}>
                                {msg.isLoading ? (
                                    <span className="flex items-center gap-2 text-gray-400">
                                        <span className="animate-pulse">Thinking...</span>
                                    </span>
                                ) : (
                                    <span className="whitespace-pre-wrap">{msg.content}</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-white">
                <div className="flex gap-2">
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your request..."
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        className="px-3 py-2 rounded-lg bg-primary text-white disabled:opacity-50"
                    >
                        <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                </div>

                {generatedContent && messages.length > 0 && (
                    <button
                        onClick={handleApply}
                        className="w-full mt-2 py-2 rounded-lg bg-green-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-600"
                    >
                        <CheckIcon className="h-4 w-4" />
                        Apply to Section
                    </button>
                )}
            </div>
        </div>
    );
}
