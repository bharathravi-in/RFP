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
    organizationName?: string;
}

export default function ChatSidebar({
    sessions,
    activeSessionId,
    onNewChat,
    onSelectSession,
    onDeleteSession,
    collapsed = false,
    organizationName = 'AutoRespond',
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

    // Get initials from organization name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    if (collapsed) {
        return (
            <div className="w-16 h-full bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center py-4 gap-4 border-r border-slate-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <SparklesIcon className="h-5 w-5 text-white" />
                </div>
                <button
                    onClick={onNewChat}
                    className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-white transition-all duration-200 hover:scale-105 border border-slate-700/50"
                >
                    <PlusIcon className="h-5 w-5" />
                </button>
            </div>
        );
    }

    return (
        <div className="w-72 h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col border-r border-slate-700/30">
            {/* Header - Premium Design */}
            <div className="p-4 border-b border-slate-700/30">
                {/* Brand Section */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <SparklesIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                            <span className="text-[8px] text-white font-bold">AI</span>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-white font-semibold text-sm truncate">
                            {organizationName} Co-Pilot
                        </h2>
                        <p className="text-slate-400 text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            AI Assistant
                        </p>
                    </div>
                </div>

                {/* New Chat Button - Premium */}
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl font-medium text-sm transition-all duration-300 shadow-lg shadow-violet-600/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <PlusIcon className="h-4 w-4" />
                    New Chat
                </button>
            </div>

            {/* Sessions List - Modern */}
            <div className="flex-1 overflow-y-auto py-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {sessions.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-800/50 flex items-center justify-center border border-slate-700/30">
                            <ChatBubbleLeftRightIcon className="h-8 w-8 text-slate-600" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium">No conversations yet</p>
                        <p className="text-slate-500 text-xs mt-1">Start a new chat to begin</p>
                    </div>
                ) : (
                    groupSessions().map((group) => (
                        <div key={group.label} className="mb-3">
                            <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="flex-1">{group.label}</span>
                                <span className="text-slate-600">{group.sessions.length}</span>
                            </div>
                            {group.sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className={clsx(
                                        'group mx-2 px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-2.5 transition-all duration-200',
                                        activeSessionId === session.id
                                            ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/10 text-white border border-violet-500/30 shadow-sm'
                                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                                    )}
                                    onClick={() => onSelectSession(session.id)}
                                >
                                    <div className={clsx(
                                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                        activeSessionId === session.id
                                            ? 'bg-violet-500/20'
                                            : 'bg-slate-700/50'
                                    )}>
                                        <ChatBubbleLeftRightIcon className={clsx(
                                            'h-4 w-4',
                                            activeSessionId === session.id ? 'text-violet-400' : 'text-slate-500'
                                        )} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="block truncate text-sm font-medium">{session.title}</span>
                                        <span className="block text-[10px] text-slate-500 mt-0.5">
                                            {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all duration-200"
                                    >
                                        <TrashIcon className="h-3.5 w-3.5 text-slate-400 hover:text-red-400" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* Footer - Minimal */}
            <div className="p-3 border-t border-slate-700/30">
                <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/30">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">{getInitials(organizationName)}</span>
                    </div>
                    <p className="text-slate-500 text-[10px]">Powered by AI</p>
                </div>
            </div>
        </div>
    );
}
