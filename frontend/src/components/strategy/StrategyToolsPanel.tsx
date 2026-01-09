/**
 * Strategy Tools Panel Component
 * 
 * Provides access to strategic analysis tools:
 * - Win Themes Generator
 * - Competitive Analysis
 * - Case Studies Generator
 * - Pricing Calculator
 * - Legal Review
 * 
 * Enhanced with:
 * - Regenerate with feedback (free text input)
 * - AI-powered improvement suggestions
 * - Currency support from project dimensions
 * - Improved UI/UX with card-based layout
 */
import React, { useState, useEffect } from 'react';
import {
    TrophyIcon,
    ChartBarIcon,
    CurrencyDollarIcon,
    ScaleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    LightBulbIcon,
    ArrowPathIcon,
    BookOpenIcon,
    SparklesIcon,
    PencilSquareIcon,
    XMarkIcon,
    CalendarDaysIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import { agentsApi, projectsApi } from '../../api/client';
import toast from 'react-hot-toast';

interface StrategyToolsPanelProps {
    projectId: number;
}

interface WinTheme {
    theme_id: string;
    theme_title: string;
    theme_statement: string;
    customer_benefit: string;
    proof_points: string[];
    sections_to_apply: string[];
    priority: string;
}

interface LegalRisk {
    risk_id: string;
    category: string;
    severity: string;
    description: string;
    recommendation: string;
}

// Regenerate Modal Component for feedback input
interface RegenerateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRegenerate: (feedback: string) => void;
    title: string;
    isLoading: boolean;
    onGetAiSuggestion: () => Promise<string>;
    isGettingAiSuggestion: boolean;
}

const RegenerateModal: React.FC<RegenerateModalProps> = ({
    isOpen,
    onClose,
    onRegenerate,
    title,
    isLoading,
    onGetAiSuggestion,
    isGettingAiSuggestion,
}) => {
    const [feedback, setFeedback] = useState('');

    // Reset feedback when modal opens
    useEffect(() => {
        if (isOpen) {
            setFeedback('');
        }
    }, [isOpen]);

    const handleGetAiSuggestion = async () => {
        const suggestion = await onGetAiSuggestion();
        if (suggestion) {
            setFeedback(suggestion);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Regenerate {title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5 text-gray-500" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Provide feedback for improvement (optional)
                        </label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="E.g., 'Focus more on cloud technologies', 'Include specific ROI metrics', 'Emphasize government experience'..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                            rows={4}
                        />
                    </div>
                    <button
                        onClick={handleGetAiSuggestion}
                        disabled={isGettingAiSuggestion}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >
                        {isGettingAiSuggestion ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                            <SparklesIcon className="h-4 w-4" />
                        )}
                        Get AI Suggestion
                    </button>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onRegenerate(feedback)}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                            <ArrowPathIcon className="h-4 w-4" />
                        )}
                        Regenerate
                    </button>
                </div>
            </div>
        </div>
    );
};

const StrategyToolsPanel: React.FC<StrategyToolsPanelProps> = ({ projectId }) => {
    // Accordion state
    const [expandedSection, setExpandedSection] = useState<string>('themes');
    const [isLoading, setIsLoading] = useState(true);

    // Project data (for currency and country)
    const [projectCurrency, setProjectCurrency] = useState<string>('USD');
    const [currencySymbol, setCurrencySymbol] = useState<string>('$');
    const [projectCountry, setProjectCountry] = useState<string>('USA');
    const [availableCurrencies] = useState<string[]>(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD', 'AED', 'SAR']);
    const [availableCountries] = useState<{ code: string; name: string; defaultCurrency: string }[]>([
        { code: 'USA', name: 'United States', defaultCurrency: 'USD' },
        { code: 'IND', name: 'India', defaultCurrency: 'INR' },
        { code: 'AUS', name: 'Australia', defaultCurrency: 'AUD' },
        { code: 'GBR', name: 'United Kingdom', defaultCurrency: 'GBP' },
        { code: 'DEU', name: 'Germany', defaultCurrency: 'EUR' },
        { code: 'SGP', name: 'Singapore', defaultCurrency: 'SGD' },
        { code: 'UAE', name: 'United Arab Emirates', defaultCurrency: 'AED' },
        { code: 'CAN', name: 'Canada', defaultCurrency: 'CAD' },
        { code: 'JPN', name: 'Japan', defaultCurrency: 'JPY' },
        { code: 'CHN', name: 'China', defaultCurrency: 'CNY' },
        { code: 'SAU', name: 'Saudi Arabia', defaultCurrency: 'SAR' },
        { code: 'CHE', name: 'Switzerland', defaultCurrency: 'CHF' },
    ]);

    // Win Themes State
    const [winThemes, setWinThemes] = useState<WinTheme[]>([]);
    const [differentiators, setDifferentiators] = useState<any[]>([]);
    const [loadingThemes, setLoadingThemes] = useState(false);

    // Competitive Analysis State
    const [competitiveData, setCompetitiveData] = useState<any>(null);
    const [loadingCompetitive, setLoadingCompetitive] = useState(false);

    // Pricing State
    const [pricingData, setPricingData] = useState<any>(null);
    const [loadingPricing, setLoadingPricing] = useState(false);

    // Case Study State
    const [caseStudiesData, setCaseStudiesData] = useState<any[]>([]);
    const [loadingCaseStudies, setLoadingCaseStudies] = useState(false);

    // Legal Review State
    const [legalData, setLegalData] = useState<any>(null);
    const [loadingLegal, setLoadingLegal] = useState(false);

    // Sprint Timeline State (NEW)
    const [timelineData, setTimelineData] = useState<any>(null);
    const [loadingTimeline, setLoadingTimeline] = useState(false);
    const [timelineInputs, setTimelineInputs] = useState({
        complexity: 'medium',
        sprint_duration_weeks: 2,
        team_size: 6,
        buffer_percentage: 15,
        project_type: 'standard' as 'standard' | 'ai_ml' | 'enterprise',
    });

    // Regenerate Modal States
    const [regenerateModal, setRegenerateModal] = useState<{
        isOpen: boolean;
        type: 'themes' | 'competitive' | 'casestudies' | 'pricing' | 'legal' | 'timeline' | null;
    }>({ isOpen: false, type: null });
    const [isGettingAiSuggestion, setIsGettingAiSuggestion] = useState(false);

    // Currency mapping
    const getCurrencySymbol = (currency: string) => {
        const symbols: Record<string, string> = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥',
            'AUD': 'A$', 'CAD': 'C$', 'CHF': 'CHF', 'CNY': '¥', 'SGD': 'S$',
            'AED': 'د.إ', 'SAR': '﷼'
        };
        return symbols[currency] || currency + ' ';
    };

    // Currency symbol change ONLY (no recalculation) - display purposes
    const handleCurrencyChange = (newCurrency: string) => {
        setProjectCurrency(newCurrency);
        setCurrencySymbol(getCurrencySymbol(newCurrency));
        // NOTE: This ONLY changes the display symbol, NOT the pricing
        // Pricing recalculation only happens when user clicks "Recalculate Pricing"
    };

    // Country change - sets country for next recalculation (no auto-recalc, no currency change)
    const handleCountryChange = (newCountryCode: string) => {
        setProjectCountry(newCountryCode);
        // NOTE: Does NOT auto-recalculate or change currency display.
        // User must click "Recalculate Pricing" - currency will be set from backend response
    };

    // Load project currency and saved strategy on mount
    useEffect(() => {
        const loadProjectData = async () => {
            try {
                // Load project for currency info
                const projectResponse = await projectsApi.get(projectId);
                if (projectResponse.data) {
                    const projectCurr = projectResponse.data.currency || 'USD';
                    setProjectCurrency(projectCurr);
                    setCurrencySymbol(getCurrencySymbol(projectCurr));
                }
            } catch (err) {
                console.error('Error loading project data:', err);
            }
        };
        loadProjectData();
    }, [projectId]);

    // Load saved strategy data on mount
    React.useEffect(() => {
        const loadSavedStrategy = async () => {
            try {
                const response = await agentsApi.getProjectStrategy(projectId);
                const data = response.data;
                if (data.success && data.strategy) {
                    // Load win themes
                    if (data.strategy.win_themes) {
                        setWinThemes(data.strategy.win_themes.win_themes || []);
                        setDifferentiators(data.strategy.win_themes.differentiators || []);
                    }
                    // Load competitive analysis
                    if (data.strategy.competitive_analysis) {
                        console.log('[DEBUG] Loaded competitive_analysis:', JSON.stringify(data.strategy.competitive_analysis, null, 2));
                        setCompetitiveData(data.strategy.competitive_analysis);
                    }
                    // Load pricing and its associated currency/country
                    if (data.strategy.pricing) {
                        setPricingData(data.strategy.pricing);
                        // If pricing has currency info, use it for display
                        const savedCurrency = data.strategy.pricing.pricing_summary?.currency ||
                            data.strategy.pricing.currency;
                        if (savedCurrency) {
                            setProjectCurrency(savedCurrency);
                            setCurrencySymbol(getCurrencySymbol(savedCurrency));
                        }
                        // Also set country if available in saved pricing
                        const savedCountry = data.strategy.pricing.country ||
                            data.strategy.pricing.pricing_summary?.country;
                        if (savedCountry) {
                            setProjectCountry(savedCountry);
                        }
                    }
                    // Load case studies
                    if (data.strategy.case_studies) {
                        setCaseStudiesData(data.strategy.case_studies.case_studies || []);
                    }
                    // Load legal review
                    if (data.strategy.legal_review) {
                        setLegalData(data.strategy.legal_review);
                    }
                    // Load sprint timeline
                    if (data.strategy.sprint_timeline) {
                        setTimelineData(data.strategy.sprint_timeline);
                    }
                }
            } catch (err) {
                console.error('Error loading saved strategy:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadSavedStrategy();
    }, [projectId]);

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? '' : section);
    };

    // Open regenerate modal
    const openRegenerateModal = (type: 'themes' | 'competitive' | 'casestudies' | 'pricing' | 'legal') => {
        setRegenerateModal({ isOpen: true, type });
    };

    // Get AI suggestion for improvement - returns the suggestion string
    const getAiSuggestionForType = async (type: string): Promise<string> => {
        setIsGettingAiSuggestion(true);
        try {
            // Generate contextual suggestions based on type
            let suggestion = '';
            switch (type) {
                case 'themes':
                    suggestion = 'Focus on demonstrating:\n• Clear ROI and cost savings\n• Technical innovation and modern architecture\n• Proven track record with similar clients\n• Strong partnership approach';
                    break;
                case 'competitive':
                    suggestion = 'Analyze competitors by:\n• Identifying their weaknesses in delivery timeline\n• Highlighting our unique technical capabilities\n• Emphasizing our superior customer support\n• Showcasing our industry certifications';
                    break;
                case 'casestudies':
                    suggestion = 'Generate case studies that:\n• Match the client\'s industry and size\n• Demonstrate measurable outcomes (%, time savings)\n• Include relevant technologies used\n• Show challenges overcome';
                    break;
                case 'pricing':
                    suggestion = 'Consider pricing factors:\n• Competitive market rates\n• Value-based pricing for unique features\n• Phased implementation discounts\n• Long-term support packages';
                    break;
                case 'legal':
                    suggestion = 'Review for:\n• Data privacy compliance (GDPR, CCPA)\n• SLA and liability clauses\n• Intellectual property terms\n• Termination and transition provisions';
                    break;
            }
            return suggestion;
        } catch (err) {
            toast.error('Failed to get AI suggestion');
            return '';
        } finally {
            setIsGettingAiSuggestion(false);
        }
    };

    // Generate Win Themes with optional feedback
    const generateWinThemes = async (feedback?: string) => {
        setLoadingThemes(true);
        try {
            const response = await agentsApi.generateWinThemes(projectId, {
                feedback: feedback || undefined
            });
            const data = response.data;
            if (data.success) {
                setWinThemes(data.themes?.win_themes || []);
                setDifferentiators(data.themes?.differentiators || []);
                toast.success(`Generated ${data.theme_count || 0} win themes`);
                // Save to database
                await agentsApi.saveWinThemes(projectId, {
                    win_themes: data.themes?.win_themes || [],
                    differentiators: data.themes?.differentiators || [],
                    theme_count: data.theme_count
                });
            } else {
                toast.error(data.error || 'Failed to generate themes');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error generating win themes');
        } finally {
            setLoadingThemes(false);
            setRegenerateModal({ isOpen: false, type: null });
        }
    };

    // Run Competitive Analysis with optional feedback
    const runCompetitiveAnalysis = async (feedback?: string) => {
        setLoadingCompetitive(true);
        try {
            const response = await agentsApi.competitiveAnalysis(projectId, {
                feedback: feedback || undefined
            });
            const data = response.data;
            if (data.success) {
                setCompetitiveData(data.analysis);
                toast.success('Competitive analysis complete');
                // Save to database
                await agentsApi.saveCompetitiveAnalysis(projectId, data.analysis);
            } else {
                toast.error(data.error || 'Failed to analyze competition');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error running competitive analysis');
        } finally {
            setLoadingCompetitive(false);
            setRegenerateModal({ isOpen: false, type: null });
        }
    };

    // Calculate Pricing with optional feedback
    // IMPORTANT: Pricing is based on COUNTRY cost model, not currency conversion
    const calculatePricing = async (feedback?: string) => {
        setLoadingPricing(true);
        try {
            const response = await agentsApi.calculatePricing(projectId, {
                complexity: 'medium',
                country: projectCountry,  // Country drives the cost model
                currency: projectCurrency, // Currency is for display only
                feedback: feedback || undefined
            });
            const data = response.data;
            if (data.success) {
                setPricingData(data.pricing);
                // Update currency from response if available
                const responseCurrency = data.pricing?.pricing_summary?.currency ||
                    data.pricing?.currency ||
                    projectCurrency;
                if (responseCurrency) {
                    setProjectCurrency(responseCurrency);
                    setCurrencySymbol(getCurrencySymbol(responseCurrency));
                }
                toast.success(`Pricing calculated for ${projectCountry} in ${responseCurrency}`);
                // Save to database with country info for persistence
                await agentsApi.savePricing(projectId, {
                    ...data.pricing,
                    country: projectCountry, // Save country for reload
                    country_name: data.country_name
                });
            } else {
                toast.error(data.error || 'Failed to calculate pricing');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error calculating pricing');
        } finally {
            setLoadingPricing(false);
            setRegenerateModal({ isOpen: false, type: null });
        }
    };

    // Generate Case Studies with optional feedback
    const generateCaseStudies = async (feedback?: string) => {
        setLoadingCaseStudies(true);
        try {
            const response = await agentsApi.generateCaseStudies(projectId, {
                case_count: 3,
                feedback: feedback || undefined
            });
            const data = response.data;
            if (data.success) {
                setCaseStudiesData(data.case_studies || []);
                toast.success(`Generated ${data.case_count || 0} case studies`);
                // Save to database
                await agentsApi.saveCaseStudies(projectId, {
                    case_studies: data.case_studies || [],
                    summary: data.summary
                });
            } else {
                toast.error(data.error || 'Failed to generate case studies');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error generating case studies');
        } finally {
            setLoadingCaseStudies(false);
            setRegenerateModal({ isOpen: false, type: null });
        }
    };


    // Run Legal Review with optional feedback
    const runLegalReview = async (feedback?: string) => {
        setLoadingLegal(true);
        try {
            const response = await agentsApi.legalReview(projectId, 'full');
            const data = response.data;
            if (data.success) {
                setLegalData(data.review);
                toast.success('Legal review complete');
                // Save to database
                await agentsApi.saveLegalReview(projectId, data.review);
            } else {
                toast.error(data.error || 'Failed to complete legal review');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error running legal review');
        } finally {
            setLoadingLegal(false);
            setRegenerateModal({ isOpen: false, type: null });
        }
    };

    // Calculate Sprint Timeline (NEW)
    const calculateTimeline = async (feedback?: string) => {
        setLoadingTimeline(true);
        try {
            const response = await agentsApi.calculateSprintTimeline(projectId, {
                complexity: timelineInputs.complexity,
                sprint_duration_weeks: timelineInputs.sprint_duration_weeks,
                team_size: timelineInputs.team_size,
                buffer_percentage: timelineInputs.buffer_percentage,
                project_type: timelineInputs.project_type,
            });
            const data = response.data;
            if (data.success) {
                setTimelineData(data.timeline);
                toast.success(`Sprint timeline calculated: ${data.timeline?.timeline_summary?.total_sprints || 0} sprints over ${data.timeline?.timeline_summary?.total_months || 0} months`);
                // Save to database for export and persistence
                await agentsApi.saveSprintTimeline(projectId, data.timeline);
            } else {
                toast.error(data.error || 'Failed to calculate timeline');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error calculating timeline');
        } finally {
            setLoadingTimeline(false);
            setRegenerateModal({ isOpen: false, type: null });
        }
    };

    // Handle regenerate from modal
    const handleRegenerate = (feedback: string) => {
        switch (regenerateModal.type) {
            case 'themes':
                generateWinThemes(feedback);
                break;
            case 'competitive':
                runCompetitiveAnalysis(feedback);
                break;
            case 'casestudies':
                generateCaseStudies(feedback);
                break;
            case 'pricing':
                calculatePricing(feedback);
                break;
            case 'legal':
                runLegalReview(feedback);
                break;
            case 'timeline':
                calculateTimeline(feedback);
                break;
        }
    };

    const getModalTitle = () => {
        switch (regenerateModal.type) {
            case 'themes': return 'Win Themes';
            case 'competitive': return 'Competitive Analysis';
            case 'casestudies': return 'Case Studies';
            case 'pricing': return 'Pricing';
            case 'legal': return 'Legal Review';
            case 'timeline': return 'Sprint Timeline';
            default: return '';
        }
    };

    const isRegenerateLoading = () => {
        switch (regenerateModal.type) {
            case 'themes': return loadingThemes;
            case 'competitive': return loadingCompetitive;
            case 'casestudies': return loadingCaseStudies;
            case 'pricing': return loadingPricing;
            case 'legal': return loadingLegal;
            case 'timeline': return loadingTimeline;
            default: return false;
        }
    };


    const getSeverityColor = (severity: string) => {
        switch (severity?.toLowerCase()) {
            case 'critical': return 'bg-red-100 text-red-700 border-red-200';
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'low': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'primary': return 'bg-indigo-100 text-indigo-700';
            case 'secondary': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                            <ChartBarIcon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Strategy Tools</h2>
                            <p className="text-indigo-100">AI-powered proposal strategy & analysis</p>
                        </div>
                    </div>
                    {isLoading && (
                        <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            <span>Loading...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats Dashboard */}
            {!isLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div
                        onClick={() => toggleSection('themes')}
                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <TrophyIcon className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-medium">Win Themes</p>
                                <p className="text-xl font-bold text-gray-900">{winThemes.length || 0}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                            {winThemes[0]?.theme_title || "Click to generate themes"}
                        </p>
                    </div>

                    <div
                        onClick={() => toggleSection('competitive')}
                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ChartBarIcon className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-medium">Competitive</p>
                                <p className="text-xl font-bold text-gray-900">{competitiveData ? 'Ready' : '—'}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                            {competitiveData ? "Analysis complete" : "Click to analyze"}
                        </p>
                    </div>

                    <div
                        onClick={() => toggleSection('pricing')}
                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-green-200 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-medium">Pricing</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {pricingData ? `${currencySymbol}${(pricingData.pricing_summary?.total_cost / 1000).toFixed(0)}K` : '—'}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                            {pricingData ? `${projectCurrency} • ${pricingData.pricing_summary?.validity_period}` : "Click to calculate"}
                        </p>
                    </div>

                    <div
                        onClick={() => toggleSection('legal')}
                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-red-200 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ScaleIcon className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-medium">Legal Risk</p>
                                <p className={`text-xl font-bold capitalize ${legalData?.overall_risk_level === 'high' || legalData?.overall_risk_level === 'critical' ? 'text-red-600' :
                                    legalData?.overall_risk_level === 'medium' ? 'text-amber-600' :
                                        legalData?.overall_risk_level === 'low' ? 'text-green-600' : 'text-gray-900'
                                    }`}>
                                    {legalData?.overall_risk_level || '—'}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                            {legalData ? `${legalData.risk_items?.length || 0} items found` : "Click to review"}
                        </p>
                    </div>
                </div>
            )}

            {/* Strategy Sections */}
            <div className="space-y-3">

                {/* Win Themes Section */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => toggleSection('themes')}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <TrophyIcon className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="text-left">
                                <span className="font-semibold text-gray-900">Win Themes</span>
                                <p className="text-xs text-gray-500">Key differentiators & value propositions</p>
                            </div>
                            {winThemes.length > 0 && (
                                <span className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                    {winThemes.length} themes
                                </span>
                            )}
                        </div>
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${expandedSection === 'themes' ? 'bg-amber-100' : 'bg-gray-100'}`}>
                            {expandedSection === 'themes' ? (
                                <ChevronUpIcon className="h-4 w-4 text-amber-600" />
                            ) : (
                                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                            )}
                        </div>
                    </button>
                    {expandedSection === 'themes' && (
                        <div className="px-5 pb-5 border-t border-gray-100">
                            {winThemes.length > 0 ? (
                                <div className="mt-4 space-y-3">
                                    {winThemes.map((theme, index) => (
                                        <div key={theme.theme_id || index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                            <div className="flex items-start justify-between">
                                                <h4 className="font-medium text-gray-900">{theme.theme_title}</h4>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(theme.priority)}`}>
                                                    {theme.priority}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">{theme.theme_statement}</p>
                                            {theme.customer_benefit && (
                                                <p className="text-xs text-indigo-600 mt-2">
                                                    <strong>Benefit:</strong> {theme.customer_benefit}
                                                </p>
                                            )}
                                            {theme.proof_points?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {theme.proof_points.slice(0, 3).map((point, i) => (
                                                        <span key={i} className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-600">
                                                            {point}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <TrophyIcon className="h-12 w-12 text-amber-200 mx-auto mb-3" />
                                    <p className="text-sm text-gray-500">Generate AI-powered win themes</p>
                                    <p className="text-xs text-gray-400 mt-1">Identify key differentiators for your proposal</p>
                                </div>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => generateWinThemes()}
                                    disabled={loadingThemes}
                                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {loadingThemes ? (
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <TrophyIcon className="h-4 w-4" />
                                    )}
                                    {winThemes.length > 0 ? 'Regenerate' : 'Generate'} Themes
                                </button>
                                {winThemes.length > 0 && (
                                    <button
                                        onClick={() => openRegenerateModal('themes')}
                                        disabled={loadingThemes}
                                        className="px-4 py-2.5 bg-white border border-amber-300 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" />
                                        Feedback
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Competitive Analysis Section */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => toggleSection('competitive')}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                <ChartBarIcon className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="text-left">
                                <span className="font-semibold text-gray-900">Competitive Analysis</span>
                                <p className="text-xs text-gray-500">Market positioning & strategies</p>
                            </div>
                            {competitiveData && (
                                <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                    Complete
                                </span>
                            )}
                        </div>
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${expandedSection === 'competitive' ? 'bg-purple-100' : 'bg-gray-100'}`}>
                            {expandedSection === 'competitive' ? (
                                <ChevronUpIcon className="h-4 w-4 text-purple-600" />
                            ) : (
                                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                            )}
                        </div>
                    </button>
                    {expandedSection === 'competitive' && (
                        <div className="px-5 pb-5 border-t border-gray-100">
                            {competitiveData ? (
                                <div className="mt-4 space-y-3">
                                    <p className="text-sm text-gray-600">
                                        {competitiveData.competitive_landscape?.market_context || 'Analysis complete'}
                                    </p>
                                    {competitiveData.competitive_strategies?.slice(0, 2).map((strategy: any, index: number) => (
                                        <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <LightBulbIcon className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <strong className="text-sm text-blue-900">{strategy.strategy_name}:</strong>
                                                    <span className="text-sm text-blue-700 ml-1">{strategy.description}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">
                                    Analyze competitive landscape and get positioning strategies
                                </p>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => runCompetitiveAnalysis()}
                                    disabled={loadingCompetitive}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loadingCompetitive ? (
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ChartBarIcon className="h-4 w-4" />
                                    )}
                                    {competitiveData ? 'Refresh' : 'Run'}
                                </button>
                                {competitiveData && (
                                    <button
                                        onClick={() => openRegenerateModal('competitive')}
                                        disabled={loadingCompetitive}
                                        className="px-4 py-2 bg-white border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" />
                                        With Feedback
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Case Study Generator Section */}
                <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
                    <button
                        onClick={() => toggleSection('casestudies')}
                        className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                <BookOpenIcon className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="font-medium text-gray-900">Case Studies</span>
                            {caseStudiesData.length > 0 && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                    {caseStudiesData.length} studies
                                </span>
                            )}
                        </div>
                        {expandedSection === 'casestudies' ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                        )}
                    </button>
                    {expandedSection === 'casestudies' && (
                        <div className="px-4 pb-4 border-t border-gray-100">
                            {caseStudiesData.length > 0 ? (
                                <div className="mt-4 space-y-3">
                                    {caseStudiesData.map((study: any, index: number) => (
                                        <div key={study.case_id || index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <h4 className="font-medium text-gray-900 mb-2">{study.title}</h4>
                                            <p className="text-sm text-gray-600 mb-2">
                                                <span className="font-medium">Challenge:</span> {study.challenge}
                                            </p>
                                            <p className="text-sm text-gray-600 mb-2">
                                                <span className="font-medium">Solution:</span> {study.solution}
                                            </p>
                                            {study.results?.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {study.results.slice(0, 3).map((result: any, i: number) => (
                                                        <span key={i} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                                            {result.metric}: {result.value}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {study.technologies?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {study.technologies.slice(0, 3).map((tech: string, i: number) => (
                                                        <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded border border-blue-100">
                                                            {tech}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">
                                    Generate relevant case studies based on project requirements
                                </p>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => generateCaseStudies()}
                                    disabled={loadingCaseStudies}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loadingCaseStudies ? (
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <BookOpenIcon className="h-4 w-4" />
                                    )}
                                    {caseStudiesData.length > 0 ? 'Regenerate' : 'Generate'}
                                </button>
                                {caseStudiesData.length > 0 && (
                                    <button
                                        onClick={() => openRegenerateModal('casestudies')}
                                        disabled={loadingCaseStudies}
                                        className="px-4 py-2 bg-white border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" />
                                        With Feedback
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sprint Timeline Section (NEW) */}
                <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
                    <button
                        onClick={() => toggleSection('timeline')}
                        className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <CalendarDaysIcon className="h-4 w-4 text-indigo-600" />
                            </div>
                            <span className="font-medium text-gray-900">Sprint Timeline</span>
                            {timelineData && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                    {timelineData.timeline_summary?.total_sprints} sprints • {timelineData.timeline_summary?.total_months} months
                                </span>
                            )}
                        </div>
                        {expandedSection === 'timeline' ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                        )}
                    </button>
                    {expandedSection === 'timeline' && (
                        <div className="px-4 pb-4 border-t border-gray-100">
                            {/* Timeline Inputs */}
                            <div className="mt-4 mb-4 bg-gray-50 rounded-xl p-4 space-y-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">⚙️ Customize Timeline Inputs</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Complexity */}
                                    <div>
                                        <label className="text-xs text-gray-500">Complexity</label>
                                        <select
                                            value={timelineInputs.complexity}
                                            onChange={(e) => setTimelineInputs(prev => ({ ...prev, complexity: e.target.value }))}
                                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="very_high">Very High</option>
                                        </select>
                                    </div>
                                    {/* Sprint Duration */}
                                    <div>
                                        <label className="text-xs text-gray-500">Sprint Duration</label>
                                        <select
                                            value={timelineInputs.sprint_duration_weeks}
                                            onChange={(e) => setTimelineInputs(prev => ({ ...prev, sprint_duration_weeks: parseInt(e.target.value) }))}
                                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                        >
                                            <option value={1}>1 week</option>
                                            <option value={2}>2 weeks</option>
                                            <option value={3}>3 weeks</option>
                                            <option value={4}>4 weeks</option>
                                        </select>
                                    </div>
                                    {/* Team Size */}
                                    <div>
                                        <label className="text-xs text-gray-500">Team Size</label>
                                        <input
                                            type="number"
                                            min={2}
                                            max={50}
                                            value={timelineInputs.team_size}
                                            onChange={(e) => setTimelineInputs(prev => ({ ...prev, team_size: parseInt(e.target.value) || 6 }))}
                                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    {/* Buffer % */}
                                    <div>
                                        <label className="text-xs text-gray-500">Buffer %</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={50}
                                            value={timelineInputs.buffer_percentage}
                                            onChange={(e) => setTimelineInputs(prev => ({ ...prev, buffer_percentage: parseInt(e.target.value) || 15 }))}
                                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                                {/* Project Type */}
                                <div>
                                    <label className="text-xs text-gray-500">Project Type</label>
                                    <select
                                        value={timelineInputs.project_type}
                                        onChange={(e) => setTimelineInputs(prev => ({ ...prev, project_type: e.target.value as any }))}
                                        className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="standard">Standard Software</option>
                                        <option value="ai_ml">AI/ML Project</option>
                                        <option value="enterprise">Enterprise Platform</option>
                                    </select>
                                </div>
                            </div>

                            {timelineData ? (
                                <div className="mt-2">
                                    {/* Summary Card */}
                                    <div className="text-center mb-4 bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl border border-indigo-100">
                                        <p className="text-3xl font-bold text-indigo-600">
                                            {timelineData.timeline_summary?.total_sprints} Sprints
                                        </p>
                                        <p className="text-lg text-gray-600 mt-1">
                                            {timelineData.timeline_summary?.total_weeks} weeks ({timelineData.timeline_summary?.total_months} months)
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {timelineData.timeline_summary?.start_date} → {timelineData.timeline_summary?.end_date}
                                        </p>
                                    </div>

                                    {/* Sprint Table */}
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Sprint</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Duration</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Focus Area</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Key Deliverables</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {timelineData.sprints?.slice(0, 8).map((sprint: any, index: number) => (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 font-medium text-gray-900">
                                                            #{sprint.sprint_number}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600">
                                                            Week {sprint.start_week}-{sprint.end_week}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600">
                                                            {sprint.focus_area}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">
                                                            {sprint.deliverables?.slice(0, 2).join(', ')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {timelineData.sprints?.length > 8 && (
                                            <div className="px-3 py-2 text-center text-xs text-gray-500 bg-gray-50">
                                                + {timelineData.sprints.length - 8} more sprints
                                            </div>
                                        )}
                                    </div>

                                    {/* Key Milestones */}
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <p className="text-xs font-medium text-amber-800 mb-2">📌 Key Milestones</p>
                                        <div className="flex flex-wrap gap-2">
                                            {timelineData.key_milestones?.slice(0, 4).map((milestone: any, index: number) => (
                                                <span key={index} className="px-2 py-1 text-xs bg-white border border-amber-200 rounded text-amber-700">
                                                    Week {milestone.week}: {milestone.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Governance */}
                                    {timelineData.governance && (
                                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <p className="text-xs font-medium text-blue-800 mb-1">🗓️ Governance Cadence</p>
                                            <p className="text-xs text-blue-700">
                                                Sprint Reviews: {timelineData.governance.sprint_reviews} |
                                                Demos: {timelineData.governance.stakeholder_demos} |
                                                Steering: {timelineData.governance.steering_committee}
                                            </p>
                                        </div>
                                    )}

                                    {/* Calculation Basis - Transparency */}
                                    {timelineData.calculation_basis && (
                                        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                            <p className="text-xs font-medium text-gray-700 mb-2">📊 Calculation Basis</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                                <div>Sections Analyzed: <span className="font-medium">{timelineData.calculation_basis.sections_analyzed}</span></div>
                                                <div>Story Points: <span className="font-medium">{timelineData.calculation_basis.story_points_estimated}</span></div>
                                                <div>Team Velocity: <span className="font-medium">{timelineData.calculation_basis.velocity_per_sprint} SP/sprint</span></div>
                                                <div>Complexity Factor: <span className="font-medium">{timelineData.calculation_basis.complexity_factor}x</span></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <CalendarDaysIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm">No timeline calculated yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Configure inputs above and click Calculate</p>
                                </div>
                            )}

                            {/* Calculate Button */}
                            <button
                                onClick={() => calculateTimeline()}
                                disabled={loadingTimeline}
                                className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loadingTimeline ? (
                                    <>
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                        Calculating...
                                    </>
                                ) : (
                                    <>
                                        <CalendarDaysIcon className="h-4 w-4" />
                                        Calculate Sprint Timeline
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Pricing Calculator Section */}
                <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
                    <button
                        onClick={() => toggleSection('pricing')}
                        className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                                <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
                            </div>
                            <span className="font-medium text-gray-900">Pricing Calculator</span>
                            {pricingData && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                    {currencySymbol}{pricingData.pricing_summary?.total_cost?.toLocaleString()}
                                </span>
                            )}
                            {/* Show country badge */}
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                {projectCountry}
                            </span>
                        </div>
                        {expandedSection === 'pricing' ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                        )}
                    </button>
                    {expandedSection === 'pricing' && (
                        <div className="px-4 pb-4 border-t border-gray-100">
                            {/* Country & Currency Selectors */}
                            <div className="mt-4 mb-4 bg-gray-50 rounded-xl p-4 space-y-3">
                                {/* Country Selector - Drives the cost model */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Delivery Country</label>
                                        <p className="text-xs text-gray-500">Determines cost structure</p>
                                    </div>
                                    <select
                                        value={projectCountry}
                                        onChange={(e) => handleCountryChange(e.target.value)}
                                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-[180px]"
                                    >
                                        {availableCountries.map((country) => (
                                            <option key={country.code} value={country.code}>
                                                {country.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Currency Display - Label only (not editable) */}
                                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Display Currency</label>
                                        <p className="text-xs text-gray-500">Based on delivery country</p>
                                    </div>
                                    <div className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 min-w-[120px] text-center">
                                        {getCurrencySymbol(pricingData?.pricing_summary?.currency || availableCountries.find(c => c.code === projectCountry)?.defaultCurrency || 'USD')}{' '}
                                        {pricingData?.pricing_summary?.currency || availableCountries.find(c => c.code === projectCountry)?.defaultCurrency || 'USD'}
                                    </div>
                                </div>

                                {/* Info note */}
                                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-700">
                                    <LightBulbIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Note:</strong> Pricing is based on country-specific cost models (labor, compliance, overhead).
                                        Click "Recalculate Pricing" after changing country to update costs.
                                    </span>
                                </div>
                            </div>

                            {pricingData ? (
                                <div className="mt-2">
                                    <div className="text-center mb-4 bg-gradient-to-br from-green-50 to-white p-4 rounded-xl border border-green-100">
                                        <p className="text-3xl font-bold text-green-600">
                                            {pricingData.pricing_summary?.currency_symbol || getCurrencySymbol(pricingData.pricing_summary?.currency || 'USD')}{pricingData.pricing_summary?.total_cost?.toLocaleString()}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {pricingData.pricing_summary?.currency || 'USD'} | {pricingData.country_name || availableCountries.find(c => c.code === projectCountry)?.name || projectCountry} Cost Model
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Valid: {pricingData.pricing_summary?.validity_period}
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                                        {pricingData.effort_breakdown?.map((phase: any, index: number) => (
                                            <div key={index} className="flex justify-between py-3 px-4 text-sm">
                                                <span className="text-gray-600">{phase.phase}</span>
                                                <span className="font-semibold text-gray-900">
                                                    {pricingData.pricing_summary?.currency_symbol || getCurrencySymbol(pricingData.pricing_summary?.currency || 'USD')}{phase.phase_total?.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Cost drivers explanation */}
                                    {pricingData.cost_explanation && (
                                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-xs font-medium text-amber-800 mb-1">Cost Drivers:</p>
                                            <p className="text-xs text-amber-700">{pricingData.cost_explanation}</p>
                                        </div>
                                    )}

                                    {/* Pricing Validity Explanation (30 Days) */}
                                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ClockIcon className="h-4 w-4 text-blue-600" />
                                            <p className="text-sm font-semibold text-blue-800">Pricing Valid for 30 Days</p>
                                        </div>
                                        <p className="text-xs text-blue-700 mb-2">This estimate is valid for 30 calendar days due to:</p>
                                        <ul className="text-xs text-blue-600 space-y-1 pl-4 list-disc">
                                            <li><strong>Talent cost volatility</strong> - Market rates for skilled resources fluctuate</li>
                                            <li><strong>Exchange rate exposure</strong> - Cross-border delivery affected by currency movements</li>
                                            <li><strong>Cloud/tooling costs</strong> - Infrastructure pricing can change</li>
                                            <li><strong>Regulatory updates</strong> - Compliance requirements may evolve</li>
                                            <li><strong>Demand fluctuations</strong> - Resource availability affects pricing</li>
                                        </ul>
                                        <p className="text-xs text-blue-500 mt-2 italic">⚡ Standard enterprise practice protecting both parties.</p>
                                    </div>

                                    {/* Assumptions */}
                                    {pricingData.assumptions && pricingData.assumptions.length > 0 && (
                                        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                            <p className="text-xs font-medium text-gray-700 mb-2">📋 Assumptions & Dependencies</p>
                                            <ul className="text-xs text-gray-600 space-y-1 pl-4 list-disc">
                                                {pricingData.assumptions.slice(0, 5).map((assumption: string, index: number) => (
                                                    <li key={index}>{assumption}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6 bg-gray-50 rounded-xl">
                                    <CurrencyDollarIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">
                                        Calculate AI-powered pricing estimates
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Based on project requirements
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => calculatePricing()}
                                    disabled={loadingPricing}
                                    className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {loadingPricing ? (
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CurrencyDollarIcon className="h-4 w-4" />
                                    )}
                                    {pricingData ? 'Recalculate' : 'Calculate'} Pricing
                                </button>
                                {pricingData && (
                                    <button
                                        onClick={() => openRegenerateModal('pricing')}
                                        disabled={loadingPricing}
                                        className="px-4 py-2.5 bg-white border border-green-300 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" />
                                        Feedback
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>


                {/* Legal Review Section */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => toggleSection('legal')}
                        className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                                <ScaleIcon className="h-4 w-4 text-red-600" />
                            </div>
                            <span className="font-medium text-gray-900">Legal Review</span>
                            {legalData && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(legalData.overall_risk_level)}`}>
                                    {legalData.overall_risk_level}
                                </span>
                            )}
                        </div>
                        {expandedSection === 'legal' ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                        )}
                    </button>
                    {expandedSection === 'legal' && (
                        <div className="px-4 pb-4 border-t border-gray-100">
                            {legalData ? (
                                <div className="mt-4 space-y-3">
                                    <div className={`p-3 rounded-lg border ${getSeverityColor(legalData.overall_risk_level)}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            {legalData.overall_risk_level === 'low' ? (
                                                <CheckCircleIcon className="h-4 w-4" />
                                            ) : (
                                                <ExclamationTriangleIcon className="h-4 w-4" />
                                            )}
                                            <strong className="text-sm">Risk Level: {legalData.overall_risk_level?.toUpperCase()}</strong>
                                        </div>
                                        <p className="text-sm">{legalData.review_summary}</p>
                                    </div>
                                    {legalData.risk_items?.slice(0, 3).map((risk: LegalRisk, index: number) => (
                                        <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSeverityColor(risk.severity)}`}>
                                                    {risk.severity}
                                                </span>
                                                <span className="text-sm text-gray-700">{risk.description}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">
                                    Check proposal for legal risks and compliance issues
                                </p>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => runLegalReview()}
                                    disabled={loadingLegal}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loadingLegal ? (
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ScaleIcon className="h-4 w-4" />
                                    )}
                                    {legalData ? 'Re-run' : 'Run'}
                                </button>
                                {legalData && (
                                    <button
                                        onClick={() => openRegenerateModal('legal')}
                                        disabled={loadingLegal}
                                        className="px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" />
                                        With Feedback
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Regenerate Modal */}
            <RegenerateModal
                isOpen={regenerateModal.isOpen}
                onClose={() => setRegenerateModal({ isOpen: false, type: null })}
                onRegenerate={handleRegenerate}
                title={getModalTitle()}
                isLoading={isRegenerateLoading()}
                onGetAiSuggestion={() => getAiSuggestionForType(regenerateModal.type || '')}
                isGettingAiSuggestion={isGettingAiSuggestion}
            />
        </div>
    );
};

export default StrategyToolsPanel;
