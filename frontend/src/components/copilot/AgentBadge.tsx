import clsx from 'clsx';

interface AgentBadgeProps {
    name: string;
    icon?: string;
    color?: string;
    size?: 'sm' | 'md';
}

const COLOR_CLASSES: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    red: 'bg-red-100 text-red-700 border-red-200',
};

export default function AgentBadge({ name, icon, color = 'gray', size = 'sm' }: AgentBadgeProps) {
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1 rounded-full border font-medium',
                COLOR_CLASSES[color] || COLOR_CLASSES.gray,
                size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
            )}
        >
            {icon && <span>{icon}</span>}
            {name}
        </span>
    );
}
