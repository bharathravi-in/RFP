/**
 * In-app notification service for real-time updates.
 * This is a simple implementation that can be extended with WebSockets.
 */

import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    timestamp: Date;
    read: boolean;
    actionUrl?: string;
}

interface NotificationStore {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearNotification: (id: string) => void;
    clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    unreadCount: 0,

    addNotification: (notification) => {
        const newNotification: Notification = {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date(),
            read: false,
        };

        set((state) => ({
            notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
            unreadCount: state.unreadCount + 1,
        }));
    },

    markAsRead: (id) => {
        set((state) => ({
            notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
        }));
    },

    markAllAsRead: () => {
        set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
        }));
    },

    clearNotification: (id) => {
        set((state) => {
            const notification = state.notifications.find((n) => n.id === id);
            return {
                notifications: state.notifications.filter((n) => n.id !== id),
                unreadCount: notification && !notification.read
                    ? Math.max(0, state.unreadCount - 1)
                    : state.unreadCount,
            };
        });
    },

    clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
    },
}));

// Helper functions for common notifications
export const notify = {
    success: (title: string, message?: string) => {
        useNotificationStore.getState().addNotification({
            type: 'success',
            title,
            message,
        });
    },

    error: (title: string, message?: string) => {
        useNotificationStore.getState().addNotification({
            type: 'error',
            title,
            message,
        });
    },

    info: (title: string, message?: string) => {
        useNotificationStore.getState().addNotification({
            type: 'info',
            title,
            message,
        });
    },

    warning: (title: string, message?: string) => {
        useNotificationStore.getState().addNotification({
            type: 'warning',
            title,
            message,
        });
    },

    // Specific notification shortcuts
    answerGenerated: (questionText: string) => {
        notify.success('Answer Generated', `AI answer ready for: "${questionText.slice(0, 50)}..."`);
    },

    reviewAssigned: (projectName: string) => {
        notify.info('Review Assigned', `You've been assigned to review ${projectName}`);
    },

    commentAdded: (userName: string) => {
        notify.info('New Comment', `${userName} commented on your answer`);
    },

    exportReady: (format: string) => {
        notify.success('Export Ready', `Your ${format.toUpperCase()} export is ready for download`);
    },
};
