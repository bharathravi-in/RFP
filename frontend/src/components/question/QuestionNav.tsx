import clsx from 'clsx';
import {
    CheckCircleIcon,
    ExclamationCircleIcon,
    ClockIcon,
    PencilIcon,
} from '@heroicons/react/24/outline';
import { Question } from '@/types';

interface QuestionNavProps {
    questions: Question[];
    selectedId?: number;
    onSelect: (question: Question) => void;
    className?: string;
}

export default function QuestionNav({
    questions,
    selectedId,
    onSelect,
    className,
}: QuestionNavProps) {
    // Group by section
    const grouped = questions.reduce((acc, q) => {
        const section = q.section || 'General';
        if (!acc[section]) acc[section] = [];
        acc[section].push(q);
        return acc;
    }, {} as Record<string, Question[]>);

    return (
        <nav className={clsx('space-y-4', className)}>
            {Object.entries(grouped).map(([section, sectionQuestions]) => (
                <div key={section}>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">
                        {section}
                    </h4>
                    <div className="space-y-1">
                        {sectionQuestions.map((question) => (
                            <QuestionNavItem
                                key={question.id}
                                question={question}
                                isSelected={question.id === selectedId}
                                onClick={() => onSelect(question)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </nav>
    );
}

interface QuestionNavItemProps {
    question: Question;
    isSelected: boolean;
    onClick: () => void;
}

function QuestionNavItem({ question, isSelected, onClick }: QuestionNavItemProps) {
    const statusConfig = {
        pending: {
            icon: ClockIcon,
            color: 'text-text-muted',
            bg: 'bg-gray-100',
        },
        answered: {
            icon: PencilIcon,
            color: 'text-warning',
            bg: 'bg-warning-light',
        },
        approved: {
            icon: CheckCircleIcon,
            color: 'text-success',
            bg: 'bg-success-light',
        },
        rejected: {
            icon: ExclamationCircleIcon,
            color: 'text-error',
            bg: 'bg-error-light',
        },
    };

    const status = statusConfig[question.status as keyof typeof statusConfig] || statusConfig.pending;
    const StatusIcon = status.icon;

    return (
        <button
            onClick={onClick}
            className={clsx(
                'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                isSelected
                    ? 'bg-primary-light border border-primary'
                    : 'hover:bg-background border border-transparent'
            )}
        >
            <div className={clsx('flex-shrink-0 p-1 rounded-md', status.bg)}>
                <StatusIcon className={clsx('h-4 w-4', status.color)} />
            </div>
            <div className="flex-1 min-w-0">
                <p className={clsx(
                    'text-sm font-medium line-clamp-2',
                    isSelected ? 'text-primary' : 'text-text-primary'
                )}>
                    {question.text}
                </p>
                {question.answer && (
                    <p className="text-xs text-text-muted mt-1">
                        {question.answer.confidence_score
                            ? `${Math.round(question.answer.confidence_score * 100)}% confident`
                            : 'Answered'}
                    </p>
                )}
            </div>
        </button>
    );
}
