import { useState, useEffect } from 'react';
import { activityApi } from '@/api/client';
import clsx from 'clsx';
import {
    ClockIcon,
    FolderIcon,
    DocumentTextIcon,
    ChatBubbleLeftIcon,
    CheckCircleIcon,
    PencilIcon,
    ArrowDownTrayIcon,
    UserIcon,
} from '@heroicons/react/24/outline';

interface Activity {
    id: number;
    project_id?: number;
    user_id: number;
    user_name: string;
    action: string;
    entity_type: string;
    entity_id?: number;
    entity_name?: string;
    description?: string;
    extra_data?: Record<string, unknown>;
    created_at: string;
}

interface ActivityTimelineProps {
    projectId?: number;
    limit?: number;
    className?: string;
}

export default function ActivityTimeline({ projectId, limit = 10, className }: ActivityTimelineProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActivities();
    }, [projectId]);

    const loadActivities = async () => {
        try {
            setLoading(true);
            const response = projectId
                ? await activityApi.getProjectActivity(projectId, { limit })
                : await activityApi.getRecentActivity({ limit });
            setActivities(response.data.activities || []);
        } catch {
            // Silently fail for activity timeline
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action: string, entityType: string) => {
        const iconClass = "h-4 w-4";
        switch (action) {
            case 'created':
                return <FolderIcon className={clsx(iconClass, 'text-green-500')} />;
            case 'updated':
            case 'edited':
                return <PencilIcon className={clsx(iconClass, 'text-blue-500')} />;
            case 'approved':
            case 'completed':
                return <CheckCircleIcon className={clsx(iconClass, 'text-green-600')} />;
            case 'commented':
                return <ChatBubbleLeftIcon className={clsx(iconClass, 'text-purple-500')} />;
            case 'exported':
                return <ArrowDownTrayIcon className={clsx(iconClass, 'text-orange-500')} />;
            default:
                if (entityType === 'section') return <DocumentTextIcon className={clsx(iconClass, 'text-gray-500')} />;
                return <ClockIcon className={clsx(iconClass, 'text-gray-400')} />;
        }
    };

    const getActionText = (activity: Activity) => {
        const { action, entity_type, entity_name, user_name } = activity;
        const entityLabel = entity_name || entity_type;

        switch (action) {
            case 'created':
                return <><strong>{user_name}</strong> created {entityLabel}</>;
            case 'updated':
            case 'edited':
                return <><strong>{user_name}</strong> edited {entityLabel}</>;
            case 'approved':
                return <><strong>{user_name}</strong> approved {entityLabel}</>;
            case 'commented':
                return <><strong>{user_name}</strong> commented on {entityLabel}</>;
            case 'exported':
                return <><strong>{user_name}</strong> exported {entityLabel}</>;
            case 'status_changed':
                return <><strong>{user_name}</strong> changed status of {entityLabel}</>;
            default:
                return <><strong>{user_name}</strong> {action} {entityLabel}</>;
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className={clsx('animate-pulse space-y-3', className)}>
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200" />
                        <div className="flex-1">
                            <div className="h-4 w-3/4 bg-gray-200 rounded mb-1" />
                            <div className="h-3 w-1/4 bg-gray-100 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className={clsx('text-center py-8 text-text-muted', className)}>
                <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
            </div>
        );
    }

    return (
        <div className={clsx('space-y-1', className)}>
            {activities.map((activity, index) => (
                <div
                    key={activity.id}
                    className="flex gap-3 py-2 group"
                >
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                        <div className="p-1.5 bg-gray-100 rounded-full group-hover:bg-gray-200 transition-colors">
                            {getActionIcon(activity.action, activity.entity_type)}
                        </div>
                        {index < activities.length - 1 && (
                            <div className="w-px h-full bg-gray-200 mt-1" />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-3">
                        <p className="text-sm text-text-secondary line-clamp-2">
                            {getActionText(activity)}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                            {formatTime(activity.created_at)}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
