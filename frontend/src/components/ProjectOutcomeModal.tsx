import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { projectsApi } from '@/api/client';
import { Project, ProjectOutcome } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    XMarkIcon,
    TrophyIcon,
    XCircleIcon,
    PauseCircleIcon,
    ClockIcon,
    CurrencyDollarIcon,
    ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';

interface ProjectOutcomeModalProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (project: Project) => void;
}

const OUTCOME_OPTIONS: {
    value: ProjectOutcome;
    label: string;
    description: string;
    icon: typeof TrophyIcon;
    color: string;
    bgColor: string;
}[] = [
        {
            value: 'won',
            label: 'Won',
            description: 'We won this RFP/opportunity',
            icon: TrophyIcon,
            color: 'text-green-600',
            bgColor: 'bg-green-100 border-green-300 hover:bg-green-50',
        },
        {
            value: 'lost',
            label: 'Lost',
            description: 'We did not win this opportunity',
            icon: XCircleIcon,
            color: 'text-red-600',
            bgColor: 'bg-red-100 border-red-300 hover:bg-red-50',
        },
        {
            value: 'abandoned',
            label: 'Abandoned',
            description: 'We decided not to pursue',
            icon: PauseCircleIcon,
            color: 'text-gray-600',
            bgColor: 'bg-gray-100 border-gray-300 hover:bg-gray-50',
        },
        {
            value: 'pending',
            label: 'Pending',
            description: 'Still awaiting decision',
            icon: ClockIcon,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100 border-blue-300 hover:bg-blue-50',
        },
    ];

const LOSS_REASONS = [
    'Price too high',
    'Missing features',
    'Competitor selected',
    'Budget constraints',
    'Timeline mismatch',
    'Lack of experience',
    'Relationship/incumbent',
    'Other',
];

export default function ProjectOutcomeModal({
    project,
    isOpen,
    onClose,
    onUpdate,
}: ProjectOutcomeModalProps) {
    const [outcome, setOutcome] = useState<ProjectOutcome>(project.outcome || 'pending');
    const [notes, setNotes] = useState(project.outcome_notes || '');
    const [contractValue, setContractValue] = useState<number | undefined>(project.contract_value);
    const [lossReason, setLossReason] = useState(project.loss_reason || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const response = await projectsApi.updateOutcome(project.id, {
                outcome,
                outcome_notes: notes || undefined,
                contract_value: outcome === 'won' ? contractValue : undefined,
                loss_reason: outcome === 'lost' ? lossReason : undefined,
            });

            onUpdate(response.data.project);
            toast.success(`Project marked as ${outcome}`);
            onClose();
        } catch (error) {
            console.error('Failed to update outcome:', error);
            toast.error('Failed to update project outcome');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedOption = OUTCOME_OPTIONS.find(o => o.value === outcome);

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                    <div>
                                        <Dialog.Title className="text-lg font-semibold text-text-primary">
                                            Record Outcome
                                        </Dialog.Title>
                                        <p className="text-sm text-text-muted mt-0.5">
                                            {project.name}
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg hover:bg-background text-text-muted hover:text-text-primary transition-colors"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="px-6 py-5 space-y-6">
                                    {/* Outcome Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary mb-3">
                                            What was the outcome?
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {OUTCOME_OPTIONS.map((option) => {
                                                const Icon = option.icon;
                                                const isSelected = outcome === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        onClick={() => setOutcome(option.value)}
                                                        className={clsx(
                                                            'p-4 rounded-xl border-2 text-left transition-all',
                                                            isSelected
                                                                ? `${option.bgColor} ring-2 ring-offset-2 ring-${option.color.replace('text-', '')}`
                                                                : 'border-border hover:border-gray-300 bg-white'
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={clsx(
                                                                'p-2 rounded-lg',
                                                                isSelected ? option.bgColor : 'bg-gray-100'
                                                            )}>
                                                                <Icon className={clsx(
                                                                    'h-5 w-5',
                                                                    isSelected ? option.color : 'text-gray-400'
                                                                )} />
                                                            </div>
                                                            <div>
                                                                <p className={clsx(
                                                                    'font-medium',
                                                                    isSelected ? option.color : 'text-text-primary'
                                                                )}>
                                                                    {option.label}
                                                                </p>
                                                                <p className="text-xs text-text-muted">
                                                                    {option.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Conditional Fields */}
                                    {outcome === 'won' && (
                                        <div>
                                            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                                                <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
                                                Contract Value
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                                                <input
                                                    type="number"
                                                    value={contractValue || ''}
                                                    onChange={(e) => setContractValue(e.target.value ? Number(e.target.value) : undefined)}
                                                    placeholder="0.00"
                                                    className="w-full pl-8 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {outcome === 'lost' && (
                                        <div>
                                            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                                                <XCircleIcon className="h-4 w-4 text-red-600" />
                                                Reason for Loss
                                            </label>
                                            <select
                                                value={lossReason}
                                                onChange={(e) => setLossReason(e.target.value)}
                                                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500 bg-white"
                                            >
                                                <option value="">Select reason...</option>
                                                {LOSS_REASONS.map((reason) => (
                                                    <option key={reason} value={reason}>
                                                        {reason}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                                            <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
                                            Notes (Optional)
                                        </label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            rows={3}
                                            placeholder="Add any additional notes about this outcome..."
                                            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className={clsx(
                                            'px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2',
                                            selectedOption?.bgColor || 'bg-primary text-white',
                                            selectedOption?.color || 'text-white',
                                            isSubmitting && 'opacity-50 cursor-not-allowed'
                                        )}
                                    >
                                        {isSubmitting ? (
                                            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                        ) : (
                                            selectedOption && <selectedOption.icon className="h-4 w-4" />
                                        )}
                                        {isSubmitting ? 'Saving...' : `Mark as ${selectedOption?.label}`}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
