import clsx from 'clsx';
import { CheckIcon } from '@heroicons/react/24/solid';
import {
    DocumentArrowUpIcon,
    DocumentMagnifyingGlassIcon,
    ChatBubbleLeftRightIcon,
    ArrowDownTrayIcon,
    UserCircleIcon,
    BookOpenIcon,
    FolderPlusIcon,
    Squares2X2Icon,
} from '@heroicons/react/24/outline';

interface WorkflowStep {
    id: string;
    label: string;
    description: string;
    icon: typeof DocumentArrowUpIcon;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
    {
        id: 'knowledge-profile',
        label: 'Knowledge Profile',
        description: 'Create knowledge profile',
        icon: UserCircleIcon,
    },
    {
        id: 'knowledge-base',
        label: 'Knowledge Base',
        description: 'Upload reusable content',
        icon: BookOpenIcon,
    },
    {
        id: 'create-project',
        label: 'Create Project',
        description: 'Start RFP response project',
        icon: FolderPlusIcon,
    },
    {
        id: 'upload',
        label: 'Upload RFP',
        description: 'Import your RFP document',
        icon: DocumentArrowUpIcon,
    },
    {
        id: 'analyze',
        label: 'Analyze RFP',
        description: 'Extract questions & requirements',
        icon: DocumentMagnifyingGlassIcon,
    },
    {
        id: 'sections',
        label: 'Extract Sections',
        description: 'Organize into proposal sections',
        icon: Squares2X2Icon,
    },
    {
        id: 'answer',
        label: 'Generate Answers',
        description: 'AI-powered response generation',
        icon: ChatBubbleLeftRightIcon,
    },
    {
        id: 'export',
        label: 'Export',
        description: 'Download final proposal',
        icon: ArrowDownTrayIcon,
    },
];

interface WorkflowStepperProps {
    currentStep: 'knowledge-profile' | 'knowledge-base' | 'create-project' | 'upload' | 'analyze' | 'sections' | 'answer' | 'export';
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
            compact ? 'justify-center flex-wrap' : 'justify-between overflow-x-auto'
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
                                compact ? 'p-1.5' : 'p-2',
                                isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                                isCurrent && 'scale-105'
                            )}
                            title={step.description}
                        >
                            {/* Icon with status indicator */}
                            <div
                                className={clsx(
                                    'relative flex items-center justify-center rounded-full transition-all',
                                    compact ? 'h-7 w-7' : 'h-9 w-9',
                                    isCompleted
                                        ? 'bg-green-100 text-green-600'
                                        : isCurrent
                                            ? 'bg-primary text-white shadow-md'
                                            : 'bg-gray-100 text-gray-400'
                                )}
                            >
                                {isCompleted ? (
                                    <CheckIcon className={clsx(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                                ) : (
                                    <IconComponent className={clsx(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                                )}
                            </div>

                            {/* Label - hide in compact mode */}
                            {!compact && (
                                <div className="text-left hidden lg:block">
                                    <p
                                        className={clsx(
                                            'text-xs font-medium whitespace-nowrap',
                                            isCurrent
                                                ? 'text-primary'
                                                : isCompleted
                                                    ? 'text-green-600'
                                                    : 'text-text-muted'
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                </div>
                            )}
                        </button>

                        {/* Connector line */}
                        {index < WORKFLOW_STEPS.length - 1 && (
                            <div
                                className={clsx(
                                    'h-0.5 transition-all',
                                    compact ? 'w-2' : 'w-4 lg:w-6',
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
