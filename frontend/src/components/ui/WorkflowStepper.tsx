import clsx from 'clsx';
import { CheckIcon } from '@heroicons/react/24/solid';
import {
    DocumentArrowUpIcon,
    DocumentMagnifyingGlassIcon,
    ChatBubbleLeftRightIcon,
    DocumentCheckIcon,
    ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

interface WorkflowStep {
    id: string;
    label: string;
    description: string;
    icon: typeof DocumentArrowUpIcon;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
    {
        id: 'upload',
        label: 'Upload RFP',
        description: 'Import your RFP document',
        icon: DocumentArrowUpIcon,
    },
    {
        id: 'analyze',
        label: 'Analyze',
        description: 'Extract questions & requirements',
        icon: DocumentMagnifyingGlassIcon,
    },
    {
        id: 'answer',
        label: 'Generate Answers',
        description: 'AI-powered response generation',
        icon: ChatBubbleLeftRightIcon,
    },
    {
        id: 'review',
        label: 'Review',
        description: 'Review and approve answers',
        icon: DocumentCheckIcon,
    },
    {
        id: 'export',
        label: 'Export',
        description: 'Download final proposal',
        icon: ArrowDownTrayIcon,
    },
];

interface WorkflowStepperProps {
    currentStep: 'upload' | 'analyze' | 'answer' | 'review' | 'export';
    completedSteps?: string[];
    onStepClick?: (stepId: string) => void;
    compact?: boolean;
}

export default function WorkflowStepper({
    currentStep,
    completedSteps = [],
    onStepClick,
    compact = false,
}: WorkflowStepperProps) {
    const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);

    return (
        <div className={clsx(
            'flex items-center gap-1',
            compact ? 'justify-center' : 'justify-between'
        )}>
            {WORKFLOW_STEPS.map((step, index) => {
                const isCompleted = completedSteps.includes(step.id) || index < currentIndex;
                const isCurrent = step.id === currentStep;
                const isClickable = onStepClick && (isCompleted || isCurrent);
                const IconComponent = step.icon;

                return (
                    <div key={step.id} className="flex items-center">
                        {/* Step */}
                        <button
                            onClick={() => isClickable && onStepClick?.(step.id)}
                            disabled={!isClickable}
                            className={clsx(
                                'flex items-center gap-2 transition-all',
                                compact ? 'p-2' : 'p-3',
                                isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                                isCurrent && 'scale-105'
                            )}
                            title={step.description}
                        >
                            {/* Icon with status indicator */}
                            <div
                                className={clsx(
                                    'relative flex items-center justify-center rounded-full transition-all',
                                    compact ? 'h-8 w-8' : 'h-10 w-10',
                                    isCompleted
                                        ? 'bg-green-100 text-green-600'
                                        : isCurrent
                                            ? 'bg-primary text-white shadow-md'
                                            : 'bg-gray-100 text-gray-400'
                                )}
                            >
                                {isCompleted ? (
                                    <CheckIcon className={clsx(compact ? 'h-4 w-4' : 'h-5 w-5')} />
                                ) : (
                                    <IconComponent className={clsx(compact ? 'h-4 w-4' : 'h-5 w-5')} />
                                )}
                            </div>

                            {/* Label - hide in compact mode */}
                            {!compact && (
                                <div className="text-left">
                                    <p
                                        className={clsx(
                                            'text-sm font-medium',
                                            isCurrent
                                                ? 'text-primary'
                                                : isCompleted
                                                    ? 'text-green-600'
                                                    : 'text-text-muted'
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                    <p className="text-xs text-text-muted">{step.description}</p>
                                </div>
                            )}
                        </button>

                        {/* Connector line */}
                        {index < WORKFLOW_STEPS.length - 1 && (
                            <div
                                className={clsx(
                                    'h-0.5 transition-all',
                                    compact ? 'w-4' : 'w-8 lg:w-12',
                                    index < currentIndex
                                        ? 'bg-green-400'
                                        : 'bg-gray-200'
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
