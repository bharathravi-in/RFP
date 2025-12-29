/**
 * Strategy Tools Panel Component
 * 
 * Provides access to strategic analysis tools:
 * - Win Themes Generator
 * - Competitive Analysis
 * - Pricing Calculator
 * - Legal Review
 */
import React, { useState } from 'react';
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
} from '@heroicons/react/24/outline';
import { agentsApi } from '../../api/client';
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

const StrategyToolsPanel: React.FC<StrategyToolsPanelProps> = ({ projectId }) => {
    // Accordion state
    const [expandedSection, setExpandedSection] = useState<string>('themes');
    const [isLoading, setIsLoading] = useState(true);

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

    // Legal Review State
    const [legalData, setLegalData] = useState<any>(null);
    const [loadingLegal, setLoadingLegal] = useState(false);

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
                        setCompetitiveData(data.strategy.competitive_analysis);
                    }
                    // Load pricing
                    if (data.strategy.pricing) {
                        setPricingData(data.strategy.pricing);
                    }
                    // Load legal review
                    if (data.strategy.legal_review) {
                        setLegalData(data.strategy.legal_review);
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

    // Generate Win Themes
    const generateWinThemes = async () => {
        setLoadingThemes(true);
        try {
            const response = await agentsApi.generateWinThemes(projectId);
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
        }
    };

    // Run Competitive Analysis
    const runCompetitiveAnalysis = async () => {
        setLoadingCompetitive(true);
        try {
            const response = await agentsApi.competitiveAnalysis(projectId);
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
        }
    };

    // Calculate Pricing
    const calculatePricing = async () => {
        setLoadingPricing(true);
        try {
            const response = await agentsApi.calculatePricing(projectId, { complexity: 'medium' });
            const data = response.data;
            if (data.success) {
                setPricingData(data.pricing);
                toast.success('Pricing calculated');
                // Save to database
                await agentsApi.savePricing(projectId, data.pricing);
            } else {
                toast.error(data.error || 'Failed to calculate pricing');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error calculating pricing');
        } finally {
            setLoadingPricing(false);
        }
    };


    // Run Legal Review
    const runLegalReview = async () => {
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
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Strategy Tools</h2>
                    <p className="text-sm text-gray-500">AI-powered proposal strategy insights</p>
                </div>
            </div>

            {/* Win Themes Section */}
            <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
                <button
                    onClick={() => toggleSection('themes')}
                    className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                            <TrophyIcon className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="font-medium text-gray-900">Win Themes</span>
                        {winThemes.length > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                {winThemes.length} themes
                            </span>
                        )}
                    </div>
                    {expandedSection === 'themes' ? (
                        <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                    )}
                </button>
                {expandedSection === 'themes' && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                        {winThemes.length > 0 ? (
                            <div className="mt-4 space-y-3">
                                {winThemes.map((theme, index) => (
                                    <div key={theme.theme_id || index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                            <p className="text-sm text-gray-500 text-center py-4">
                                Generate AI-powered win themes and differentiators
                            </p>
                        )}
                        <button
                            onClick={generateWinThemes}
                            disabled={loadingThemes}
                            className="w-full mt-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loadingThemes ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <TrophyIcon className="h-4 w-4" />
                            )}
                            {winThemes.length > 0 ? 'Regenerate' : 'Generate'} Win Themes
                        </button>
                    </div>
                )}
            </div>

            {/* Competitive Analysis Section */}
            <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
                <button
                    onClick={() => toggleSection('competitive')}
                    className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <ChartBarIcon className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="font-medium text-gray-900">Competitive Analysis</span>
                        {competitiveData && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                Analyzed
                            </span>
                        )}
                    </div>
                    {expandedSection === 'competitive' ? (
                        <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                    )}
                </button>
                {expandedSection === 'competitive' && (
                    <div className="px-4 pb-4 border-t border-gray-100">
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
                        <button
                            onClick={runCompetitiveAnalysis}
                            disabled={loadingCompetitive}
                            className="w-full mt-4 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loadingCompetitive ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <ChartBarIcon className="h-4 w-4" />
                            )}
                            {competitiveData ? 'Refresh' : 'Run'} Competitive Analysis
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
                                {pricingData.pricing_summary?.currency_symbol || pricingData.pricing_summary?.currency || '$'}{pricingData.pricing_summary?.total_cost?.toLocaleString()}
                            </span>
                        )}
                    </div>
                    {expandedSection === 'pricing' ? (
                        <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                    )}
                </button>
                {expandedSection === 'pricing' && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                        {pricingData ? (
                            <div className="mt-4">
                                <div className="text-center mb-4">
                                    <p className="text-3xl font-bold text-green-600">
                                        {pricingData.pricing_summary?.currency_symbol || pricingData.pricing_summary?.currency || '$'}{pricingData.pricing_summary?.total_cost?.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {pricingData.pricing_summary?.currency} | Valid: {pricingData.pricing_summary?.validity_period}
                                    </p>
                                </div>
                                <div className="border-t border-gray-200 pt-3">
                                    {pricingData.effort_breakdown?.map((phase: any, index: number) => (
                                        <div key={index} className="flex justify-between py-1.5 text-sm">
                                            <span className="text-gray-600">{phase.phase}</span>
                                            <span className="font-medium text-gray-900">
                                                {pricingData.pricing_summary?.currency_symbol || pricingData.pricing_summary?.currency || '$'}{phase.phase_total?.toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">
                                Calculate AI-powered pricing estimates based on requirements
                            </p>
                        )}
                        <button
                            onClick={calculatePricing}
                            disabled={loadingPricing}
                            className="w-full mt-4 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loadingPricing ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <CurrencyDollarIcon className="h-4 w-4" />
                            )}
                            {pricingData ? 'Recalculate' : 'Calculate'} Pricing
                        </button>
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
                        <button
                            onClick={runLegalReview}
                            disabled={loadingLegal}
                            className="w-full mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loadingLegal ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <ScaleIcon className="h-4 w-4" />
                            )}
                            {legalData ? 'Re-run' : 'Run'} Legal Review
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StrategyToolsPanel;
