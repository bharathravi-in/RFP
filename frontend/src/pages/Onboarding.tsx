import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api, { organizationsApi } from '@/api/client';
import toast from 'react-hot-toast';
import {
    BuildingOfficeIcon,
    FolderIcon,
    CheckIcon,
    CpuChipIcon,
    RocketLaunchIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import KnowledgeProfiles from '@/components/knowledge/KnowledgeProfiles';
import AIProviderSetup from '@/components/common/AIProviderSetup';

// Steps definition
const STEPS = [
    { id: 1, name: 'Organization', description: 'Setup your workspace', icon: BuildingOfficeIcon },
    { id: 2, name: 'AI Configuration', description: 'Connect AI provider', icon: CpuChipIcon },
    { id: 3, name: 'Knowledge Profile', description: 'AI configuration', icon: FolderIcon },
];

export default function Onboarding() {
    const navigate = useNavigate();
    const { organization, setOrganization } = useAuthStore();
    const [currentStep, setCurrentStep] = useState(1);

    // Organization State
    const [orgName, setOrgName] = useState(organization?.name || '');
    const [isSavingOrg, setIsSavingOrg] = useState(false);

    // Initialize state from existing organization data
    useEffect(() => {
        if (organization) {
            setOrgName(organization.name || '');
        }
    }, [organization]);

    // Check existing progress to set initial step
    useEffect(() => {
        const checkProgress = async () => {
            if (!organization) return;

            let step = 1;
            if (organization.name) step = 2; // Go to AI config after org creation

            try {
                const profilesResponse = await api.get('/knowledge/profiles');
                const count = profilesResponse.data.profiles?.length || 0;
                if (count > 0 && step >= 2) {
                    // All done!
                    navigate('/dashboard');
                    return;
                }
                setCurrentStep(step);
            } catch (err) {
                console.error('Failed to fetch profiles', err);
                setCurrentStep(step);
            }
        };
        checkProgress();
    }, [organization?.id, navigate]);

    // Handlers
    const handleSaveOrganization = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return toast.error('Organization name is required');

        setIsSavingOrg(true);
        try {
            let response;
            if (organization?.id) {
                response = await organizationsApi.update(organization.id, { name: orgName });
            } else {
                response = await organizationsApi.create({ name: orgName });
            }
            setOrganization(response.data.organization);
            toast.success('Organization saved');
            setCurrentStep(2);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save organization');
        } finally {
            setIsSavingOrg(false);
        }
    };



    const handleFinish = () => {
        toast.success("You're all set! Redirecting to dashboard...");
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="RFP Pro" className="h-8 w-8" />
                    <span className="font-bold text-gray-900 text-lg">RFP Pro Setup</span>
                </div>
                <button onClick={() => {
                    localStorage.clear();
                    window.location.href = '/login';
                }} className="text-sm text-gray-500 hover:text-gray-700">
                    Sign Out
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 max-w-5xl mx-auto w-full p-8">
                {/* Stepper */}
                <div className="mb-12">
                    <div className="flex items-center justify-between relative">
                        {/* Connecting Line */}
                        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 -z-10" />

                        {STEPS.map((step) => {
                            const isCompleted = step.id < currentStep;
                            const isCurrent = step.id === currentStep;

                            return (
                                <div key={step.id} className="flex flex-col items-center bg-gray-50 px-4 z-10">
                                    <div className={clsx(
                                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300",
                                        isCompleted ? "bg-green-500 border-green-500 text-white" :
                                            isCurrent ? "bg-white border-primary text-primary" :
                                                "bg-white border-gray-300 text-gray-400"
                                    )}>
                                        {isCompleted ? <CheckIcon className="h-6 w-6" /> : <step.icon className="h-5 w-5" />}
                                    </div>
                                    <div className="mt-2 text-center">
                                        <p className={clsx("text-sm font-semibold", isCurrent ? "text-gray-900" : "text-gray-500")}>{step.name}</p>
                                        <p className="text-xs text-gray-400">{step.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 min-h-[400px]">
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {currentStep === 1 && "Create Your Organization"}
                                {currentStep === 2 && "AI Configuration"}
                                {currentStep === 3 && "Configure Knowledge Profile"}
                            </h2>
                            <p className="text-gray-500 mt-2">
                                {currentStep === 1 && "Start by naming your collaborative workspace."}
                                {currentStep === 2 && "Connect your preferred AI provider to power automation features."}
                                {currentStep === 3 && "Set up AI dimensions for accurate response generation."}
                            </p>
                        </div>

                        {/* Step 1: Organization Form */}
                        {currentStep === 1 && (
                            <form onSubmit={handleSaveOrganization} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name</label>
                                    <input
                                        type="text"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        className="input w-full text-lg p-4"
                                        placeholder="e.g. Acme Inc."
                                        autoFocus
                                    />
                                </div>
                                <button type="submit" disabled={isSavingOrg || !orgName.trim()} className="btn-primary w-full py-3 text-lg justify-center">
                                    {isSavingOrg ? 'Saving...' : 'Continue to AI Configuration'}
                                </button>
                            </form>
                        )}

                        {/* Step 2: AI Configuration */}
                        {currentStep === 2 && (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <AIProviderSetup key={organization?.id} onConfigured={() => setCurrentStep(3)} />
                                <div className="text-center">
                                    <button
                                        onClick={() => setCurrentStep(3)}
                                        className="text-sm text-gray-400 hover:text-gray-600 underline"
                                    >
                                        Skip for now
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Knowledge Profiles */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                                    <p className="text-sm text-blue-800">
                                        Create at least one Knowledge Profile (e.g., "General", "Security", or "Sales").
                                        This helps the AI understand how to answer questions.
                                    </p>
                                </div>

                                {/* We reuse functionality but might need to guide user interaction */}
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <KnowledgeProfiles />
                                </div>

                                <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-100">
                                    <button onClick={() => setCurrentStep(2)} className="text-sm text-gray-500 hover:text-gray-900">
                                        &larr; Back to AI Configuration
                                    </button>
                                    <button onClick={() => {
                                        // Re-check count before proceeding
                                        api.get('/knowledge/profiles').then((res: any) => {
                                            if (res.data.profiles?.length > 0) {
                                                handleFinish();
                                            } else {
                                                toast.error('Please create at least one Knowledge Profile first.');
                                            }
                                        });
                                    }} className="btn-primary px-8 py-3 text-lg shadow-lg shadow-primary/20">
                                        Complete Setup <RocketLaunchIcon className="h-5 w-5 ml-2" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

