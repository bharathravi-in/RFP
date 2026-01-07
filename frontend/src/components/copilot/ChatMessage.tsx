import { memo } from 'react';
import clsx from 'clsx';
import { ChatMessage as ChatMessageType } from './types';
import AgentBadge from './AgentBadge';
import { SparklesIcon } from '@heroicons/react/24/outline';

interface ChatMessageProps {
    message: ChatMessageType;
    showTimestamp?: boolean;
    userName?: string;
    userAvatar?: string;
}

function ChatMessage({ message, showTimestamp = true, userName = 'You', userAvatar }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const isError = message.status === 'error';

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
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
                    <pre key={index} className="my-3 p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm font-mono">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
                            <span className="text-xs text-gray-400">{lang}</span>
                            <button className="text-xs text-gray-400 hover:text-white px-2 py-1 hover:bg-gray-700 rounded">Copy</button>
                        </div>
                        <code>{code}</code>
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
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-sm font-mono text-pink-600">$1</code>');
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener">$1</a>');
        text = text.replace(/^- (.+)$/gm, '<div class="flex gap-2 my-0.5"><span class="text-gray-400">•</span><span>$1</span></div>');
        text = text.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-base mt-4 mb-2 text-gray-900">$1</h3>');
        text = text.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-lg mt-4 mb-2 text-gray-900">$1</h2>');
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    const getUserInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    // User messages - Right aligned
    if (isUser) {
        return (
            <div className="py-3 px-4 bg-transparent">
                <div className="max-w-4xl mx-auto flex flex-col items-end">
                    {/* Header - Right aligned */}
                    <div className="flex items-center gap-2 mb-1">
                        {showTimestamp && <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>}
                        <span className="font-semibold text-gray-900 text-sm">{userName}</span>
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            {userAvatar ? (
                                <img src={userAvatar} alt={userName} className="h-full w-full rounded-full object-cover" />
                            ) : (
                                <span className="text-[10px] font-semibold text-white">{getUserInitials(userName)}</span>
                            )}
                        </div>
                    </div>
                    {/* Message - Right aligned, with background */}
                    <div className="bg-primary text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[70%] text-[15px]">
                        {message.content}
                    </div>
                </div>
            </div>
        );
    }

    // AI messages - Left aligned, no bubble
    return (
        <div className="py-4 px-4 bg-gray-50">
            <div className="max-w-4xl mx-auto flex gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <SparklesIcon className="h-4 w-4 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">Co-Pilot</span>
                        {message.agentName && (
                            <AgentBadge name={message.agentName} icon={message.agentIcon} color="purple" size="sm" />
                        )}
                        {showTimestamp && <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>}
                    </div>

                    {/* Message Text */}
                    <div className={clsx('text-gray-800 leading-relaxed text-[15px]', isError && 'text-red-600')}>
                        {renderContent(message.content)}
                    </div>

                    {message.status === 'streaming' && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                            <span className="animate-pulse">●</span> Generating...
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default memo(ChatMessage);
