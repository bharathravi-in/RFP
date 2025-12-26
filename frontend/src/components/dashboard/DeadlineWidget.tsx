import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/client';
import clsx from 'clsx';
import {
    CalendarDaysIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';

interface Deadline {
    project_id: number;
    project_name: string;
    due_date: string;
    days_remaining: number;
    status: string;
    completion_percent: number;
    urgency: 'overdue' | 'due_today' | 'critical' | 'warning' | 'normal';
    client_name?: string;
}

export default function DeadlineWidget() {
    const [deadlines, setDeadlines] = useState<Deadline[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDeadlines();
    }, []);

    const loadDeadlines = async () => {
        try {
            const response = await projectsApi.getUpcomingDeadlines(14);
            setDeadlines(response.data.deadlines || []);
        } catch (error) {
            console.error('Failed to load deadlines:', error);
        } finally {
            setLoading(false);
        }
    };

    const getUrgencyStyles = (urgency: Deadline['urgency']) => {
        switch (urgency) {
            case 'overdue':
                return {
                    bg: 'bg-error-light',
                    text: 'text-error',
                    icon: ExclamationTriangleIcon,
                    label: 'Overdue',
                };
            case 'due_today':
                return {
                    bg: 'bg-error-light',
                    text: 'text-error',
                    icon: ClockIcon,
                    label: 'Due Today',
                };
            case 'critical':
                return {
                    bg: 'bg-warning-light',
                    text: 'text-warning-dark',
                    icon: ClockIcon,
                    label: 'Critical',
                };
            case 'warning':
                return {
                    bg: 'bg-warning-light',
                    text: 'text-warning-dark',
                    icon: CalendarDaysIcon,
                    label: 'Soon',
                };
            default:
                return {
                    bg: 'bg-primary-light',
                    text: 'text-primary',
                    icon: CalendarDaysIcon,
                    label: 'Upcoming',
                };
        }
    };

    const formatDueDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-text-primary">Upcoming Deadlines</h3>
                </div>
                {deadlines.length > 0 && (
                    <span className="text-xs text-text-muted">
                        {deadlines.length} project{deadlines.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {deadlines.length === 0 ? (
                <div className="text-center py-6">
                    <CheckCircleIcon className="h-12 w-12 mx-auto text-success mb-2" />
                    <p className="text-text-secondary text-sm">No upcoming deadlines</p>
                    <p className="text-text-muted text-xs mt-1">You're all caught up!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {deadlines.slice(0, 5).map((deadline) => {
                        const styles = getUrgencyStyles(deadline.urgency);
                        const UrgencyIcon = styles.icon;

                        return (
                            <Link
                                key={deadline.project_id}
                                to={`/projects/${deadline.project_id}`}
                                className="block p-3 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all group"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span
                                                className={clsx(
                                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                                    styles.bg,
                                                    styles.text
                                                )}
                                            >
                                                <UrgencyIcon className="h-3 w-3" />
                                                {deadline.days_remaining < 0
                                                    ? `${Math.abs(deadline.days_remaining)}d overdue`
                                                    : deadline.days_remaining === 0
                                                        ? 'Today'
                                                        : `${deadline.days_remaining}d left`}
                                            </span>
                                        </div>
                                        <h4 className="font-medium text-text-primary text-sm truncate group-hover:text-primary transition-colors">
                                            {deadline.project_name}
                                        </h4>
                                        {deadline.client_name && (
                                            <p className="text-xs text-text-muted truncate">
                                                {deadline.client_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-xs text-text-secondary font-medium">
                                            {formatDueDate(deadline.due_date)}
                                        </p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary rounded-full"
                                                    style={{ width: `${deadline.completion_percent}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-text-muted">
                                                {deadline.completion_percent.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}

                    {deadlines.length > 5 && (
                        <Link
                            to="/projects"
                            className="flex items-center justify-center gap-1 p-2 text-sm text-primary hover:text-primary-700 transition-colors"
                        >
                            View all {deadlines.length} projects
                            <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
