import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
// Note: if you see resolution errors, ensure socket.io-client is in node_modules
import { useAuthStore } from "@/store/authStore";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface RemoteUser {
    sid: string;
    user_id: number;
    name: string;
    cursor?: {
        section_id: number;
        field: string;
    } | null;
}

export function useRealTime(projectId: number | string | undefined) {
    const { user } = useAuthStore();
    const socketRef = useRef<Socket | null>(null);
    const [activeUsers, setActiveUsers] = useState<Record<string, RemoteUser>>({});
    const [lastRemoteChange, setLastRemoteChange] = useState<any>(null);

    useEffect(() => {
        if (!projectId || !user) return;

        // Initialize socket
        const socket = io(SOCKET_URL, {
            path: '/socket.io',
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Socket connected');
            socket.emit('join_project', {
                project_id: projectId,
                user_id: user.id,
                user_name: user.name
            });
        });

        socket.on('presence_update', (users: Record<string, any>) => {
            // Filter out self if desired, but here we'll keep everything and filter in UI
            setActiveUsers(users);
        });

        socket.on('cursor_update', (data: RemoteUser) => {
            setActiveUsers(prev => ({
                ...prev,
                [data.sid]: data
            }));
        });

        socket.on('remote_content_change', (data: any) => {
            setLastRemoteChange(data);
        });

        return () => {
            socket.emit('leave_project', { project_id: projectId });
            socket.disconnect();
        };
    }, [projectId, user]);

    const updateCursor = useCallback((sectionId: number, field: string) => {
        if (socketRef.current) {
            socketRef.current.emit('cursor_move', {
                project_id: projectId,
                cursor: { section_id: sectionId, field }
            });
        }
    }, [projectId]);

    const broadcastChange = useCallback((sectionId: number, content: string) => {
        if (socketRef.current) {
            socketRef.current.emit('content_change', {
                project_id: projectId,
                section_id: sectionId,
                content,
                user_id: user?.id,
                user_name: user?.name
            });
        }
    }, [projectId, user]);

    return {
        activeUsers,
        updateCursor,
        broadcastChange,
        lastRemoteChange
    };
}
