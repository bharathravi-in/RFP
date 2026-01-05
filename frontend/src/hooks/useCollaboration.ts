/**
 * Real-time Collaboration Hook
 * Connects to WebSocket for live presence, cursor tracking, and content sync
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

export interface ActiveUser {
    user_id: number;
    name: string;
    status: 'online' | 'away' | 'busy';
    cursor?: {
        section_id: number;
        field?: string;
    };
    joined_at: string;
}

export interface CursorPosition {
    sid: string;
    user_id: number;
    name: string;
    cursor: {
        section_id: number;
        field?: string;
    };
}

export interface SectionLock {
    section_id: number;
    user_id: number;
    user_name: string;
    locked_at: string;
}

export interface ContentChange {
    section_id: number;
    user_id: number;
    user_name: string;
    content: string;
    timestamp: string;
}

interface UseCollaborationOptions {
    projectId: number;
    onPresenceUpdate?: (users: Record<string, ActiveUser>) => void;
    onCursorUpdate?: (cursor: CursorPosition) => void;
    onContentChange?: (change: ContentChange) => void;
    onSectionLocked?: (lock: SectionLock) => void;
    onSectionUnlocked?: (sectionId: number) => void;
    onTypingStart?: (data: { user_id: number; user_name: string; section_id: number }) => void;
    onTypingEnd?: (data: { user_id: number; section_id: number }) => void;
}

export function useCollaboration({
    projectId,
    onPresenceUpdate,
    onCursorUpdate,
    onContentChange,
    onSectionLocked,
    onSectionUnlocked,
    onTypingStart,
    onTypingEnd,
}: UseCollaborationOptions) {
    const socketRef = useRef<Socket | null>(null);
    const { user } = useAuthStore();
    const [isConnected, setIsConnected] = useState(false);
    const [activeUsers, setActiveUsers] = useState<Record<string, ActiveUser>>({});
    const [sectionLocks, setSectionLocks] = useState<Record<number, SectionLock>>({});

    // Connect to WebSocket
    useEffect(() => {
        if (!projectId || !user) return;

        const socket = io(window.location.origin, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            // Join the project room
            socket.emit('join_project', {
                project_id: projectId,
                user_id: user.id,
                user_name: user.name,
            });
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        // Presence updates
        socket.on('presence_update', (users: Record<string, ActiveUser>) => {
            setActiveUsers(users);
            onPresenceUpdate?.(users);
        });

        // Cursor updates from other users
        socket.on('cursor_update', (cursor: CursorPosition) => {
            onCursorUpdate?.(cursor);
        });

        // Content changes from other users
        socket.on('content_update', (change: ContentChange) => {
            onContentChange?.(change);
        });

        // Section lock events
        socket.on('section_locked', (lock: SectionLock) => {
            setSectionLocks(prev => ({
                ...prev,
                [lock.section_id]: lock,
            }));
            onSectionLocked?.(lock);
        });

        socket.on('section_unlocked', (data: { section_id: number }) => {
            setSectionLocks(prev => {
                const newLocks = { ...prev };
                delete newLocks[data.section_id];
                return newLocks;
            });
            onSectionUnlocked?.(data.section_id);
        });

        // Receive all existing locks on join
        socket.on('all_locks', (locks: Record<number, SectionLock>) => {
            setSectionLocks(locks);
        });

        // Typing indicators
        socket.on('typing_start', (data: { user_id: number; user_name: string; section_id: number }) => {
            onTypingStart?.(data);
        });

        socket.on('typing_end', (data: { user_id: number; section_id: number }) => {
            onTypingEnd?.(data);
        });

        return () => {
            socket.emit('leave_project', { project_id: projectId });
            socket.disconnect();
        };
    }, [projectId, user?.id]);

    // Move cursor
    const moveCursor = useCallback((sectionId: number, field?: string) => {
        if (!socketRef.current || !isConnected) return;
        socketRef.current.emit('cursor_move', {
            project_id: projectId,
            cursor: { section_id: sectionId, field },
        });
    }, [projectId, isConnected]);

    // Broadcast content change
    const broadcastContentChange = useCallback((sectionId: number, content: string) => {
        if (!socketRef.current || !isConnected) return;
        socketRef.current.emit('content_change', {
            project_id: projectId,
            section_id: sectionId,
            content,
        });
    }, [projectId, isConnected]);

    // Lock a section
    const lockSection = useCallback((sectionId: number) => {
        if (!socketRef.current || !isConnected) return;
        socketRef.current.emit('lock_section', {
            project_id: projectId,
            section_id: sectionId,
        });
    }, [projectId, isConnected]);

    // Unlock a section
    const unlockSection = useCallback((sectionId: number) => {
        if (!socketRef.current || !isConnected) return;
        socketRef.current.emit('unlock_section', {
            project_id: projectId,
            section_id: sectionId,
        });
    }, [projectId, isConnected]);

    // Typing indicator
    const startTyping = useCallback((sectionId: number) => {
        if (!socketRef.current || !isConnected) return;
        socketRef.current.emit('typing_start', {
            project_id: projectId,
            section_id: sectionId,
        });
    }, [projectId, isConnected]);

    const stopTyping = useCallback((sectionId: number) => {
        if (!socketRef.current || !isConnected) return;
        socketRef.current.emit('typing_stop', {
            project_id: projectId,
            section_id: sectionId,
        });
    }, [projectId, isConnected]);

    // Check if section is locked by another user
    const isSectionLocked = useCallback((sectionId: number): SectionLock | null => {
        const lock = sectionLocks[sectionId];
        if (lock && lock.user_id !== user?.id) {
            return lock;
        }
        return null;
    }, [sectionLocks, user?.id]);

    return {
        isConnected,
        activeUsers,
        sectionLocks,
        moveCursor,
        broadcastContentChange,
        lockSection,
        unlockSection,
        startTyping,
        stopTyping,
        isSectionLocked,
    };
}

export default useCollaboration;
