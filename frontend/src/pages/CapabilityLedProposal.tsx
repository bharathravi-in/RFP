/**
 * Capability-Led Proposal Page
 * 
 * Dedicated screen for creating capability-led proposals (vendor-driven, sales-led).
 * No RFP document needed - just client meeting notes.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    ArrowLeftIcon,
    SparklesIcon,
    CheckCircleIcon,
    DocumentTextIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';
import api from '@/api/client';

interface CapabilityContext {
    id: number;
    project_id: number;
    client_product: string | null;
    client_domain: string | null;
    client_challenges: string[];
    client_goals: string[];
    meeting_notes: string | null;
    structured_context: any;
    alignment_mapping: any[];
    generation_status: 'pending' | 'in_progress' | 'complete' | 'error';
    generated_sections: any[];
    created_at: string;
    updated_at: string;
}

interface Project {
    id: number;
    name: string;
    client_name: string;
    industry: string | null;
}

export default function CapabilityLedProposal() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | null>(null);
    const [capabilityContext, setCapabilityContext] = useState<CapabilityContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        client_product: '',
        client_domain: '',
        meeting_notes: '',
    });
    const [goalsText, setGoalsText] = useState('');
    const [challengesText, setChallengesText] = useState('');

    // Load project and existing capability context
    useEffect(() => {
        const loadData = async () => {
            try {
                // Load project
                const projectRes = await api.get(`/projects/${id}`);
                setProject(projectRes.data);

                // Try to load existing capability context
                try {
                    const contextRes = await api.get(`/agents/capability/${id}`);
                    if (contextRes.data?.success && contextRes.data?.context) {
                        const ctx = contextRes.data.context;
                        setCapabilityContext(ctx);

                        // Pre-fill form with existing data
                        setFormData({
                            client_product: ctx.client_product || '',
                            client_domain: ctx.client_domain || '',
                            meeting_notes: ctx.meeting_notes || '',
                        });
                        setGoalsText((ctx.client_goals || []).join('\n'));
                        setChallengesText((ctx.client_challenges || []).join('\n'));
                    }
                } catch (e) {
                    // No existing context - that's fine
                }
            } catch (error: any) {
                toast.error('Failed to load project');
                navigate('/projects');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [id, navigate]);

    const handleGenerate = async () => {
        // Validation
        if (!formData.client_product.trim()) {
            toast.error('Please enter the client product/service');
            return;
        }
        if (formData.meeting_notes.trim().length < 50) {
            toast.error('Meeting notes must be at least 50 characters');
            return;
        }

        setIsGenerating(true);

        try {
            // Parse goals and challenges from text
            const goals = goalsText.split('\n').filter(g => g.trim());
            const challenges = challengesText.split('\n').filter(c => c.trim());

            toast.loading('Generating capability-led proposal...', { id: 'capability-gen' });

            const response = await api.post(`/agents/capability/generate/${id}`, {
                client_product: formData.client_product,
                client_domain: formData.client_domain,
                meeting_notes: formData.meeting_notes,
                client_goals: goals,
                client_challenges: challenges,
                client_name: project?.client_name,
            });

            if (response.data?.success) {
                toast.success(`Proposal created with ${response.data.rfp_sections_created} sections!`, { id: 'capability-gen' });

                // Reload context to show updated status
                try {
                    const contextRes = await api.get(`/agents/capability/${id}`);
                    if (contextRes.data?.context) {
                        setCapabilityContext(contextRes.data.context);
                    }
                } catch (e) { }
            } else {
                toast.error(response.data?.error || 'Failed to generate proposal', { id: 'capability-gen' });
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate proposal', { id: 'capability-gen' });
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const isComplete = capabilityContext?.generation_status === 'complete';
    const sectionsGenerated = capabilityContext?.generated_sections?.length || 0;

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-secondary">
                <Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
                <span>/</span>
                <Link to="/projects" className="hover:text-primary transition-colors">Projects</Link>
                <span>/</span>
                <Link to={`/projects/${id}`} className="hover:text-primary transition-colors">
                    {project?.name || 'Project'}
                </Link>
                <span>/</span>
                <span className="text-text-primary">Capability-Led Proposal</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    to={`/projects/${id}`}
                    className="p-2 hover:bg-surface-light rounded-lg transition-colors"
                >
                    <ArrowLeftIcon className="w-5 h-5 text-secondary" />
                </Link>
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-primary" />
                        Capability-Led Proposal
                    </h1>
                    <p className="text-secondary text-sm">
                        Create a proposal based on client meeting notes - no RFP required
                    </p>
                </div>
            </div>

            {/* Success State */}
            {isComplete && (
                <div className="card bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/30">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                            <CheckCircleIcon className="w-6 h-6 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold text-green-400">
                                Proposal Generated Successfully!
                            </h2>
                            <p className="text-secondary mt-1">
                                {sectionsGenerated} sections have been created and are ready for review.
                            </p>
                            <div className="flex gap-3 mt-4">
                                <Link
                                    to={`/projects/${id}/proposal`}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <DocumentTextIcon className="w-4 h-4" />
                                    View in Proposal Builder
                                    <ArrowRightIcon className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={() => {
                                        setCapabilityContext(prev => prev ? { ...prev, generation_status: 'pending' } : null);
                                    }}
                                    className="btn-secondary"
                                >
                                    Regenerate
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Generated Sections List */}
                    {capabilityContext?.generated_sections && capabilityContext.generated_sections.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <h3 className="text-sm font-medium text-secondary mb-3">Generated Sections:</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {capabilityContext.generated_sections.map((section: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                                        <span>{section.name || section.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* In Progress State */}
            {capabilityContext?.generation_status === 'in_progress' && (
                <div className="card bg-primary/10 border-primary/30">
                    <div className="flex items-center gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        <div>
                            <h2 className="text-lg font-semibold">Generating Proposal...</h2>
                            <p className="text-secondary text-sm">This may take a minute</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Form */}
            {!isComplete && (
                <div className="card">
                    <div className="border-b border-border pb-4 mb-6">
                        <h2 className="text-lg font-semibold">Client Context</h2>
                        <p className="text-secondary text-sm mt-1">
                            Enter details from your client meeting or discovery call
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Client Product/Service */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Client Product/Service <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.client_product}
                                onChange={(e) => setFormData(prev => ({ ...prev, client_product: e.target.value }))}
                                placeholder="e.g., Enterprise SaaS platform for HR management"
                                className="w-full px-4 py-3 rounded-lg bg-surface-dark border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            />
                        </div>

                        {/* Industry/Domain */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Industry/Domain
                            </label>
                            <select
                                value={formData.client_domain}
                                onChange={(e) => setFormData(prev => ({ ...prev, client_domain: e.target.value }))}
                                className="w-full px-4 py-3 rounded-lg bg-surface-dark border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            >
                                <option value="">Select industry...</option>
                                <option value="technology">Technology</option>
                                <option value="healthcare">Healthcare</option>
                                <option value="finance">Finance & Banking</option>
                                <option value="retail">Retail & E-commerce</option>
                                <option value="manufacturing">Manufacturing</option>
                                <option value="government">Government</option>
                                <option value="education">Education</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        {/* Meeting Notes */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Meeting Notes / Client Context <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={formData.meeting_notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, meeting_notes: e.target.value }))}
                                placeholder="Paste your meeting notes here. Include: client background, what they're looking for, timeline, budget mentions, key stakeholders, pain points discussed..."
                                rows={8}
                                className="w-full px-4 py-3 rounded-lg bg-surface-dark border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                            />
                            <p className="text-xs text-secondary mt-1">
                                {formData.meeting_notes.length} characters (minimum 50)
                            </p>
                        </div>

                        {/* Goals and Challenges side by side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Client Goals (one per line)
                                </label>
                                <textarea
                                    value={goalsText}
                                    onChange={(e) => setGoalsText(e.target.value)}
                                    placeholder="Reduce operational costs&#10;Improve time-to-market&#10;Modernize tech stack"
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-lg bg-surface-dark border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Client Challenges (one per line)
                                </label>
                                <textarea
                                    value={challengesText}
                                    onChange={(e) => setChallengesText(e.target.value)}
                                    placeholder="Legacy system maintenance&#10;High technical debt&#10;Skill gaps in team"
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-lg bg-surface-dark border border-border focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none text-sm"
                                />
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="pt-4 border-t border-border">
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !formData.client_product.trim() || formData.meeting_notes.length < 50}
                                className={clsx(
                                    'w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 transition-all',
                                    isGenerating || !formData.client_product.trim() || formData.meeting_notes.length < 50
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-primary to-purple-600 text-white hover:from-primary/90 hover:to-purple-600/90'
                                )}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Generating Capability-Led Proposal...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-5 h-5" />
                                        Generate Capability-Led Proposal
                                    </>
                                )}
                            </button>

                            <p className="text-center text-xs text-secondary mt-3">
                                AI will analyze your notes and create tailored proposal sections
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* What Happens Section */}
            {!isComplete && (
                <div className="card bg-surface/50">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-primary" />
                        What Happens Next?
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex gap-3 items-start">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                            <span className="text-secondary">AI analyzes your meeting notes</span>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                            <span className="text-secondary">Maps needs to your capabilities</span>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                            <span className="text-secondary">Generates value proposition</span>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                            <span className="text-secondary">Creates proposal sections</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
