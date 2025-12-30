import { useState, useEffect } from 'react';
import { BellIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { notificationsApi } from '@/api/client';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    link?: string;
    read: boolean;
    created_at: string;
    actor_name?: string;
}

/**
 * Notification bell for header, shows unread count and dropdown.
 */
export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
        // Poll for new notifications every 30 seconds
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadNotifications = async () => {
        try {
            const [listRes, countRes] = await Promise.all([
                notificationsApi.list({ limit: 10 }),
                notificationsApi.unreadCount()
            ]);
            setNotifications(listRes.data.notifications || []);
            setUnreadCount(countRes.data.count || 0);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const res = await notificationsApi.unreadCount();
            setUnreadCount(res.data.count || 0);
        } catch {
            // Silent fail for background polling
        }
    };

    const markAsRead = async (id: number) => {
        try {
            await notificationsApi.markRead(id);
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const markAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        if (notification.link) {
            window.location.href = notification.link;
        }
        setIsOpen(false);
    };

    const getTimeAgo = (dateStr: string) => {
        const now = new Date();
        const date = new Date(dateStr);
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const getTypeIcon = (type: string) => {
        const icons: Record<string, string> = {
            mention: '💬',
            assignment: '📋',
            comment: '💭',
            approval: '✅',
            deadline: '⏰',
        };
        return icons[type] || '🔔';
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
                {unreadCount > 0 ? (
                    <BellSolidIcon className="h-5 w-5 text-primary" />
                ) : (
                    <BellIcon className="h-5 w-5 text-gray-500" />
                )}

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900">Notifications</h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Mark all read
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)}>
                                    <XMarkIcon className="h-4 w-4 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="max-h-80 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-6 text-center">
                                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-6 text-center">
                                    <BellIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No notifications yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {notifications.map((notification) => (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={clsx(
                                                'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                                                !notification.read && 'bg-primary/5'
                                            )}
                                        >
                                            <div className="flex gap-3">
                                                <span className="text-lg flex-shrink-0">
                                                    {getTypeIcon(notification.type)}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={clsx(
                                                        'text-sm line-clamp-1',
                                                        !notification.read ? 'font-medium text-gray-900' : 'text-gray-700'
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                    {notification.message && (
                                                        <p className="text-xs text-gray-500 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {getTimeAgo(notification.created_at)}
                                                    </p>
                                                </div>
                                                {!notification.read && (
                                                    <span className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
