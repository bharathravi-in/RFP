import React, { useState, useEffect } from 'react';
import {
    XMarkIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    DocumentTextIcon,
    SparklesIcon,
    CpuChipIcon,
    BookOpenIcon,
    ChartBarIcon,
    DocumentArrowDownIcon,
    RocketLaunchIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface PlatformTourProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

interface Slide {
    id: number;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    description: string;
    features: string[];
    color: string;
}

const slides: Slide[] = [
    {
        id: 1,
        icon: <RocketLaunchIcon className="w-16 h-16" />,
        title: "Welcome to RFP Pro",
        subtitle: "AI-Powered Proposal Management",
        description: "Transform how you create winning proposals with our intelligent platform powered by 27 specialized AI agents.",
        features: [
            "Automated RFP analysis",
            "AI-generated answers",
            "Knowledge-powered responses",
            "Professional exports"
        ],
        color: "from-blue-500 to-purple-600"
    },
    {
        id: 2,
        icon: <DocumentTextIcon className="w-16 h-16" />,
        title: "Upload & Analyze",
        subtitle: "Step 1: Import Your RFP",
        description: "Simply upload your RFP document (PDF, DOCX, Excel) and our AI will automatically extract questions, requirements, and structure.",
        features: [
            "Support for PDF, DOCX, XLSX, PPTX",
            "Automatic question extraction",
            "Section identification",
            "Requirement classification"
        ],
        color: "from-cyan-500 to-blue-600"
    },
    {
        id: 3,
        icon: <BookOpenIcon className="w-16 h-16" />,
        title: "Knowledge Base",
        subtitle: "Step 2: Your Company's Brain",
        description: "Build a knowledge base with your company documents, past proposals, case studies, and expertise. The AI learns from your content.",
        features: [
            "Upload company documents",
            "Automatic content indexing",
            "Semantic search powered",
            "Knowledge profiles by region/industry"
        ],
        color: "from-emerald-500 to-teal-600"
    },
    {
        id: 4,
        icon: <CpuChipIcon className="w-16 h-16" />,
        title: "27 AI Agents",
        subtitle: "Step 3: Intelligent Processing",
        description: "Our specialized AI agents work together to analyze, generate, validate, and polish your proposal content.",
        features: [
            "Document Analyzer & Question Extractor",
            "Answer Generator & Quality Reviewer",
            "Compliance Checker & Legal Review",
            "Win Theme & Competitive Analysis"
        ],
        color: "from-violet-500 to-purple-600"
    },
    {
        id: 5,
        icon: <SparklesIcon className="w-16 h-16" />,
        title: "Generate Answers",
        subtitle: "Step 4: AI-Powered Responses",
        description: "Get intelligent, context-aware answers generated from your knowledge base. Review, edit, and approve each response.",
        features: [
            "Knowledge-powered answers",
            "Multi-source context",
            "Quality scoring",
            "One-click regeneration"
        ],
        color: "from-amber-500 to-orange-600"
    },
    {
        id: 6,
        icon: <ChartBarIcon className="w-16 h-16" />,
        title: "Strategy Tools",
        subtitle: "Step 5: Win More Deals",
        description: "Use our strategy tools to develop winning themes, analyze competition, calculate pricing, and review legal risks.",
        features: [
            "Win Themes Generator",
            "Competitive Analysis",
            "Pricing Calculator",
            "Legal Risk Review"
        ],
        color: "from-rose-500 to-pink-600"
    },
    {
        id: 7,
        icon: <DocumentArrowDownIcon className="w-16 h-16" />,
        title: "Professional Export",
        subtitle: "Step 6: Deliver Excellence",
        description: "Export your completed proposal in professional formats with custom templates, branding, and formatting options.",
        features: [
            "DOCX with custom templates",
            "Professional PowerPoint",
            "PDF for submission",
            "Version history tracking"
        ],
        color: "from-indigo-500 to-blue-600"
    },
    {
        id: 8,
        icon: <CheckCircleIcon className="w-16 h-16" />,
        title: "You're Ready!",
        subtitle: "Start Creating Winning Proposals",
        description: "You now understand how RFP Pro works. Create your first project, upload an RFP, and let our AI help you win more deals!",
        features: [
            "Create your first project",
            "Upload an RFP document",
            "Build your knowledge base",
            "Generate winning proposals"
        ],
        color: "from-green-500 to-emerald-600"
    }
];

const PlatformTour: React.FC<PlatformTourProps> = ({ isOpen, onClose, onComplete }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(0);
        }
    }, [isOpen]);

    const goToSlide = (index: number) => {
        if (isAnimating) return;
        setIsAnimating(true);
        setCurrentSlide(index);
        setTimeout(() => setIsAnimating(false), 300);
    };

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            goToSlide(currentSlide + 1);
        } else {
            handleComplete();
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            goToSlide(currentSlide - 1);
        }
    };

    const handleComplete = () => {
        onComplete();
        onClose();
    };

    const handleSkip = () => {
        onComplete();
        onClose();
    };

    if (!isOpen) return null;

    const slide = slides[currentSlide];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-4xl mx-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* Background Decoration */}
                <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${slide.color}`} />
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                {/* Close Button */}
                <button
                    onClick={handleSkip}
                    className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>

                {/* Skip Button */}
                <button
                    onClick={handleSkip}
                    className="absolute top-4 left-4 z-10 text-sm text-gray-400 hover:text-white transition-colors"
                >
                    Skip Tour
                </button>

                {/* Content */}
                <div className="relative p-8 md:p-12">
                    {/* Progress Bar */}
                    <div className="flex gap-2 mb-8 justify-center">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToSlide(index)}
                                className={`h-2 rounded-full transition-all duration-300 ${index === currentSlide
                                        ? 'w-8 bg-gradient-to-r ' + slide.color
                                        : index < currentSlide
                                            ? 'w-2 bg-white/60'
                                            : 'w-2 bg-white/20'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Slide Content */}
                    <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            {/* Icon */}
                            <div className={`flex-shrink-0 p-6 rounded-2xl bg-gradient-to-br ${slide.color} text-white shadow-lg`}>
                                {slide.icon}
                            </div>

                            {/* Text Content */}
                            <div className="flex-1 text-center md:text-left">
                                <p className="text-sm font-medium text-blue-400 mb-2">{slide.subtitle}</p>
                                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{slide.title}</h2>
                                <p className="text-gray-300 text-lg mb-6">{slide.description}</p>

                                {/* Features */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {slide.features.map((feature, index) => (
                                        <div key={index} className="flex items-center gap-2 text-gray-200">
                                            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${slide.color}`} />
                                            <span className="text-sm">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-10">
                        <button
                            onClick={prevSlide}
                            disabled={currentSlide === 0}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${currentSlide === 0
                                    ? 'text-gray-500 cursor-not-allowed'
                                    : 'text-white hover:bg-white/10'
                                }`}
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                            Back
                        </button>

                        <span className="text-gray-400 text-sm">
                            {currentSlide + 1} of {slides.length}
                        </span>

                        <button
                            onClick={nextSlide}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all bg-gradient-to-r ${slide.color} text-white hover:shadow-lg hover:scale-105`}
                        >
                            {currentSlide === slides.length - 1 ? (
                                <>
                                    Get Started
                                    <RocketLaunchIcon className="w-5 h-5" />
                                </>
                            ) : (
                                <>
                                    Next
                                    <ArrowRightIcon className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlatformTour;
