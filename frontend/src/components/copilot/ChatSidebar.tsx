import clsx from 'clsx';
import { SparklesIcon, ChatBubbleLeftRightIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

interface ChatSession {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
}

interface ChatSidebarProps {
    sessions: ChatSession[];
    activeSessionId: string | null;
    onNewChat: () => void;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    collapsed?: boolean;
}

export default function ChatSidebar({
    sessions,
    activeSessionId,
    onNewChat,
    onSelectSession,
    onDeleteSession,
    collapsed = false,
}: ChatSidebarProps) {
    const isToday = (date: Date) => {
        const today = new Date();
        return new Date(date).toDateString() === today.toDateString();
    };

    const isYesterday = (date: Date) => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return new Date(date).toDateString() === yesterday.toDateString();
    };

    const groupSessions = () => {
        const groups: { label: string; sessions: ChatSession[] }[] = [
            { label: 'Today', sessions: [] },
            { label: 'Yesterday', sessions: [] },
            { label: 'Previous', sessions: [] },
        ];

        sessions.forEach((session) => {
            const date = new Date(session.updatedAt);
            if (isToday(date)) {
                groups[0].sessions.push(session);
            } else if (isYesterday(date)) {
                groups[1].sessions.push(session);
            } else {
                groups[2].sessions.push(session);
            }
        });

        return groups.filter((g) => g.sessions.length > 0);
    };

    if (collapsed) {
        return (
            <div className="w-14 h-full bg-gray-900 flex flex-col items-center py-3 gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <SparklesIcon className="h-5 w-5 text-white" />
                </div>
                <button onClick={onNewChat} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white">
                    <PlusIcon className="h-5 w-5" />
                </button>
            </div>
        );
    }

    return (
        <div className="w-64 h-full bg-gray-900 flex flex-col">
            {/* Header - Compact */}
            <div className="p-3 border-b border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <SparklesIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-white font-semibold text-sm">Tarento Co-Pilot</h2>
                        <p className="text-gray-400 text-[10px]">AI Assistant</p>
                    </div>
                </div>
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium text-sm transition-colors"
                >
                    <PlusIcon className="h-4 w-4" />
                    New Chat
                </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto py-2">
                {sessions.length === 0 ? (
                    <div className="px-3 py-6 text-center">
                        <ChatBubbleLeftRightIcon className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-400 text-xs">No chats yet</p>
                    </div>
                ) : (
                    groupSessions().map((group) => (
                        <div key={group.label} className="mb-2">
                            <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                {group.label}
                            </div>
                            {group.sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className={clsx(
                                        'group mx-2 px-2 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 transition-colors',
                                        activeSessionId === session.id
                                            ? 'bg-gray-700 text-white'
                                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    )}
                                    onClick={() => onSelectSession(session.id)}
                                >
                                    <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
                                    <span className="flex-1 truncate text-xs">{session.title}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-opacity"
                                    >
                                        <TrashIcon className="h-3 w-3 text-gray-400 hover:text-red-400" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* Footer - Compact */}
            <div className="p-2 border-t border-gray-800">
                <p className="text-gray-500 text-[9px] text-center">Powered by Tarento AI</p>
            </div>
        </div>
    );
}
