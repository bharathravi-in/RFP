import { memo } from 'react';
import clsx from 'clsx';
import { ChatMessage as ChatMessageType } from './types';
import AgentBadge from './AgentBadge';
import { SparklesIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface ChatMessageProps {
    message: ChatMessageType;
    showTimestamp?: boolean;
    userName?: string;
    userAvatar?: string;
}

function ChatMessage({ message, showTimestamp = true, userName = 'You', userAvatar }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    const isError = message.status === 'error';

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderContent = (content: string) => {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const contentWithCodeBlocks = content.replace(codeBlockRegex, (_, lang, code) => {
            return `<CODEBLOCK lang="${lang || 'text'}">${code.trim()}</CODEBLOCK>`;
        });

        const segments = contentWithCodeBlocks.split(/(<CODEBLOCK[^>]*>[\s\S]*?<\/CODEBLOCK>)/);

        return segments.map((segment, index) => {
            const codeMatch = segment.match(/<CODEBLOCK lang="(\w+)">([\s\S]*?)<\/CODEBLOCK>/);
            if (codeMatch) {
                const [, lang, code] = codeMatch;
                return (
                    <pre key={index} className="my-4 rounded-xl overflow-hidden bg-slate-900 shadow-lg">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                            <span className="text-xs font-mono text-slate-400">{lang}</span>
                            <button
                                onClick={() => copyToClipboard(code)}
                                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1 hover:bg-slate-700 rounded-md transition-colors"
                            >
                                {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <code className="text-sm text-slate-100 font-mono">{code}</code>
                        </div>
                    </pre>
                );
            }

            return (
                <span key={index}>
                    {segment.split('\n').map((line, lineIndex) => (
                        <span key={lineIndex}>
                            {lineIndex > 0 && <br />}
                            {renderInlineMarkdown(line)}
                        </span>
                    ))}
                </span>
            );
        });
    };

    const renderInlineMarkdown = (text: string) => {
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
        text = text.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-violet-100 border border-violet-200 rounded-md text-sm font-mono text-violet-700">$1</code>');
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-violet-600 hover:text-violet-700 underline underline-offset-2" target="_blank" rel="noopener">$1</a>');
        text = text.replace(/^- (.+)$/gm, '<div class="flex gap-2.5 my-1"><span class="text-violet-400 text-lg leading-none">•</span><span>$1</span></div>');
        text = text.replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-5 mb-2 text-slate-900">$1</h3>');
        text = text.replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-6 mb-3 text-slate-900">$1</h2>');
        text = text.replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-6 mb-3 text-slate-900">$1</h1>');
        text = text.replace(/^\d+\. (.+)$/gm, '<div class="flex gap-2.5 my-1"><span class="text-violet-500 font-semibold min-w-[20px]">$&</span></div>');
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    const getUserInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    // User messages - Right aligned with premium bubble
    if (isUser) {
        return (
            <div className="py-4 px-6">
                <div className="max-w-4xl mx-auto flex flex-col items-end">
                    {/* Header - Right aligned */}
                    <div className="flex items-center gap-2 mb-2">
                        {showTimestamp && <span className="text-xs text-slate-400">{formatTime(message.timestamp)}</span>}
                        <span className="font-semibold text-slate-700 text-sm">{userName}</span>
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center shadow-md shadow-primary-200">
                            {userAvatar ? (
                                <img src={userAvatar} alt={userName} className="h-full w-full rounded-full object-cover" />
                            ) : (
                                <span className="text-[11px] font-bold text-white">{getUserInitials(userName)}</span>
                            )}
                        </div>
                    </div>
                    {/* Message Bubble - Premium Gradient */}
                    <div className="bg-gradient-to-br from-violet-600 to-purple-600 text-white px-5 py-3 rounded-2xl rounded-tr-md max-w-[75%] shadow-lg shadow-violet-200 text-[15px] leading-relaxed">
                        {message.content}
                    </div>
                </div>
            </div>
        );
    }

    // AI messages - Left aligned with card style
    return (
        <div className="py-4 px-6 bg-gradient-to-r from-slate-50/80 to-white">
            <div className="max-w-4xl mx-auto flex gap-4">
                {/* Avatar with Glow */}
                <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-md opacity-30" />
                    <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <SparklesIcon className="h-5 w-5 text-white" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-900 text-sm">Co-Pilot</span>
                        {message.agentName && (
                            <AgentBadge name={message.agentName} icon={message.agentIcon} color="purple" size="sm" />
                        )}
                        {showTimestamp && <span className="text-xs text-slate-400">{formatTime(message.timestamp)}</span>}
                    </div>

                    {/* Message Text */}
                    <div className={clsx(
                        'text-slate-700 leading-relaxed text-[15px]',
                        isError && 'text-red-600'
                    )}>
                        {renderContent(message.content)}
                    </div>

                    {message.status === 'streaming' && (
                        <div className="flex items-center gap-2 mt-3">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-sm text-violet-600 font-medium">Generating...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default memo(ChatMessage);
