/**
 * Collaboration Presence Component
 * 
 * Displays active collaborators, typing indicators, and section locks
 * for real-time collaboration in the proposal builder.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import { UsersIcon, LockClosedIcon, PencilIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface ActiveUser {
    user_id: number;
    name: string;
    status: string;
    cursor?: {
        section_id: number;
        field?: string;
    };
    joined_at?: string;
}

interface SectionLock {
    user_id: number;
    user_name: string;
    locked_at: string;
}

interface TypingUser {
    user_id: number;
    user_name: string;
}

interface CollaborationPresenceProps {
    projectId: number;
    currentSectionId?: number;
    onContentChange?: (sectionId: number, content: string, userId: number) => void;
    className?: string;
}

// Generate consistent color for user avatar
const getUserColor = (userId: number) => {
    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
        'bg-yellow-500', 'bg-red-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return colors[userId % colors.length];
};

export function CollaborationPresence({
    projectId,
    currentSectionId,
    onContentChange,
    className
}: CollaborationPresenceProps) {
    const { user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeUsers, setActiveUsers] = useState<Record<string, ActiveUser>>({});
    const [sectionLocks, setSectionLocks] = useState<Record<number, SectionLock>>({});
    const [typingUsers, setTypingUsers] = useState<Record<number, TypingUser[]>>({});
    const [isConnected, setIsConnected] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize socket connection
    useEffect(() => {
        const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001';
        const newSocket = io(socketUrl, {
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
            console.log('Socket connected for collaboration');

            // Join project room
            newSocket.emit('join_project', {
                project_id: projectId,
                user_id: user?.id,
                user_name: user?.firstName || user?.email || 'Anonymous'
            });
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
        });

        // Presence updates
        newSocket.on('presence_update', (users: Record<string, ActiveUser>) => {
            setActiveUsers(users);
        });

        // Section locks
        newSocket.on('all_locks', (locks: Record<number, SectionLock>) => {
            setSectionLocks(locks);
        });

        newSocket.on('section_locked', (data: { section_id: number; user_id: number; user_name: string }) => {
            setSectionLocks(prev => ({
                ...prev,
                [data.section_id]: {
                    user_id: data.user_id,
                    user_name: data.user_name,
                    locked_at: new Date().toISOString()
                }
            }));
        });

        newSocket.on('section_unlocked', (data: { section_id: number }) => {
            setSectionLocks(prev => {
                const next = { ...prev };
                delete next[data.section_id];
                return next;
            });
        });

        // Typing indicators
        newSocket.on('typing_indicator', (data: { section_id: number; typing_users: TypingUser[] }) => {
            setTypingUsers(prev => ({
                ...prev,
                [data.section_id]: data.typing_users
            }));
        });

        // Remote content changes
        newSocket.on('remote_content_change', (data: {
            section_id: number;
            content: string;
            user_id: number;
            user_name: string;
        }) => {
            if (onContentChange) {
                onContentChange(data.section_id, data.content, data.user_id);
            }
        });

        // Conflict detection
        newSocket.on('conflict_detected', (data: {
            section_id: number;
            locked_by: string;
            your_content: string;
        }) => {
            alert(`Conflict detected! Section ${data.section_id} is being edited by ${data.locked_by}. Your changes may be overwritten.`);
        });

        setSocket(newSocket);

        return () => {
            newSocket.emit('leave_project', { project_id: projectId });
            newSocket.disconnect();
        };
    }, [projectId, user?.id]);

    // Emit typing start/stop
    const emitTypingStart = useCallback((sectionId: number) => {
        if (!socket || !user) return;

        socket.emit('typing_start', {
            project_id: projectId,
            section_id: sectionId,
            user_id: user.id,
            user_name: user.firstName || user.email
        });

        // Auto-stop after 2 seconds of no typing
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            emitTypingStop(sectionId);
        }, 2000);
    }, [socket, user, projectId]);

    const emitTypingStop = useCallback((sectionId: number) => {
        if (!socket || !user) return;

        socket.emit('typing_stop', {
            project_id: projectId,
            section_id: sectionId,
            user_id: user.id
        });
    }, [socket, user, projectId]);

    // Lock/unlock section
    const lockSection = useCallback((sectionId: number) => {
        if (!socket || !user) return;

        socket.emit('lock_section', {
            project_id: projectId,
            section_id: sectionId,
            user_id: user.id,
            user_name: user.firstName || user.email
        });
    }, [socket, user, projectId]);

    const unlockSection = useCallback((sectionId: number) => {
        if (!socket || !user) return;

        socket.emit('unlock_section', {
            project_id: projectId,
            section_id: sectionId,
            user_id: user.id
        });
    }, [socket, user, projectId]);

    // Emit content change
    const emitContentChange = useCallback((sectionId: number, content: string) => {
        if (!socket || !user) return;

        socket.emit('content_change', {
            project_id: projectId,
            section_id: sectionId,
            content,
            user_id: user.id,
            user_name: user.firstName || user.email
        });
    }, [socket, user, projectId]);

    const otherUsers = Object.values(activeUsers).filter(u => u.user_id !== user?.id);
    const currentSectionTyping = currentSectionId ? typingUsers[currentSectionId] || [] : [];
    const currentSectionLock = currentSectionId ? sectionLocks[currentSectionId] : null;

    return (
        <div className={clsx('flex items-center gap-3', className)}>
            {/* Connection status */}
            <div className={clsx(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
            )} title={isConnected ? 'Connected' : 'Disconnected'} />

            {/* Active collaborators */}
            {otherUsers.length > 0 && (
                <div className="flex items-center gap-1">
                    <UsersIcon className="w-4 h-4 text-gray-500" />
                    <div className="flex -space-x-2">
                        {otherUsers.slice(0, 5).map((u, idx) => (
                            <div
                                key={u.user_id}
                                className={clsx(
                                    'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white',
                                    getUserColor(u.user_id)
                                )}
                                title={u.name}
                            >
                                {u.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                        ))}
                        {otherUsers.length > 5 && (
                            <div className="w-7 h-7 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                                +{otherUsers.length - 5}
                            </div>
                        )}
                    </div>
                    <span className="text-xs text-gray-500 ml-1">
                        {otherUsers.length} online
                    </span>
                </div>
            )}

            {/* Section lock indicator */}
            {currentSectionLock && currentSectionLock.user_id !== user?.id && (
                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 rounded-lg text-xs text-yellow-800">
                    <LockClosedIcon className="w-3 h-3" />
                    <span>Locked by {currentSectionLock.user_name}</span>
                </div>
            )}

            {/* Typing indicator */}
            {currentSectionTyping.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-lg text-xs text-blue-800">
                    <PencilIcon className="w-3 h-3 animate-pulse" />
                    <span>
                        {currentSectionTyping.map(u => u.user_name).join(', ')} typing...
                    </span>
                </div>
            )}
        </div>
    );
}

// Export hooks for use in other components
export function useCollaboration(projectId: number) {
    const { user } = useAuth();
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001';
        socketRef.current = io(socketUrl, { transports: ['websocket', 'polling'] });

        socketRef.current.emit('join_project', {
            project_id: projectId,
            user_id: user?.id,
            user_name: user?.firstName || user?.email
        });

        return () => {
            socketRef.current?.emit('leave_project', { project_id: projectId });
            socketRef.current?.disconnect();
        };
    }, [projectId, user?.id]);

    return {
        emitTyping: (sectionId: number) => {
            socketRef.current?.emit('typing_start', {
                project_id: projectId,
                section_id: sectionId,
                user_id: user?.id,
                user_name: user?.firstName || user?.email
            });
        },
        emitContentChange: (sectionId: number, content: string) => {
            socketRef.current?.emit('content_change', {
                project_id: projectId,
                section_id: sectionId,
                content,
                user_id: user?.id,
                user_name: user?.firstName || user?.email
            });
        },
        lockSection: (sectionId: number) => {
            socketRef.current?.emit('lock_section', {
                project_id: projectId,
                section_id: sectionId,
                user_id: user?.id,
                user_name: user?.firstName || user?.email
            });
        },
        unlockSection: (sectionId: number) => {
            socketRef.current?.emit('unlock_section', {
                project_id: projectId,
                section_id: sectionId,
                user_id: user?.id
            });
        }
    };
}

export default CollaborationPresence;
