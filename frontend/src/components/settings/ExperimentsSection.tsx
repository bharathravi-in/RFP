/**
 * A/B Experiments Management Component
 * Allows creating and viewing prompt experiments for AI agents
 */
import { useState, useEffect } from 'react';
import {
    BeakerIcon,
    PlusIcon,
    TrashIcon,
    ChartBarIcon,
    PlayIcon,
    PauseIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { agentsApi } from '@/api/client';

interface Experiment {
    id: string;
    experiment_id: string;
    agent_name: string;
    control_version: string;
    treatment_version: string;
    traffic_split: number;
    status: 'active' | 'paused' | 'completed';
    created_at: string;
    results?: {
        control_success_rate: number;
        treatment_success_rate: number;
        control_count: number;
        treatment_count: number;
        winner?: 'control' | 'treatment' | 'inconclusive';
        confidence: number;
    };
}

const AGENT_OPTIONS = [
    { value: 'DocumentAnalyzerAgent', label: 'Document Analyzer' },
    { value: 'QuestionExtractorAgent', label: 'Question Extractor' },
    { value: 'AnswerGeneratorAgent', label: 'Answer Generator' },
    { value: 'AnswerValidatorAgent', label: 'Answer Validator' },
    { value: 'ComplianceCheckerAgent', label: 'Compliance Checker' },
    { value: 'QualityReviewerAgent', label: 'Quality Reviewer' },
    { value: 'WinThemeAgent', label: 'Win Theme Generator' },
    { value: 'ProposalWriterAgent', label: 'Proposal Writer' },
];

export default function ExperimentsSection() {
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        experiment_id: '',
        agent_name: 'AnswerGeneratorAgent',
        control_version: '',
        treatment_version: '',
        traffic_split: 0.5,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadExperiments();
    }, []);

    const loadExperiments = async () => {
        setLoading(true);
        try {
            const response = await agentsApi.getExperiments();
            setExperiments(response.data.experiments || []);
        } catch (error) {
            console.error('Failed to load experiments:', error);
            // Use mock data for demo if API not available
            setExperiments([
                {
                    id: '1',
                    experiment_id: 'exp_answer_tone_v2',
                    agent_name: 'AnswerGeneratorAgent',
                    control_version: 'v1_formal',
                    treatment_version: 'v2_conversational',
                    traffic_split: 0.5,
                    status: 'active',
                    created_at: new Date().toISOString(),
                    results: {
                        control_success_rate: 0.78,
                        treatment_success_rate: 0.85,
                        control_count: 124,
                        treatment_count: 118,
                        winner: 'treatment',
                        confidence: 0.92,
                    },
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateExperiment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.experiment_id || !formData.control_version || !formData.treatment_version) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            await agentsApi.createExperiment(formData);
            toast.success('Experiment created successfully');
            setShowCreateModal(false);
            setFormData({
                experiment_id: '',
                agent_name: 'AnswerGeneratorAgent',
                control_version: '',
                treatment_version: '',
                traffic_split: 0.5,
            });
            loadExperiments();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create experiment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        <PlayIcon className="h-3 w-3" />
                        Active
                    </span>
                );
            case 'paused':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                        <PauseIcon className="h-3 w-3" />
                        Paused
                    </span>
                );
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        <CheckCircleIcon className="h-3 w-3" />
                        Completed
                    </span>
                );
            default:
                return null;
        }
    };

    const getWinnerBadge = (winner?: string) => {
        if (!winner) return null;
        if (winner === 'inconclusive') {
            return (
                <span className="text-xs text-gray-500">Inconclusive</span>
            );
        }
        return (
            <span className={clsx(
                'text-xs font-medium',
                winner === 'treatment' ? 'text-green-600' : 'text-blue-600'
            )}>
                {winner === 'treatment' ? '🏆 Treatment wins' : '🏆 Control wins'}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-text-primary">A/B Experiments</h3>
                    <p className="text-sm text-text-secondary">
                        Test different prompt versions to optimize AI performance
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <PlusIcon className="h-4 w-4" />
                    New Experiment
                </button>
            </div>

            {/* Experiments List */}
            {experiments.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <BeakerIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No experiments yet</h4>
                    <p className="text-gray-500 mb-4">Create your first A/B test to optimize AI prompts</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary"
                    >
                        Create Experiment
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {experiments.map((exp) => (
                        <div
                            key={exp.id}
                            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-semibold text-gray-900">{exp.experiment_id}</h4>
                                        {getStatusBadge(exp.status)}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Agent: <span className="font-medium">{exp.agent_name}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedExperiment(exp)}
                                    className="text-primary hover:text-primary-dark text-sm font-medium"
                                >
                                    View Details
                                </button>
                            </div>

                            {/* Versions */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-blue-50 rounded-lg p-3">
                                    <div className="text-xs text-blue-600 font-medium mb-1">Control</div>
                                    <div className="text-sm font-mono text-gray-700">{exp.control_version}</div>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3">
                                    <div className="text-xs text-green-600 font-medium mb-1">Treatment</div>
                                    <div className="text-sm font-mono text-gray-700">{exp.treatment_version}</div>
                                </div>
                            </div>

                            {/* Results */}
                            {exp.results && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-700">Results</span>
                                        {getWinnerBadge(exp.results.winner)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-2xl font-bold text-blue-600">
                                                {(exp.results.control_success_rate * 100).toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Control ({exp.results.control_count} samples)
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-green-600">
                                                {(exp.results.treatment_success_rate * 100).toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Treatment ({exp.results.treatment_count} samples)
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs text-gray-500">
                                        Confidence: {(exp.results.confidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <BeakerIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Create New Experiment</h3>
                                <p className="text-sm text-gray-500">Test different prompt versions</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateExperiment} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Experiment ID *
                                </label>
                                <input
                                    type="text"
                                    value={formData.experiment_id}
                                    onChange={(e) => setFormData({ ...formData, experiment_id: e.target.value })}
                                    placeholder="e.g., exp_answer_tone_v2"
                                    className="input w-full"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Agent *
                                </label>
                                <select
                                    value={formData.agent_name}
                                    onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                                    className="input w-full"
                                >
                                    {AGENT_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Control Version *
                                </label>
                                <textarea
                                    value={formData.control_version}
                                    onChange={(e) => setFormData({ ...formData, control_version: e.target.value })}
                                    placeholder="Current/baseline prompt version identifier"
                                    className="input w-full h-20"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Treatment Version *
                                </label>
                                <textarea
                                    value={formData.treatment_version}
                                    onChange={(e) => setFormData({ ...formData, treatment_version: e.target.value })}
                                    placeholder="New prompt version to test"
                                    className="input w-full h-20"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Traffic Split: {(formData.traffic_split * 100).toFixed(0)}%
                                </label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="0.9"
                                    step="0.1"
                                    value={formData.traffic_split}
                                    onChange={(e) => setFormData({ ...formData, traffic_split: parseFloat(e.target.value) })}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Control: {((1 - formData.traffic_split) * 100).toFixed(0)}%</span>
                                    <span>Treatment: {(formData.traffic_split * 100).toFixed(0)}%</span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="btn btn-primary flex-1"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Experiment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
