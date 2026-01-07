import React from 'react';
import { Link } from 'react-router-dom';
import {
    FolderIcon,
    DocumentTextIcon,
    BookOpenIcon,
    QuestionMarkCircleIcon,
    PlusIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface EmptyStateProps {
    /** Icon to display */
    icon?: React.ElementType;
    /** Main title */
    title: string;
    /** Description text */
    description: string;
    /** Primary action button */
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    /** Secondary action */
    secondaryAction?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Additional class names */
    className?: string;
}

/**
 * EmptyState - Consistent empty state component for lists and pages
 * 
 * Usage:
 * <EmptyState
 *   icon={FolderIcon}
 *   title="No projects yet"
 *   description="Create your first project to get started"
 *   action={{ label: "Create Project", href: "/projects?action=create" }}
 * />
 */
export default function EmptyState({
    icon: Icon = FolderIcon,
    title,
    description,
    action,
    secondaryAction,
    size = 'md',
    className,
}: EmptyStateProps) {
    const sizes = {
        sm: {
            container: 'py-8',
            icon: 'h-10 w-10',
            iconWrapper: 'h-16 w-16',
            title: 'text-base',
            description: 'text-sm',
        },
        md: {
            container: 'py-12',
            icon: 'h-12 w-12',
            iconWrapper: 'h-20 w-20',
            title: 'text-lg',
            description: 'text-sm',
        },
        lg: {
            container: 'py-16',
            icon: 'h-16 w-16',
            iconWrapper: 'h-24 w-24',
            title: 'text-xl',
            description: 'text-base',
        },
    };

    const s = sizes[size];

    const ActionButton = action?.href ? Link : 'button';

    return (
        <div className={clsx('text-center', s.container, className)}>
            {/* Icon */}
            <div
                className={clsx(
                    'mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4',
                    s.iconWrapper
                )}
            >
                <Icon className={clsx('text-gray-400', s.icon)} />
            </div>

            {/* Title */}
            <h3 className={clsx('font-semibold text-gray-900 mb-2', s.title)}>
                {title}
            </h3>

            {/* Description */}
            <p className={clsx('text-gray-500 max-w-sm mx-auto mb-6', s.description)}>
                {description}
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {action && (
                    <ActionButton
                        {...(action.href ? { to: action.href } : {})}
                        onClick={action.onClick}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        {action.label}
                    </ActionButton>
                )}

                {secondaryAction && (
                    <ActionButton
                        {...(secondaryAction.href ? { to: secondaryAction.href } : {})}
                        onClick={secondaryAction.onClick}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        {secondaryAction.label}
                        <ArrowRightIcon className="h-4 w-4" />
                    </ActionButton>
                )}
            </div>
        </div>
    );
}

// Preset empty states for common use cases
export const EmptyProjects = ({ onCreateClick }: { onCreateClick?: () => void }) => (
    <EmptyState
        icon={FolderIcon}
        title="No projects yet"
        description="Create your first RFP project to start generating proposals with AI assistance."
        action={{
            label: 'Create Project',
            href: '/projects?action=create',
            onClick: onCreateClick,
        }}
        secondaryAction={{
            label: 'Learn More',
            href: '/docs/getting-started',
        }}
    />
);

export const EmptyKnowledge = () => (
    <EmptyState
        icon={BookOpenIcon}
        title="Knowledge base is empty"
        description="Upload documents to build your knowledge base. The AI uses this content to generate accurate answers."
        action={{
            label: 'Upload Documents',
            href: '/knowledge',
        }}
    />
);

export const EmptyQuestions = () => (
    <EmptyState
        icon={QuestionMarkCircleIcon}
        title="No questions extracted"
        description="Upload an RFP document to automatically extract questions, or add questions manually."
        action={{
            label: 'Upload RFP',
        }}
        size="sm"
    />
);

export const EmptySections = ({ onAddClick }: { onAddClick?: () => void }) => (
    <EmptyState
        icon={DocumentTextIcon}
        title="No sections yet"
        description="Add your first section to start building your proposal. Use AI to generate content or write manually."
        action={{
            label: 'Add Section',
            onClick: onAddClick,
        }}
        size="sm"
    />
);

export const EmptyAnswers = () => (
    <EmptyState
        icon={DocumentTextIcon}
        title="No saved answers"
        description="Approved answers are automatically saved here for reuse in future proposals."
        size="sm"
    />
);
