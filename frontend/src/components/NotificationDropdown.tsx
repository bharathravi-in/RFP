import { useState, useEffect, useRef } from 'react';
import { notificationsApi } from '@/api/client';
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import clsx from 'clsx';
import {
    BellIcon,
    CheckIcon,
    TrashIcon,
    UserIcon,
    ChatBubbleLeftIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid';

interface Notification {
    id: number;
    user_id: number;
    actor_id?: number;
    actor_name?: string;
    type: string;
    entity_type?: string;
    entity_id?: number;
    title: string;
    message?: string;
    link?: string;
    read: boolean;
    created_at: string;
}

export default function NotificationDropdown() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load notifications and unread count
    const loadNotifications = async () => {
        try {
            const [listResponse, countResponse] = await Promise.all([
                notificationsApi.list({ limit: 10 }),
                notificationsApi.getUnreadCount()
            ]);
            setNotifications(listResponse.data.notifications || []);
            setUnreadCount(countResponse.data.unread_count || 0);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    };

    // Initial load and polling
    useEffect(() => {
        loadNotifications();

        // Poll every 30 seconds
        pollingInterval.current = setInterval(loadNotifications, 30000);

        return () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
            }
        };
    }, []);

    // Mark single notification as read
    const handleMarkAsRead = async (notification: Notification) => {
        if (notification.read) return;

        try {
            await notificationsApi.markAsRead(notification.id);
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    // Mark all as read
    const handleMarkAllAsRead = async () => {
        try {
            await notificationsApi.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    // Delete notification
    const handleDelete = async (e: React.MouseEvent, notificationId: number) => {
        e.stopPropagation();
        try {
            await notificationsApi.delete(notificationId);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    // Navigate to link
    const handleClick = (notification: Notification) => {
        handleMarkAsRead(notification);
        if (notification.link) {
            window.location.href = notification.link;
        }
    };

    // Format relative time
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Get icon for notification type
    const getIcon = (type: string) => {
        switch (type) {
            case 'mention':
                return <UserIcon className="h-5 w-5 text-blue-500" />;
            case 'comment':
                return <ChatBubbleLeftIcon className="h-5 w-5 text-green-500" />;
            case 'assignment':
                return <ArrowRightIcon className="h-5 w-5 text-purple-500" />;
            default:
                return <BellIcon className="h-5 w-5 text-gray-400" />;
        }
    };

    return (
        <Popover className="relative">
            {({ open }) => (
                <>
                    <Popover.Button
                        className={clsx(
                            'relative p-2 rounded-lg transition-colors',
                            open ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 text-text-secondary'
                        )}
                    >
                        {unreadCount > 0 ? (
                            <BellSolidIcon className="h-6 w-6" />
                        ) : (
                            <BellIcon className="h-6 w-6" />
                        )}
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </Popover.Button>

                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-200"
                        enterFrom="opacity-0 translate-y-1"
                        enterTo="opacity-100 translate-y-0"
                        leave="transition ease-in duration-150"
                        leaveFrom="opacity-100 translate-y-0"
                        leaveTo="opacity-0 translate-y-1"
                    >
                        <Popover.Panel className="absolute right-0 z-50 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-border overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gray-50">
                                <h3 className="font-semibold text-text-primary">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllAsRead}
                                        className="text-sm text-primary hover:underline"
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>

                            {/* Notifications List */}
                            <div className="max-h-[400px] overflow-y-auto">
                                {loading ? (
                                    <div className="p-4 text-center text-text-muted">
                                        Loading...
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <BellIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                                        <p className="text-text-muted">No notifications yet</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                onClick={() => handleClick(notification)}
                                                className={clsx(
                                                    'flex gap-3 p-4 cursor-pointer transition-colors',
                                                    notification.read
                                                        ? 'bg-white hover:bg-gray-50'
                                                        : 'bg-blue-50 hover:bg-blue-100'
                                                )}
                                            >
                                                {/* Icon */}
                                                <div className="flex-shrink-0 mt-0.5">
                                                    {getIcon(notification.type)}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={clsx(
                                                        'text-sm',
                                                        notification.read ? 'text-text-secondary' : 'text-text-primary font-medium'
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                    {notification.message && (
                                                        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-text-muted mt-1">
                                                        {formatTime(notification.created_at)}
                                                    </p>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex-shrink-0 flex gap-1">
                                                    {!notification.read && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMarkAsRead(notification);
                                                            }}
                                                            className="p-1 hover:bg-white rounded transition-colors"
                                                            title="Mark as read"
                                                        >
                                                            <CheckIcon className="h-4 w-4 text-green-500" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => handleDelete(e, notification.id)}
                                                        className="p-1 hover:bg-white rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="h-4 w-4 text-red-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            {notifications.length > 0 && (
                                <div className="px-4 py-3 border-t border-border bg-gray-50 text-center">
                                    <a
                                        href="/settings?tab=notifications"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        View all notifications
                                    </a>
                                </div>
                            )}
                        </Popover.Panel>
                    </Transition>
                </>
            )}
        </Popover>
    );
}
