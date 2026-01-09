import { useRef, useEffect } from 'react';
import clsx from 'clsx';
import { ChatMessage as ChatMessageType } from './types';
import ChatMessage from './ChatMessage';
import { SparklesIcon, DocumentTextIcon, MagnifyingGlassIcon, LightBulbIcon, CheckBadgeIcon } from '@heroicons/react/24/solid';

interface ChatWindowProps {
    messages: ChatMessageType[];
    isLoading?: boolean;
    showWelcome?: boolean;
    onSuggestionClick?: (text: string) => void;
}

const SUGGESTIONS = [
    { icon: DocumentTextIcon, text: 'Write a proposal section', color: 'from-blue-500 to-cyan-500' },
    { icon: MagnifyingGlassIcon, text: 'Analyze RFP requirements', color: 'from-violet-500 to-purple-500' },
    { icon: LightBulbIcon, text: 'Generate response ideas', color: 'from-amber-500 to-orange-500' },
    { icon: CheckBadgeIcon, text: 'Check compliance', color: 'from-emerald-500 to-teal-500' },
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
            <div className="flex-1 flex flex-col items-center justify-center px-6 bg-gradient-to-b from-white via-slate-50/50 to-slate-100/30">
                {/* Animated Background Orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                {/* Logo with Glow */}
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl blur-xl opacity-40 scale-110" />
                    <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                        <SparklesIcon className="h-10 w-10 text-white" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
                    How can I help you today?
                </h1>
                <p className="text-gray-500 text-base text-center mb-10 max-w-md">
                    Your AI-powered assistant for proposals, RFPs, and professional writing
                </p>

                {/* Suggestions - Premium Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                    {SUGGESTIONS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <button
                                key={i}
                                onClick={() => onSuggestionClick?.(s.text)}
                                className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-gray-300 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 text-left hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <div className={clsx(
                                    'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-110',
                                    s.color,
                                    `shadow-${s.color.split('-')[1]}-500/25`
                                )}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-gray-700 font-medium group-hover:text-gray-900 transition-colors">{s.text}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Powered By Footer */}
                <div className="mt-12 flex items-center gap-2 text-gray-400 text-sm">
                    <SparklesIcon className="h-4 w-4" />
                    <span>Powered by AI • Fast & Accurate Responses</span>
                </div>
            </div>
        );
    }

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50/50">
            {messages.map((message) => (
                <ChatMessage key={message.id} message={message} showTimestamp />
            ))}
            {isLoading && messages.length > 0 && messages[messages.length - 1].status !== 'streaming' && (
                <div className="py-4 px-4 bg-slate-50/80">
                    <div className="max-w-4xl mx-auto flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <SparklesIcon className="h-4 w-4 text-white animate-pulse" />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-sm text-gray-500 ml-2">Thinking...</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
