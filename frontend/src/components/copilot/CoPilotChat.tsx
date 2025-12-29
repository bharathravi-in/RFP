import { useState, useCallback, useEffect } from 'react';
import { ChatMessage, ALL_AGENTS, Agent } from './types';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { copilotApi } from '@/api/client';
import clsx from 'clsx';

// Session type from backend
interface BackendSession {
    id: number;
    title: string;
    mode: string;
    createdAt: string;
    updatedAt: string;
    messages?: BackendMessage[];
}

interface BackendMessage {
    id: number;
    role: string;
    content: string;
    agentName?: string;
    agentIcon?: string;
    status: string;
    timestamp: string;
}

// Convert backend session to frontend format
const toFrontendSession = (s: BackendSession) => ({
    id: String(s.id),
    title: s.title,
    mode: s.mode as 'general' | 'agents',
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
    messages: s.messages?.map(m => ({
        id: String(m.id),
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        agentName: m.agentName,
        agentIcon: m.agentIcon,
        status: m.status as 'complete' | 'error' | 'streaming',
        timestamp: new Date(m.timestamp),
    })) || [],
});

interface CoPilotChatProps {
    className?: string;
    defaultSidebarOpen?: boolean;
}

export default function CoPilotChat({
    className,
    defaultSidebarOpen = true,
}: CoPilotChatProps) {
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
    const [mode, setMode] = useState<'general' | 'agents'>('general');
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

    // Load sessions on mount
    useEffect(() => {
        loadSessions();
    }, []);

    // Load messages when session changes
    useEffect(() => {
        if (activeSessionId) {
            loadSessionMessages(parseInt(activeSessionId));
        } else {
            setActiveMessages([]);
        }
    }, [activeSessionId]);

    const loadSessions = async () => {
        try {
            const response = await copilotApi.getSessions();
            if (response.data.success) {
                const loaded = response.data.sessions.map(toFrontendSession);
                setSessions(loaded);
                if (loaded.length > 0 && !activeSessionId) {
                    setActiveSessionId(String(loaded[0].id));
                }
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    };

    const loadSessionMessages = async (sessionId: number) => {
        try {
            const response = await copilotApi.getSession(sessionId);
            if (response.data.success) {
                const session = toFrontendSession(response.data.session);
                setActiveMessages(session.messages);
            }
        } catch (error) {
            console.error('Failed to load session messages:', error);
        }
    };

    const handleNewChat = useCallback(async () => {
        try {
            const response = await copilotApi.createSession({ mode });
            if (response.data.success) {
                const newSession = toFrontendSession(response.data.session);
                setSessions((prev) => [newSession, ...prev]);
                setActiveSessionId(String(newSession.id));
                setActiveMessages([]);
            }
        } catch (error) {
            console.error('Failed to create session:', error);
        }
    }, [mode]);

    const handleSelectSession = useCallback((sessionId: string) => {
        setActiveSessionId(sessionId);
    }, []);

    const handleDeleteSession = useCallback(async (sessionId: string) => {
        try {
            await copilotApi.deleteSession(parseInt(sessionId));
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            if (activeSessionId === sessionId) {
                setActiveSessionId(null);
                setActiveMessages([]);
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    }, [activeSessionId]);

    const handleSendMessage = useCallback(async (
        content: string,
        files?: File[],
        options?: { useWebSearch?: boolean; agent?: Agent | null; mode?: 'general' | 'agents' }
    ) => {
        if (!content.trim() && (!files || files.length === 0)) return;

        const currentMode = options?.mode || mode;
        const currentAgent = options?.agent || selectedAgent;

        let currentSessionId = activeSessionId;

        // Create new session if none exists
        if (!currentSessionId) {
            try {
                const response = await copilotApi.createSession({ mode: currentMode });
                if (response.data.success) {
                    const newSession = toFrontendSession(response.data.session);
                    setSessions((prev) => [newSession, ...prev]);
                    currentSessionId = String(newSession.id);
                    setActiveSessionId(currentSessionId);
                }
            } catch (error) {
                console.error('Failed to create session:', error);
                return;
            }
        }

        let userContent = content;
        if (files && files.length > 0) {
            const fileNames = files.map(f => f.name).join(', ');
            userContent = content ? `${content}\n\n📎 Attached: ${fileNames}` : `📎 Attached: ${fileNames}`;
        }
        if (options?.useWebSearch) {
            userContent = `🌐 [Web Search] ${userContent}`;
        }

        const agentToUse = currentMode === 'agents' ? currentAgent : ALL_AGENTS.find(a => a.id === 'general-ai');

        // Add optimistic user message
        const tempUserMessage: ChatMessage = {
            id: `temp-user-${Date.now()}`,
            role: 'user',
            content: userContent,
            timestamp: new Date(),
            status: 'complete',
        };

        const tempAiMessage: ChatMessage = {
            id: `temp-ai-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            status: 'streaming',
            agentName: agentToUse?.name || (currentMode === 'agents' ? 'Multi-Agent' : 'General AI'),
            agentIcon: agentToUse?.icon || (currentMode === 'agents' ? '🤖' : '✨'),
        };

        setActiveMessages((prev) => [...prev, tempUserMessage, tempAiMessage]);
        setIsLoading(true);

        try {
            const response = await copilotApi.chat(parseInt(currentSessionId), {
                content: userContent,
                mode: currentMode,
                agent_id: currentAgent?.id,
                use_web_search: options?.useWebSearch || false,
            });

            const result = response.data;

            // Update with real messages from server
            if (result.userMessage && result.aiMessage) {
                setActiveMessages((prev) => {
                    const filtered = prev.filter(m => !m.id.startsWith('temp-'));
                    return [...filtered,
                    {
                        id: String(result.userMessage.id),
                        role: result.userMessage.role,
                        content: result.userMessage.content,
                        timestamp: new Date(result.userMessage.timestamp),
                        status: result.userMessage.status,
                    },
                    {
                        id: String(result.aiMessage.id),
                        role: result.aiMessage.role,
                        content: result.aiMessage.content,
                        agentName: result.aiMessage.agentName,
                        agentIcon: result.aiMessage.agentIcon,
                        timestamp: new Date(result.aiMessage.timestamp),
                        status: result.aiMessage.status,
                    }
                    ];
                });
            }

            // Update session title in list
            await loadSessions();

        } catch (error: any) {
            console.error('CoPilot chat error:', error);
            const errorMessage = error.response?.data?.error || error.message || 'An error occurred';

            setActiveMessages((prev) =>
                prev.map((msg) =>
                    msg.id === tempAiMessage.id
                        ? { ...msg, content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`, status: 'error' }
                        : msg
                )
            );
        } finally {
            setIsLoading(false);
        }
    }, [activeSessionId, mode, selectedAgent]);

    return (
        <div className={clsx('flex h-full bg-white', className)}>
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden fixed top-20 left-4 z-50 p-2.5 rounded-xl bg-gray-900 text-white shadow-lg hover:bg-gray-800"
            >
                {sidebarOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
            </button>

            <div className={clsx(
                'fixed lg:relative inset-y-0 left-0 z-40 transform transition-transform duration-300',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:hidden'
            )}>
                <ChatSidebar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onNewChat={handleNewChat}
                    onSelectSession={handleSelectSession}
                    onDeleteSession={handleDeleteSession}
                />
            </div>

            {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 h-full">
                <ChatWindow
                    messages={activeMessages}
                    isLoading={isLoading}
                    showWelcome={!activeSessionId}
                />
                <ChatInput
                    onSend={handleSendMessage}
                    disabled={isLoading}
                    mode={mode}
                    onModeChange={setMode}
                    selectedAgent={selectedAgent}
                    onAgentChange={setSelectedAgent}
                />
            </div>
        </div>
    );
}
