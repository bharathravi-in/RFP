import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api, { organizationsApi, projectsApi } from '@/api/client';
import toast from 'react-hot-toast';
import {
    BuildingOfficeIcon,
    BriefcaseIcon,
    FolderIcon,
    CheckCircleIcon,
    ArrowRightIcon,
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
    { id: 3, name: 'Vendor Profile', description: 'Business details', icon: BriefcaseIcon },
    { id: 4, name: 'Knowledge Profile', description: 'AI configuration', icon: FolderIcon },
];

export default function Onboarding() {
    const navigate = useNavigate();
    const { user, organization, setOrganization, fetchUser } = useAuthStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Organization State
    const [orgName, setOrgName] = useState(organization?.name || '');
    const [isSavingOrg, setIsSavingOrg] = useState(false);

    // Vendor Profile State
    const [vendorProfile, setVendorProfile] = useState({
        registration_country: '',
        years_in_business: '',
        employee_count: '',
        certifications: '',
        geographies: '',
    });
    const [isSavingVendor, setIsSavingVendor] = useState(false);

    // AI Configuration State
    const [apiKey, setApiKey] = useState('');
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);

    // Knowledge Profile State
    const [knowledgeCount, setKnowledgeCount] = useState(0);

    // Initialize state from existing organization data
    useEffect(() => {
        if (organization) {
            setOrgName(organization.name || '');

            if (organization.settings?.vendor_profile) {
                const vp = organization.settings.vendor_profile as any;
                setVendorProfile({
                    registration_country: vp.registration_country || '',
                    years_in_business: vp.years_in_business?.toString() || '',
                    employee_count: vp.employee_count?.toString() || '',
                    certifications: Array.isArray(vp.certifications) ? vp.certifications.join(', ') : (vp.certifications || ''),
                    geographies: Array.isArray(vp.geographies) ? vp.geographies.join(', ') : (vp.geographies || ''),
                });
            }
        }
    }, [organization]);

    // Check existing progress to set initial step
    useEffect(() => {
        const checkProgress = async () => {
            if (!organization) return;

            let step = 1;
            if (organization.name) step = 2;
            // We can check if AI config exists, but for now let's assume if Org exists we go to step 2 (AI), 
            // and if Vendor Profile exists we go to step 4 (Knowledge).
            // Better logic:
            // Step 1: Org Name
            // Step 2: AI Config (Implicitly done if Vendor Profile exists?) -> No, force check?
            // Let's rely on Vendor Profile to indicate Step 3 completion.

            if ((organization.settings as any)?.vendor_profile?.registration_country) step = 4;
            else if (organization.name) step = 2; // Default to AI config after org creation

            // If they are on step 2, we might want to check if they already have an AI config to skip to 3?
            // For now, let's keep it simple. If vendor profile is done, we go to 4. 
            // If only org is done, we go to 2.

            try {
                const profilesResponse = await api.get('/knowledge/profiles');
                const count = profilesResponse.data.profiles?.length || 0;
                setKnowledgeCount(count);
                setKnowledgeCount(count);
                if (count > 0 && step === 4) {
                    // All done!
                    navigate('/dashboard');
                    setCurrentStep(step);
                } else {
                    setCurrentStep(step);
                }
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

    const handleSaveVendorProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorProfile.registration_country) return toast.error('Registration country is required');

        setIsSavingVendor(true);
        try {
            const vendorData = {
                registration_country: vendorProfile.registration_country,
                years_in_business: vendorProfile.years_in_business ? parseInt(vendorProfile.years_in_business) : null,
                employee_count: vendorProfile.employee_count ? parseInt(vendorProfile.employee_count) : null,
                certifications: vendorProfile.certifications ? vendorProfile.certifications.split(',').map(s => s.trim()).filter(Boolean) : [],
                geographies: vendorProfile.geographies ? vendorProfile.geographies.split(',').map(s => s.trim()).filter(Boolean) : [],
            };

            const updatedSettings = {
                ...organization?.settings,
                vendor_profile: vendorData,
            };

            if (organization?.id) {
                const response = await organizationsApi.update(organization.id, { settings: updatedSettings });
                setOrganization(response.data.organization);
                setOrganization(response.data.organization);
                toast.success('Vendor profile saved');
                setCurrentStep(4);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save vendor profile');
        } finally {
            setIsSavingVendor(false);
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
                    <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">R</div>
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
                                {currentStep === 3 && "Setup Vendor Profile"}
                                {currentStep === 4 && "Configure Knowledge Profile"}
                            </h2>
                            <p className="text-gray-500 mt-2">
                                {currentStep === 1 && "Start by naming your collaborative workspace."}
                                {currentStep === 2 && "Connect your preferred AI provider to power automation features."}
                                {currentStep === 3 && "Tell us about your company to improve AI matching."}
                                {currentStep === 4 && "Set up AI dimensions for accurate response generation."}
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
                                    {isSavingOrg ? 'Saving...' : 'Continue to Vendor Profile'}
                                </button>
                            </form>
                        )}

                        {/* Step 2: AI Configuration */}
                        {currentStep === 2 && (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <AIProviderSetup onConfigured={() => setCurrentStep(3)} />
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

                        {/* Step 3: Vendor Profile Form */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                {/* File Upload for Auto-Extraction */}
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                                            <FolderIcon className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-base font-semibold text-blue-900">Auto-fill from Document</h3>
                                            <p className="text-sm text-blue-700 mt-1 mb-4">
                                                Upload your company profile or capability statement (PDF/Doc) to automatically fill these details.
                                            </p>

                                            {/* API Key Configuration - Always visible if key is missing/invalid */}
                                            <div className="mb-4">
                                                {/* <button
                                                    type="button"
                                                    onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                                                    className="text-xs text-blue-600 underline hover:text-blue-800 mb-2"
                                                >
                                                    {showApiKeyInput ? 'Hide AI Settings' : 'Configure AI Settings (API Key)'}
                                                </button> */}

                                                {showApiKeyInput && (
                                                    <div className="bg-white p-3 rounded-md border border-blue-200 mb-2 animate-fade-in">
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Google Gemini API Key
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={apiKey}
                                                            onChange={(e) => setApiKey(e.target.value)}
                                                            placeholder="AIzaSy..."
                                                            className="w-full text-sm p-2 border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                        />
                                                        <p className="text-[10px] text-gray-500 mt-1">
                                                            Required if backend key is invalid. Key is used only for this request.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="file"
                                                    id="vendor-file"
                                                    className="hidden"
                                                    accept=".pdf,.doc,.docx"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;

                                                        const toastId = toast.loading('Analyzing document...');
                                                        try {
                                                            const res = await organizationsApi.extractVendorProfile(file, apiKey);
                                                            const extracted = res.data.vendor_profile;

                                                            setVendorProfile(prev => ({
                                                                ...prev,
                                                                registration_country: extracted.registration_country || prev.registration_country,
                                                                years_in_business: extracted.years_in_business?.toString() || prev.years_in_business,
                                                                employee_count: extracted.employee_count?.toString() || prev.employee_count,
                                                                certifications: Array.isArray(extracted.certifications) ? extracted.certifications.join(', ') : (extracted.certifications || prev.certifications),
                                                                geographies: Array.isArray(extracted.geographies) ? extracted.geographies.join(', ') : (extracted.geographies || prev.geographies),
                                                            }));
                                                            toast.success('Profile details extracted!', { id: toastId });
                                                        } catch (err: any) {
                                                            console.error('Extraction failed', err);
                                                            const errMsg = err.response?.data?.error || 'Failed to analyze document';
                                                            if (errMsg.includes('API key')) {
                                                                setShowApiKeyInput(true);
                                                                toast.error('Invalid API Key. Please provide a valid Gemini API Key above.', { id: toastId });
                                                            } else {
                                                                toast.error(errMsg, { id: toastId });
                                                            }
                                                        } finally {
                                                            // Reset input
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                                <label
                                                    htmlFor="vendor-file"
                                                    className="btn-white text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
                                                >
                                                    Choose File
                                                </label>
                                                <span className="text-xs text-blue-500">Supported: PDF, DOCX</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={handleSaveVendorProfile} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Registration Country *</label>
                                            <input
                                                type="text"
                                                value={vendorProfile.registration_country}
                                                onChange={(e) => setVendorProfile({ ...vendorProfile, registration_country: e.target.value })}
                                                className="input w-full"
                                                placeholder="e.g. United States"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Years in Business</label>
                                            <input
                                                type="number"
                                                value={vendorProfile.years_in_business}
                                                onChange={(e) => setVendorProfile({ ...vendorProfile, years_in_business: e.target.value })}
                                                className="input w-full"
                                                placeholder="e.g. 10"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Employee Count</label>
                                            <input
                                                type="number"
                                                value={vendorProfile.employee_count}
                                                onChange={(e) => setVendorProfile({ ...vendorProfile, employee_count: e.target.value })}
                                                className="input w-full"
                                                placeholder="e.g. 150"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Certifications</label>
                                            <input
                                                type="text"
                                                value={vendorProfile.certifications}
                                                onChange={(e) => setVendorProfile({ ...vendorProfile, certifications: e.target.value })}
                                                className="input w-full"
                                                placeholder="ISO 9001, SOC 2..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Geographies</label>
                                        <input
                                            type="text"
                                            value={vendorProfile.geographies}
                                            onChange={(e) => setVendorProfile({ ...vendorProfile, geographies: e.target.value })}
                                            className="input w-full"
                                            placeholder="North America, EU, APAC..."
                                        />
                                        <p className="text-xs text-text-secondary mt-1">Separate with commas.</p>
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setCurrentStep(2)} className="btn-secondary flex-1 justify-center py-3">
                                            Back
                                        </button>
                                        <button type="submit" disabled={isSavingVendor} className="btn-primary flex-1 justify-center py-3">
                                            {isSavingVendor ? 'Saving...' : 'Continue to Knowledge Profile'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Step 4: Knowledge Profiles */}
                        {currentStep === 4 && (
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
                                    <button onClick={() => setCurrentStep(3)} className="text-sm text-gray-500 hover:text-gray-900">
                                        &larr; Back to Vendor
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

