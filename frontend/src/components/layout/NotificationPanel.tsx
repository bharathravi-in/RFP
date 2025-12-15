import { useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useNotificationStore, Notification, NotificationType } from '@/store/notificationStore';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } =
        useNotificationStore();

    const typeStyles: Record<NotificationType, string> = {
        info: 'bg-primary-light border-l-primary',
        success: 'bg-success-light border-l-success',
        warning: 'bg-warning-light border-l-warning',
        error: 'bg-error-light border-l-error',
    };

    return (
        <div className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-background transition-colors"
            >
                <BellIcon className="h-5 w-5 text-text-secondary" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-xl shadow-modal z-50 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <h3 className="font-medium text-text-primary">Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="py-8 text-center text-text-muted text-sm">
                                    No notifications yet
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        typeStyles={typeStyles}
                                        onRead={() => markAsRead(notification.id)}
                                        onClear={() => clearNotification(notification.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

interface NotificationItemProps {
    notification: Notification;
    typeStyles: Record<NotificationType, string>;
    onRead: () => void;
    onClear: () => void;
}

function NotificationItem({
    notification,
    typeStyles,
    onRead,
    onClear,
}: NotificationItemProps) {
    return (
        <div
            className={clsx(
                'px-4 py-3 border-l-4 border-b border-border hover:bg-background/50 transition-colors cursor-pointer',
                typeStyles[notification.type],
                !notification.read && 'bg-opacity-50'
            )}
            onClick={onRead}
        >
            <div className="flex items-start justify-between gap-2">
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
                        {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClear();
                    }}
                    className="text-text-muted hover:text-text-secondary p-1"
                >
                    ×
                </button>
            </div>
        </div>
    );
}
