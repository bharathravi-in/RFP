import { useRef, useEffect } from 'react';
import clsx from 'clsx';
import { ChatMessage as ChatMessageType } from './types';
import ChatMessage from './ChatMessage';
import { SparklesIcon } from '@heroicons/react/24/solid';

interface ChatWindowProps {
    messages: ChatMessageType[];
    isLoading?: boolean;
    showWelcome?: boolean;
    onSuggestionClick?: (text: string) => void;
}

const SUGGESTIONS = [
    { icon: '📝', text: 'Write a proposal section' },
    { icon: '🔍', text: 'Analyze RFP requirements' },
    { icon: '💡', text: 'Generate response ideas' },
    { icon: '✅', text: 'Check compliance' },
];

export default function ChatWindow({
    messages,
    isLoading,
    showWelcome,
    onSuggestionClick,
}: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (showWelcome) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center px-4">
                {/* Logo */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg">
                    <SparklesIcon className="h-8 w-8 text-white" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">How can I help you today?</h1>
                <p className="text-gray-500 text-sm text-center mb-8">Ask me anything about proposals, RFPs, or writing</p>

                {/* Suggestions - Inline */}
                <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                    {SUGGESTIONS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => onSuggestionClick?.(s.text)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all text-sm text-gray-700"
                        >
                            <span>{s.icon}</span>
                            <span>{s.text}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.map((message) => (
                <ChatMessage key={message.id} message={message} showTimestamp />
            ))}
            {isLoading && messages.length > 0 && messages[messages.length - 1].status !== 'streaming' && (
                <div className="py-4 px-4 bg-gray-50">
                    <div className="max-w-4xl mx-auto flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <SparklesIcon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex items-center gap-1.5 pt-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
