import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
    DocumentTextIcon,
    CheckCircleIcon,
    PencilSquareIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';

interface Section {
    id: number;
    title: string;
    type_name: string;
    type_icon?: string;
    status: 'draft' | 'generated' | 'approved' | 'rejected';
    has_content: boolean;
    word_count?: number;
}

interface SectionCompletionWidgetProps {
    projectId: number;
    sections: Section[];
    className?: string;
}

export default function SectionCompletionWidget({
    projectId,
    sections,
    className = ''
}: SectionCompletionWidgetProps) {
    const totalSections = sections.length;
    const completedSections = sections.filter(s => s.has_content).length;
    const approvedSections = sections.filter(s => s.status === 'approved').length;
    const completionPercent = totalSections > 0
        ? Math.round((completedSections / totalSections) * 100)
        : 0;

    return (
        <div className={clsx('card p-5', className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-text-primary">
                        Section Completion
                    </h3>
                    <p className="text-sm text-text-secondary">
                        {completedSections}/{totalSections} sections complete
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-bold text-primary">
                        {completionPercent}%
                    </span>
                    <p className="text-xs text-text-muted">
                        {approvedSections} approved
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                    className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${completionPercent}%` }}
                />
            </div>

            {/* Sections Grid */}
            {sections.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {sections.slice(0, 6).map(section => (
                        <Link
                            key={section.id}
                            to={`/projects/${projectId}/proposal?section=${section.id}`}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-background transition-colors group"
                        >
                            <span className="text-base flex-shrink-0">
                                {section.type_icon || '📄'}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text-primary truncate group-hover:text-primary transition-colors">
                                    {section.title}
                                </p>
                                <StatusBadge status={section.status} />
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-4 text-text-muted text-sm">
                    <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No sections yet
                </div>
            )}

            {/* View All Link */}
            {sections.length > 6 && (
                <div className="mt-3 pt-3 border-t border-border text-center">
                    <Link
                        to={`/projects/${projectId}/proposal`}
                        className="text-sm text-primary hover:underline"
                    >
                        View all {sections.length} sections
                    </Link>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config = {
        draft: { icon: PencilSquareIcon, color: 'text-gray-400', label: 'Draft' },
        generated: { icon: SparklesIcon, color: 'text-purple-500', label: 'AI' },
        approved: { icon: CheckCircleIcon, color: 'text-green-500', label: 'Done' },
        rejected: { icon: DocumentTextIcon, color: 'text-red-400', label: 'Redo' },
    };

    const { icon: Icon, color, label } = config[status as keyof typeof config] || config.draft;

    return (
        <div className={clsx('flex items-center gap-1 text-xs', color)}>
            <Icon className="h-3 w-3" />
            <span>{label}</span>
        </div>
    );
}
