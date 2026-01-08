import React, { useState, useEffect } from 'react';
import {
    SparklesIcon,
    DocumentTextIcon,
    LightBulbIcon,
    CheckCircleIcon,
    RocketLaunchIcon,
    XMarkIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    targetSelector?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to RFP Pro! 🎉',
        description: 'Let\'s get you up to speed in 60 seconds. This quick tour will show you how to create winning proposals with AI.',
        icon: <RocketLaunchIcon className="h-8 w-8 text-indigo-600" />,
    },
    {
        id: 'upload',
        title: 'Step 1: Upload Your RFP',
        description: 'Start by uploading an RFP document (PDF, DOCX, or XLSX). Our AI will automatically extract all questions and requirements.',
        icon: <DocumentTextIcon className="h-8 w-8 text-blue-600" />,
        targetSelector: '[data-tour="create-project"]',
    },
    {
        id: 'ai-answers',
        title: 'Step 2: AI Generates Answers',
        description: 'Our AI analyzes your knowledge base and generates tailored answers for each question. You\'ll see confidence scores to know what to review.',
        icon: <SparklesIcon className="h-8 w-8 text-purple-600" />,
    },
    {
        id: 'review',
        title: 'Step 3: Review & Refine',
        description: 'Edit any answer with our smart editor. The AI learns from your edits to improve future responses.',
        icon: <LightBulbIcon className="h-8 w-8 text-amber-600" />,
    },
    {
        id: 'export',
        title: 'Step 4: Export & Win',
        description: 'Export your polished proposal as Word, PDF, or PowerPoint. Track your time savings and win rate!',
        icon: <CheckCircleIcon className="h-8 w-8 text-green-600" />,
    },
];

interface OnboardingTourProps {
    onComplete: () => void;
    onSkip: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, onSkip }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    const step = ONBOARDING_STEPS[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            setIsVisible(false);
            localStorage.setItem('onboarding_completed', 'true');
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        setIsVisible(false);
        localStorage.setItem('onboarding_skipped', 'true');
        onSkip();
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                {/* Progress bar */}
                <div className="h-1 bg-gray-200">
                    <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 rounded-xl">
                            {step.icon}
                        </div>
                        <button
                            onClick={handleSkip}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            aria-label="Skip tour"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {step.title}
                    </h3>

                    <p className="text-gray-600 leading-relaxed mb-6">
                        {step.description}
                    </p>

                    {/* Step indicators */}
                    <div className="flex justify-center gap-2 mb-6">
                        {ONBOARDING_STEPS.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentStep(index)}
                                className={`h-2 rounded-full transition-all ${index === currentStep
                                        ? 'w-6 bg-indigo-600'
                                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between">
                        <button
                            onClick={handlePrev}
                            disabled={isFirstStep}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isFirstStep
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>

                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                            {isLastStep ? 'Get Started' : 'Next'}
                            {!isLastStep && <ArrowRightIcon className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Hook to manage onboarding state
export const useOnboarding = () => {
    const [showTour, setShowTour] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem('onboarding_completed');
        const skipped = localStorage.getItem('onboarding_skipped');

        if (!completed && !skipped) {
            // Show tour after a short delay
            const timer = setTimeout(() => setShowTour(true), 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const resetOnboarding = () => {
        localStorage.removeItem('onboarding_completed');
        localStorage.removeItem('onboarding_skipped');
        setShowTour(true);
    };

    return {
        showTour,
        setShowTour,
        resetOnboarding,
    };
};

export default OnboardingTour;
