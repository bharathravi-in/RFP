import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import CircularProgress from '@/components/ui/CircularProgress';

export type UploadState =
    | 'uploading'
    | 'parsing'
    | 'document_analysis'      // Agent 1: DocumentAnalyzerAgent
    | 'question_extraction'    // Agent 2: QuestionExtractorAgent
    | 'knowledge_retrieval'    // Agent 3: KnowledgeBaseAgent
    | 'answer_generation'      // Agent 4: AnswerGeneratorAgent
    | 'answer_validation'      // Agent 5: AnswerValidatorAgent
    | 'compliance_check'       // Agent 6: ComplianceCheckerAgent
    | 'clarification'          // Agent 7: ClarificationAgent
    | 'quality_review'         // Agent 8: QualityReviewerAgent
    | 'building_sections'      // Section population
    | 'complete'
    | 'error';

interface UploadProgressModalProps {
    isOpen: boolean;
    state: UploadState;
    percentage: number;
    fileName?: string;
    onClose?: () => void;
    error?: string;
}

// State configuration with messages
const STATE_CONFIG: Record<UploadState, { title: string; message: string; minPercent: number; maxPercent: number }> = {
    uploading: {
        title: 'Uploading Document...',
        message: 'Securely transferring your file to our servers',
        minPercent: 0,
        maxPercent: 10,
    },
    parsing: {
        title: 'Parsing Document...',
        message: 'Extracting text and content from your document',
        minPercent: 10,
        maxPercent: 15,
    },
    document_analysis: {
        title: 'Analyzing Document Structure...',
        message: 'AI is understanding your RFP structure and requirements',
        minPercent: 15,
        maxPercent: 25,
    },
    question_extraction: {
        title: 'Extracting Questions...',
        message: 'Identifying all questions and requirements from the RFP',
        minPercent: 25,
        maxPercent: 35,
    },
    knowledge_retrieval: {
        title: 'Searching Knowledge Base...',
        message: 'Finding relevant content from your knowledge base',
        minPercent: 35,
        maxPercent: 45,
    },
    answer_generation: {
        title: 'Generating Answers...',
        message: 'AI is crafting responses to each question',
        minPercent: 45,
        maxPercent: 60,
    },
    answer_validation: {
        title: 'Validating Answers...',
        message: 'Checking accuracy and completeness of responses',
        minPercent: 60,
        maxPercent: 70,
    },
    compliance_check: {
        title: 'Checking Compliance...',
        message: 'Verifying responses meet RFP requirements',
        minPercent: 70,
        maxPercent: 80,
    },
    clarification: {
        title: 'Identifying Clarifications...',
        message: 'Flagging questions that need more information',
        minPercent: 80,
        maxPercent: 85,
    },
    quality_review: {
        title: 'Quality Review...',
        message: 'Final quality check on all responses',
        minPercent: 85,
        maxPercent: 90,
    },
    building_sections: {
        title: 'Building Proposal Sections...',
        message: 'Creating proposal sections with AI-generated content',
        minPercent: 90,
        maxPercent: 98,
    },
    complete: {
        title: 'Analysis Complete!',
        message: 'Your RFP has been fully processed with AI-powered answers',
        minPercent: 100,
        maxPercent: 100,
    },
    error: {
        title: 'Processing Failed',
        message: 'An error occurred during processing',
        minPercent: 0,
        maxPercent: 100,
    },
};

// Step indicators - now showing full orchestrator pipeline
const STEPS = [
    { id: 'uploading', label: 'Upload' },
    { id: 'parsing', label: 'Parse' },
    { id: 'document_analysis', label: 'Analyze' },
    { id: 'question_extraction', label: 'Extract' },
    { id: 'knowledge_retrieval', label: 'Knowledge' },
    { id: 'answer_generation', label: 'Generate' },
    { id: 'quality_review', label: 'Review' },
    { id: 'building_sections', label: 'Build' },
];

/**
 * Upload Progress Modal - Shows dynamic progress during RFP upload and analysis
 */
export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
    isOpen,
    state,
    percentage,
    fileName,
    onClose,
    error,
}) => {
    const config = STATE_CONFIG[state];
    const isComplete = state === 'complete';
    const isError = state === 'error';

    // Get current step index for step indicators
    const currentStepIndex = STEPS.findIndex(s => s.id === state);

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-50"
                onClose={() => {
                    // Only allow close if complete or error
                    if ((isComplete || isError) && onClose) {
                        onClose();
                    }
                }}
            >
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
                            <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
                                {/* Close button - only show when complete or error */}
                                {(isComplete || isError) && onClose && (
                                    <button
                                        onClick={onClose}
                                        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <XMarkIcon className="h-5 w-5 text-gray-400" />
                                    </button>
                                )}

                                {/* Title */}
                                <Dialog.Title className="text-xl font-bold text-gray-900 mb-2">
                                    {config.title}
                                </Dialog.Title>

                                {/* Message */}
                                <p className="text-gray-600 mb-8 max-w-sm mx-auto">
                                    {error || config.message}
                                </p>

                                {/* Progress Indicator */}
                                <div className="flex justify-center mb-8">
                                    {isComplete ? (
                                        <div className="h-[120px] w-[120px] rounded-full bg-green-100 flex items-center justify-center animate-scale-in">
                                            <CheckCircleIcon className="h-16 w-16 text-green-500" />
                                        </div>
                                    ) : isError ? (
                                        <div className="h-[120px] w-[120px] rounded-full bg-red-100 flex items-center justify-center">
                                            <span className="text-4xl">⚠️</span>
                                        </div>
                                    ) : (
                                        <CircularProgress
                                            percentage={percentage}
                                            size={140}
                                            strokeWidth={10}
                                        />
                                    )}
                                </div>

                                {/* Step indicators */}
                                {!isComplete && !isError && (
                                    <div className="flex justify-center gap-2 mb-4">
                                        {STEPS.map((step, index) => {
                                            const isPast = index < currentStepIndex;
                                            const isCurrent = index === currentStepIndex;

                                            return (
                                                <div
                                                    key={step.id}
                                                    className={`flex flex-col items-center ${isPast || isCurrent ? 'opacity-100' : 'opacity-40'
                                                        }`}
                                                >
                                                    <div
                                                        className={`w-2 h-2 rounded-full transition-all duration-300 ${isPast
                                                            ? 'bg-green-500'
                                                            : isCurrent
                                                                ? 'bg-purple-500 animate-pulse'
                                                                : 'bg-gray-300'
                                                            }`}
                                                    />
                                                    <span className={`text-xs mt-1 ${isCurrent ? 'text-purple-600 font-medium' : 'text-gray-400'
                                                        }`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* File name */}
                                {fileName && !isComplete && !isError && (
                                    <p className="text-sm text-gray-400 truncate max-w-xs mx-auto">
                                        {fileName}
                                    </p>
                                )}

                                {/* Action button for complete state */}
                                {isComplete && onClose && (
                                    <button
                                        onClick={onClose}
                                        className="mt-4 btn-primary px-6 py-2"
                                    >
                                        Continue to Proposal Builder
                                    </button>
                                )}

                                {/* Retry button for error state */}
                                {isError && onClose && (
                                    <button
                                        onClick={onClose}
                                        className="mt-4 btn-secondary px-6 py-2"
                                    >
                                        Close
                                    </button>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default UploadProgressModal;
