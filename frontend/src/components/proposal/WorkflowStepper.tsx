import {
    DocumentTextIcon,
    ClipboardDocumentCheckIcon,
    SparklesIcon,
    CubeTransparentIcon,
    EyeIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

export type WorkflowPhase = 'sections' | 'compliance' | 'strategy' | 'diagrams' | 'view';

interface PhaseConfig {
    id: WorkflowPhase;
    label: string;
    icon: React.ElementType;
    description: string;
}

const WORKFLOW_PHASES: PhaseConfig[] = [
    { id: 'sections', label: 'Sections', icon: DocumentTextIcon, description: 'Build proposal content' },
    { id: 'compliance', label: 'Compliance', icon: ClipboardDocumentCheckIcon, description: 'Review requirements' },
    { id: 'strategy', label: 'Strategy', icon: SparklesIcon, description: 'Win themes & pricing' },
    { id: 'diagrams', label: 'Diagrams', icon: CubeTransparentIcon, description: 'Create visuals' },
    { id: 'view', label: 'View Proposal', icon: EyeIcon, description: 'Review & export' },
];

interface WorkflowStepperProps {
    currentPhase: WorkflowPhase;
    onPhaseClick: (phase: WorkflowPhase) => void;
    phaseCompletion?: Partial<Record<WorkflowPhase, boolean>>;
}

export default function WorkflowStepper({
    currentPhase,
    onPhaseClick,
    phaseCompletion = {}
}: WorkflowStepperProps) {
    const currentIndex = WORKFLOW_PHASES.findIndex(p => p.id === currentPhase);

    return (
        <div className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-6">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
                {WORKFLOW_PHASES.map((phase, idx) => {
                    const isCurrent = phase.id === currentPhase;
                    const isCompleted = phaseCompletion[phase.id] || idx < currentIndex;
                    const isPast = idx < currentIndex;
                    const Icon = phase.icon;

                    return (
                        <div key={phase.id} className="flex items-center">
                            {/* Step */}
                            <button
                                onClick={() => onPhaseClick(phase.id)}
                                className={clsx(
                                    'flex flex-col items-center group transition-all duration-200',
                                    isCurrent ? 'scale-110' : 'hover:scale-105'
                                )}
                            >
                                {/* Circle */}
                                <div
                                    className={clsx(
                                        'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-sm',
                                        isCurrent && 'bg-indigo-600 border-indigo-600 ring-4 ring-indigo-200',
                                        isCompleted && !isCurrent && 'bg-green-500 border-green-500',
                                        !isCurrent && !isCompleted && 'bg-white border-gray-300 hover:border-indigo-400'
                                    )}
                                >
                                    {isCompleted && !isCurrent ? (
                                        <CheckCircleSolidIcon className="w-6 h-6 text-white" />
                                    ) : (
                                        <Icon className={clsx(
                                            'w-6 h-6',
                                            isCurrent ? 'text-white' : 'text-gray-500 group-hover:text-indigo-600'
                                        )} />
                                    )}
                                </div>

                                {/* Label */}
                                <span
                                    className={clsx(
                                        'mt-2 text-xs font-medium text-center transition-colors',
                                        isCurrent ? 'text-indigo-700' : isPast ? 'text-green-600' : 'text-gray-500'
                                    )}
                                >
                                    {phase.label}
                                </span>
                            </button>

                            {/* Connector line */}
                            {idx < WORKFLOW_PHASES.length - 1 && (
                                <div
                                    className={clsx(
                                        'w-12 sm:w-20 h-0.5 mx-2',
                                        idx < currentIndex ? 'bg-green-400' : 'bg-gray-200'
                                    )}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export { WORKFLOW_PHASES };
