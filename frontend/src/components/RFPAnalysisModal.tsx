import { useState } from 'react';
import { documentsApi } from '@/api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    XMarkIcon,
    SparklesIcon,
    DocumentTextIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    ChevronRightIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

interface RFPAnalysis {
    document_id: number;
    document_name: string;
    analysis: {
        sections: Array<{ name: string; purpose: string }>;
        themes: string[];
        requirements: string[];
        evaluation_criteria: string[];
        deliverables: string[];
        timeline_mentions: string[];
    };
    suggested_sections: Array<{
        section_type_id: number;
        section_type_slug: string;
        section_type_name: string;
        icon: string;
        reason: string;
        selected: boolean;
    }>;
    questions_extracted: number;
}

interface RFPAnalysisModalProps {
    documentId: number;
    documentName: string;
    projectId: number;
    onClose: () => void;
    onComplete: () => void;
}

export default function RFPAnalysisModal({
    documentId,
    documentName,
    projectId,
    onClose,
    onComplete,
}: RFPAnalysisModalProps) {
    const navigate = useNavigate();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isBuilding, setIsBuilding] = useState(false);
    const [analysis, setAnalysis] = useState<RFPAnalysis | null>(null);
    const [selectedSections, setSelectedSections] = useState<number[]>([]);
    const [step, setStep] = useState<'initial' | 'results' | 'building'>('initial');

    const startAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const response = await documentsApi.analyze(documentId);
            const data = response.data as RFPAnalysis;
            setAnalysis(data);
            setSelectedSections(
                data.suggested_sections.map(s => s.section_type_id)
            );
            setStep('results');
        } catch {
            toast.error('Analysis failed. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleSection = (sectionTypeId: number) => {
        setSelectedSections(prev =>
            prev.includes(sectionTypeId)
                ? prev.filter(id => id !== sectionTypeId)
                : [...prev, sectionTypeId]
        );
    };

    const buildProposal = async () => {
        if (selectedSections.length === 0) {
            toast.error('Select at least one section');
            return;
        }

        setIsBuilding(true);
        setStep('building');
        try {
            // Pass true for generateContent to trigger AI content generation
            await documentsApi.autoBuildProposal(documentId, selectedSections, true);
            toast.success('Proposal sections created with AI content!');
            onComplete();
            navigate(`/projects/${projectId}/proposal`);
        } catch {
            toast.error('Failed to create sections');
            setStep('results');
        } finally {
            setIsBuilding(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                            <SparklesIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-text-primary">
                                RFP Analysis Agent
                            </h2>
                            <p className="text-sm text-text-muted">{documentName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-background rounded-lg"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'initial' && (
                        <div className="text-center py-8">
                            <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-primary-light flex items-center justify-center">
                                <DocumentTextIcon className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold text-text-primary mb-2">
                                Analyze Your RFP Document
                            </h3>
                            <p className="text-text-secondary mb-6 max-w-md mx-auto">
                                Our AI agent will analyze your RFP to extract questions,
                                identify key themes, and suggest the optimal proposal structure.
                            </p>
                            <button
                                onClick={startAnalysis}
                                disabled={isAnalyzing}
                                className="btn-primary px-6 py-3"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="h-5 w-5" />
                                        Start Analysis
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {step === 'results' && analysis && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="bg-success-light/20 rounded-lg p-4 flex items-start gap-3">
                                <CheckCircleIcon className="h-6 w-6 text-success flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-text-primary">Analysis Complete</p>
                                    <p className="text-sm text-text-secondary">
                                        Found {analysis.questions_extracted} questions and
                                        {' '}{analysis.analysis.themes?.length || 0} key themes
                                    </p>
                                </div>
                            </div>

                            {/* Themes */}
                            {analysis.analysis.themes && analysis.analysis.themes.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-text-secondary mb-2">
                                        Key Themes Detected
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.analysis.themes.map((theme, i) => (
                                            <span
                                                key={i}
                                                className="px-3 py-1 bg-primary-light text-primary text-sm rounded-full"
                                            >
                                                {theme}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Suggested Sections */}
                            <div>
                                <h4 className="text-sm font-medium text-text-secondary mb-3">
                                    Recommended Proposal Sections
                                </h4>
                                <div className="space-y-2">
                                    {analysis.suggested_sections.map(section => (
                                        <label
                                            key={section.section_type_id}
                                            className={clsx(
                                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                                                selectedSections.includes(section.section_type_id)
                                                    ? 'border-primary bg-primary-light/50'
                                                    : 'border-border hover:border-gray-300'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedSections.includes(section.section_type_id)}
                                                onChange={() => toggleSection(section.section_type_id)}
                                                className="h-4 w-4 text-primary rounded"
                                            />
                                            <span className="text-xl">{section.icon}</span>
                                            <div className="flex-1">
                                                <p className="font-medium text-text-primary">
                                                    {section.section_type_name}
                                                </p>
                                                <p className="text-sm text-text-muted">
                                                    {section.reason}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Requirements Preview */}
                            {analysis.analysis.requirements && analysis.analysis.requirements.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-text-secondary mb-2">
                                        Key Requirements Identified
                                    </h4>
                                    <ul className="space-y-1 text-sm text-text-primary">
                                        {analysis.analysis.requirements.slice(0, 5).map((req, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <ChevronRightIcon className="h-4 w-4 text-primary mt-0.5" />
                                                {req}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'building' && (
                        <div className="text-center py-12">
                            <div className="relative h-16 w-16 mx-auto mb-6">
                                <ArrowPathIcon className="h-16 w-16 animate-spin text-primary" />
                                <SparklesIcon className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold text-text-primary mb-2">
                                Building Your Proposal
                            </h3>
                            <p className="text-text-secondary mb-4">
                                Creating {selectedSections.length} sections with AI-generated content...
                            </p>
                            <p className="text-sm text-text-muted">
                                This may take a minute. We're writing tailored content for each section based on your RFP.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'results' && (
                    <div className="flex items-center justify-between p-4 border-t border-border">
                        <p className="text-sm text-text-muted">
                            {selectedSections.length} sections selected
                        </p>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={buildProposal}
                                disabled={selectedSections.length === 0 || isBuilding}
                                className="btn-primary"
                            >
                                <SparklesIcon className="h-4 w-4" />
                                Build Proposal
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
