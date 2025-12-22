import clsx from 'clsx';
import {
    FolderIcon,
    DocumentTextIcon,
    ChatBubbleLeftRightIcon,
    CheckBadgeIcon,
    BookOpenIcon,
    ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

interface Stat {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    trend?: number;
}

interface DashboardStatsProps {
    stats: {
        total_projects: number;
        active_projects: number;
        total_questions: number;
        answered_questions: number;
        approved_answers: number;
        knowledge_items: number;
        answer_rate?: number;
        approval_rate?: number;
    };
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
    const items: Stat[] = [
        {
            label: 'Total Projects',
            value: stats.total_projects,
            icon: FolderIcon,
            color: 'bg-primary-light text-primary',
        },
        {
            label: 'Active Projects',
            value: stats.active_projects,
            icon: DocumentTextIcon,
            color: 'bg-warning-light text-warning',
        },
        {
            label: 'Questions',
            value: stats.total_questions,
            icon: ChatBubbleLeftRightIcon,
            color: 'bg-purple-100 text-purple-600',
        },
        {
            label: 'Approved Answers',
            value: stats.approved_answers,
            icon: CheckBadgeIcon,
            color: 'bg-success-light text-success',
        },
        {
            label: 'Knowledge Items',
            value: stats.knowledge_items,
            icon: BookOpenIcon,
            color: 'bg-cyan-100 text-cyan-600',
        },
        {
            label: 'Approval Rate',
            value: `${stats.approval_rate || 0}%`,
            icon: ArrowTrendingUpIcon,
            color: 'bg-green-100 text-green-600',
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {items.map((item) => (
                <StatCard key={item.label} stat={item} />
            ))}
        </div>
    );
}

function StatCard({ stat }: { stat: Stat }) {
    const Icon = stat.icon;

    return (
        <div className="card p-4 hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        {stat.label}
                    </p>
                    <p className="text-2xl font-bold text-text-primary mt-1">
                        {stat.value}
                    </p>
                </div>
                <div className={clsx('p-2 rounded-lg', stat.color)}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

// Activity Chart Component
interface ActivityChartProps {
    activity: Array<{ date: string; day: string; answers: number }>;
}

export function ActivityChart({ activity }: ActivityChartProps) {
    const maxAnswers = Math.max(...activity.map((d) => d.answers), 1);

    return (
        <div className="card p-6">
            <h3 className="text-sm font-medium text-text-primary mb-4">
                Weekly Activity
            </h3>
            <div className="flex items-end justify-between gap-2 h-32">
                {activity.map((day) => (
                    <div key={day.date} className="flex-1 flex flex-col items-center">
                        <div
                            className="w-full bg-primary rounded-t transition-all hover:bg-primary-600"
                            style={{
                                height: `${(day.answers / maxAnswers) * 100}%`,
                                minHeight: day.answers > 0 ? '4px' : '0',
                            }}
                        />
                        <span className="text-xs text-text-muted mt-2">{day.day}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Progress Ring Component
interface ProgressRingProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    label?: string;
}

export function ProgressRing({
    percentage,
    size = 120,
    strokeWidth = 8,
    label,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    const color =
        percentage >= 80
            ? 'stroke-success'
            : percentage >= 50
                ? 'stroke-warning'
                : 'stroke-error';

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-gray-200"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={clsx('transition-all duration-500', color)}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-bold text-text-primary">
                    {Math.round(percentage)}%
                </span>
                {label && (
                    <span className="text-xs text-text-muted">{label}</span>
                )}
            </div>
        </div>
    );
}
