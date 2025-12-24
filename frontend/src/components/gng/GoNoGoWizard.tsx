import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowLeftIcon, ArrowRightIcon, SparklesIcon, UserGroupIcon, CalendarDaysIcon, BookOpenIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { goNoGoApi } from '@/api/client';
import { GoNoGoCriteria, GoNoGoAnalysis, Project } from '@/types';
import WinProbabilityGauge, { ScoreBreakdown } from './WinProbabilityGauge';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface GoNoGoWizardProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onComplete?: (analysis: GoNoGoAnalysis) => void;
}

const STEPS = [
    { id: 1, title: 'Resources', icon: UserGroupIcon, description: 'Team & skills availability' },
    { id: 2, title: 'Timeline', icon: CalendarDaysIcon, description: 'Feasibility check' },
    { id: 3, title: 'Experience', icon: BookOpenIcon, description: 'Past work alignment' },
    { id: 4, title: 'Competition', icon: ChartBarIcon, description: 'Market position' },
    { id: 5, title: 'Analysis', icon: SparklesIcon, description: 'AI recommendation' },
];

const DEFAULT_CRITERIA: GoNoGoCriteria = {
    team_available: 3,
    required_team_size: 4,
    key_skills_available: 70,
    typical_response_days: 14,
    incumbent_advantage: false,
    relationship_score: 50,
    pricing_competitiveness: 50,
    unique_capabilities: 50,
};

export default function GoNoGoWizard({ project, isOpen, onClose, onComplete }: GoNoGoWizardProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [criteria, setCriteria] = useState<GoNoGoCriteria>(DEFAULT_CRITERIA);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<GoNoGoAnalysis | null>(null);
    const [existingAnalysis, setExistingAnalysis] = useState<GoNoGoAnalysis | null>(null);

    // Load existing analysis if available
    useEffect(() => {
        if (isOpen && project.id) {
            loadExistingAnalysis();
        }
    }, [isOpen, project.id]);

    const loadExistingAnalysis = async () => {
        try {
            const response = await goNoGoApi.get(project.id);
            if (response.data.status !== 'pending' && response.data.win_probability) {
                setExistingAnalysis({
                    status: response.data.status,
                    win_probability: response.data.win_probability,
                    breakdown: response.data.analysis?.scores || {},
                    ai_recommendation: response.data.analysis?.ai_recommendation || '',
                    completed_at: response.data.completed_at,
                });
                // Load saved criteria
                if (response.data.analysis?.criteria_used) {
                    setCriteria({ ...DEFAULT_CRITERIA, ...response.data.analysis.criteria_used });
                }
            }
        } catch (error) {
            // No existing analysis
        }
    };

    const handleNext = () => {
        if (currentStep < 5) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const response = await goNoGoApi.analyze(project.id, criteria);
            const result = response.data.analysis;
            setAnalysis(result);
            setCurrentStep(5);
            toast.success('Analysis complete!');
            if (onComplete) {
                onComplete(result);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReset = async () => {
        try {
            await goNoGoApi.reset(project.id);
            setCriteria(DEFAULT_CRITERIA);
            setAnalysis(null);
            setExistingAnalysis(null);
            setCurrentStep(1);
            toast.success('Analysis reset');
        } catch (error) {
            toast.error('Failed to reset analysis');
        }
    };

    const updateCriteria = (key: keyof GoNoGoCriteria, value: any) => {
        setCriteria(prev => ({ ...prev, [key]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-primary/5 to-blue-50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Go/No-Go Analysis</h2>
                            <p className="text-sm text-gray-600 mt-1">{project.name}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <XMarkIcon className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex items-center gap-2 mt-6">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <button
                                    onClick={() => !isAnalyzing && setCurrentStep(step.id)}
                                    disabled={isAnalyzing}
                                    className={clsx(
                                        'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                                        currentStep === step.id
                                            ? 'bg-primary text-white shadow-md'
                                            : currentStep > step.id
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    )}
                                >
                                    <step.icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{step.title}</span>
                                </button>
                                {index < STEPS.length - 1 && (
                                    <div className={clsx(
                                        'w-4 h-0.5 mx-1',
                                        currentStep > step.id ? 'bg-green-300' : 'bg-gray-200'
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Resources */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <UserGroupIcon className="h-12 w-12 mx-auto text-primary mb-2" />
                                <h3 className="text-lg font-semibold">Resource Availability</h3>
                                <p className="text-sm text-gray-500">Assess your team's capacity for this opportunity</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Team Members Available
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={criteria.team_available}
                                        onChange={(e) => updateCriteria('team_available', parseInt(e.target.value) || 0)}
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Team Size Required
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={criteria.required_team_size}
                                        onChange={(e) => updateCriteria('required_team_size', parseInt(e.target.value) || 1)}
                                        className="input w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Key Skills Availability <span className="text-gray-400">({criteria.key_skills_available}%)</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={criteria.key_skills_available}
                                    onChange={(e) => updateCriteria('key_skills_available', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>Limited skills</span>
                                    <span>Full capability</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Timeline */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <CalendarDaysIcon className="h-12 w-12 mx-auto text-primary mb-2" />
                                <h3 className="text-lg font-semibold">Timeline Feasibility</h3>
                                <p className="text-sm text-gray-500">Evaluate if the deadline is achievable</p>
                            </div>

                            {project.due_date && (
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                                    <p className="text-sm text-blue-600 mb-1">Project Due Date</p>
                                    <p className="text-2xl font-bold text-blue-800">
                                        {new Date(project.due_date).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-sm text-blue-600 mt-1">
                                        {Math.ceil((new Date(project.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Typical Response Time (days)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="90"
                                    value={criteria.typical_response_days}
                                    onChange={(e) => updateCriteria('typical_response_days', parseInt(e.target.value) || 14)}
                                    className="input w-full"
                                />
                                <p className="text-xs text-gray-500 mt-1">How long does your team typically take to respond to similar RFPs?</p>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Experience */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <BookOpenIcon className="h-12 w-12 mx-auto text-primary mb-2" />
                                <h3 className="text-lg font-semibold">Past Experience Match</h3>
                                <p className="text-sm text-gray-500">Your knowledge base will be searched automatically</p>
                            </div>

                            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                                <h4 className="font-medium text-gray-800 mb-3">Project Attributes for Matching:</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {project.industry && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-purple-500">🏭</span>
                                            <span>Industry: <strong>{project.industry}</strong></span>
                                        </div>
                                    )}
                                    {project.client_type && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-purple-500">🏢</span>
                                            <span>Client Type: <strong>{project.client_type}</strong></span>
                                        </div>
                                    )}
                                    {project.geography && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-purple-500">🌍</span>
                                            <span>Geography: <strong>{project.geography}</strong></span>
                                        </div>
                                    )}
                                    {project.client_name && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-purple-500">👤</span>
                                            <span>Client: <strong>{project.client_name}</strong></span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 rounded-xl">
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">Note:</span> The system will automatically search your knowledge base
                                    for similar past projects and calculate an experience match score.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Competition */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <ChartBarIcon className="h-12 w-12 mx-auto text-primary mb-2" />
                                <h3 className="text-lg font-semibold">Competitive Position</h3>
                                <p className="text-sm text-gray-500">Assess your competitive advantages</p>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="incumbent"
                                    checked={criteria.incumbent_advantage}
                                    onChange={(e) => updateCriteria('incumbent_advantage', e.target.checked)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor="incumbent" className="flex-1">
                                    <p className="font-medium text-gray-800">We are the incumbent</p>
                                    <p className="text-sm text-gray-500">Currently serving this client or renewal</p>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Client Relationship Strength <span className="text-gray-400">({criteria.relationship_score}%)</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={criteria.relationship_score}
                                    onChange={(e) => updateCriteria('relationship_score', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pricing Competitiveness <span className="text-gray-400">({criteria.pricing_competitiveness}%)</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={criteria.pricing_competitiveness}
                                    onChange={(e) => updateCriteria('pricing_competitiveness', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Unique Capabilities <span className="text-gray-400">({criteria.unique_capabilities}%)</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={criteria.unique_capabilities}
                                    onChange={(e) => updateCriteria('unique_capabilities', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 5: Analysis */}
                    {currentStep === 5 && (
                        <div className="space-y-6">
                            {!analysis && !existingAnalysis ? (
                                <div className="text-center py-8">
                                    <SparklesIcon className="h-16 w-16 mx-auto text-primary mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
                                    <p className="text-sm text-gray-500 mb-6">
                                        Click below to run AI-powered Go/No-Go analysis based on your inputs
                                    </p>
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing}
                                        className="btn-primary px-8 py-3 text-lg"
                                    >
                                        {isAnalyzing ? (
                                            <span className="flex items-center gap-2">
                                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Analyzing...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <SparklesIcon className="h-5 w-5" />
                                                Run Analysis
                                            </span>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Win Probability Gauge */}
                                    <div className="flex justify-center">
                                        <WinProbabilityGauge
                                            score={(analysis || existingAnalysis)!.win_probability}
                                            status={(analysis || existingAnalysis)!.status}
                                            size="lg"
                                        />
                                    </div>

                                    {/* AI Recommendation */}
                                    <div className="p-4 bg-gradient-to-r from-primary/5 to-blue-50 rounded-xl border border-primary/20">
                                        <div className="flex items-start gap-3">
                                            <SparklesIcon className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="font-semibold text-gray-800 mb-1">AI Recommendation</h4>
                                                <p className="text-sm text-gray-700">
                                                    {(analysis || existingAnalysis)!.ai_recommendation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Score Breakdown */}
                                    {(analysis || existingAnalysis)!.breakdown && (
                                        <div>
                                            <h4 className="font-semibold text-gray-800 mb-3">Score Breakdown</h4>
                                            <ScoreBreakdown
                                                breakdown={(analysis || existingAnalysis)!.breakdown}
                                                weights={{ resources: 0.25, timeline: 0.25, experience: 0.30, competition: 0.20 }}
                                            />
                                        </div>
                                    )}

                                    {/* Reset Button */}
                                    <div className="text-center pt-4">
                                        <button
                                            onClick={handleReset}
                                            className="text-sm text-gray-500 hover:text-primary transition-colors"
                                        >
                                            Reset and recalculate
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={currentStep === 1 || isAnalyzing}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                            currentStep === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'
                        )}
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back
                    </button>

                    <div className="text-sm text-gray-500">
                        Step {currentStep} of {STEPS.length}
                    </div>

                    {currentStep < 5 ? (
                        <button
                            onClick={handleNext}
                            disabled={isAnalyzing}
                            className="btn-primary flex items-center gap-2"
                        >
                            Next
                            <ArrowRightIcon className="h-4 w-4" />
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
