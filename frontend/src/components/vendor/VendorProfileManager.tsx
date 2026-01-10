import { useState, useEffect, useRef } from 'react';
import {
    BriefcaseIcon,
    UserGroupIcon,
    TrophyIcon,
    SparklesIcon,
    ChatBubbleLeftRightIcon,
    PlusIcon,
    PencilIcon,
    TrashIcon,
    StarIcon,
    CheckCircleIcon,
    ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { vendorProfileApi, VendorClient, VendorSuccessStory, VendorCapability, VendorTestimonial } from '@/api/vendorProfile';
import ClientModal from './ClientModal.tsx';
import SuccessStoryModal from './SuccessStoryModal.tsx';
import CapabilityModal from './CapabilityModal.tsx';
import TestimonialModal from './TestimonialModal.tsx';
import BulkUploadModal from './BulkUploadModal.tsx';
import CompanyInfoModal from './CompanyInfoModal.tsx';
import ExtractionReviewModal from './ExtractionReviewModal.tsx';

type TabType = 'overview' | 'clients' | 'stories' | 'capabilities' | 'testimonials';

export default function VendorProfileManager() {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [profile, setProfile] = useState<any>(null);
    const [clients, setClients] = useState<VendorClient[]>([]);
    const [stories, setStories] = useState<VendorSuccessStory[]>([]);
    const [capabilities, setCapabilities] = useState<VendorCapability[]>([]);
    const [testimonials, setTestimonials] = useState<VendorTestimonial[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showClientModal, setShowClientModal] = useState(false);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [showCapabilityModal, setShowCapabilityModal] = useState(false);
    const [showTestimonialModal, setShowTestimonialModal] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [showCompanyInfoModal, setShowCompanyInfoModal] = useState(false);
    const [showExtractionReview, setShowExtractionReview] = useState(false);
    const [extractionResult, setExtractionResult] = useState<any>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [bulkUploadType, setBulkUploadType] = useState<'clients' | 'stories' | 'capabilities' | 'testimonials'>('clients');
    const [editingItem, setEditingItem] = useState<any>(null);

    const extractionInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsExtracting(true);
        const loadingToast = toast.loading(`Extracting data from ${file.name}...`);

        try {
            const response = await vendorProfileApi.extractFromDocument(file);
            setExtractionResult(response.data.vendor_profile);
            setShowExtractionReview(true);
            toast.success('Extraction complete! Please review the data.', { id: loadingToast });
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to extract data', { id: loadingToast });
        } finally {
            setIsExtracting(false);
            if (extractionInputRef.current) {
                extractionInputRef.current.value = '';
            }
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        if (activeTab === 'clients') loadClients();
        else if (activeTab === 'stories') loadStories();
        else if (activeTab === 'capabilities') loadCapabilities();
        else if (activeTab === 'testimonials') loadTestimonials();
    }, [activeTab]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const response = await vendorProfileApi.getProfile();
            setProfile(response.data);
        } catch (error: any) {
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const loadClients = async () => {
        try {
            const response = await vendorProfileApi.getClients();
            setClients(response.data);
        } catch (error) {
            toast.error('Failed to load clients');
        }
    };

    const loadStories = async () => {
        try {
            const response = await vendorProfileApi.getSuccessStories();
            setStories(response.data);
        } catch (error) {
            toast.error('Failed to load success stories');
        }
    };

    const loadCapabilities = async () => {
        try {
            const response = await vendorProfileApi.getCapabilities();
            setCapabilities(response.data);
        } catch (error) {
            toast.error('Failed to load accelerators');
        }
    };

    const loadTestimonials = async () => {
        try {
            const response = await vendorProfileApi.getTestimonials();
            setTestimonials(response.data);
        } catch (error) {
            toast.error('Failed to load testimonials');
        }
    };

    const handleDeleteClient = async (id: number) => {
        if (!confirm('Are you sure you want to delete this client?')) return;
        try {
            await vendorProfileApi.deleteClient(id);
            toast.success('Client deleted');
            loadClients();
        } catch (error) {
            toast.error('Failed to delete client');
        }
    };

    const handleDeleteStory = async (id: number) => {
        if (!confirm('Are you sure you want to delete this success story?')) return;
        try {
            await vendorProfileApi.deleteSuccessStory(id);
            toast.success('Success story deleted');
            loadStories();
        } catch (error) {
            toast.error('Failed to delete story');
        }
    };

    const handleToggleFeatured = async (id: number) => {
        try {
            await vendorProfileApi.toggleFeatured(id);
            toast.success('Featured status updated');
            loadStories();
        } catch (error) {
            toast.error('Failed to update featured status');
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BriefcaseIcon, count: null },
        { id: 'clients', label: 'Clients', icon: UserGroupIcon, count: profile?.stats?.clients_count },
        { id: 'stories', label: 'Success Stories', icon: TrophyIcon, count: profile?.stats?.success_stories_count },
        { id: 'capabilities', label: 'Accelerators', icon: SparklesIcon, count: profile?.stats?.capabilities_count },
        { id: 'testimonials', label: 'Testimonials', icon: ChatBubbleLeftRightIcon, count: profile?.stats?.testimonials_count },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Main Header */}
            <div className="bg-white rounded-xl shadow-sm border border-border p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary">Vendor Profile</h2>
                        <p className="text-text-secondary text-sm mt-1">Manage your company's information and experience portfolio for RFP generation</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => extractionInputRef.current?.click()}
                            disabled={isExtracting}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isExtracting ? (
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <ArrowUpTrayIcon className="h-4 w-4" />
                            )}
                            Import Profile from Doc
                        </button>
                        <input
                            type="file"
                            ref={extractionInputRef}
                            className="hidden"
                            accept=".pdf,.docx,.doc"
                            onChange={handleFileUpload}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { key: 'clients_count', label: 'Clients' },
                        { key: 'ongoing_clients', label: 'Active' },
                        { key: 'success_stories_count', label: 'Stories' },
                        { key: 'capabilities_count', label: 'Accelerators' },
                        { key: 'testimonials_count', label: 'Testimonials' }
                    ].map((item) => (
                        <div key={item.key} className="bg-gray-50 rounded-lg p-4 border border-border">
                            <div className="text-2xl font-bold text-text-primary">{profile?.stats?.[item.key] || 0}</div>
                            <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">{item.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
                <nav className="flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                                }`}
                        >
                            <tab.icon className="h-5 w-5" />
                            {tab.label}
                            {tab.count !== null && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Company Information</h3>
                            <button
                                onClick={() => setShowCompanyInfoModal(true)}
                                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors"
                            >
                                <PencilIcon className="h-4 w-4" />
                                Edit Info
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Company Name</label>
                                <p className="font-medium text-text-primary mt-1">{profile?.company_name || 'Not set'}</p>
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Registration Country</label>
                                <p className="font-medium text-text-primary mt-1">{profile?.registration_country || 'Not set'}</p>
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Years in Business</label>
                                <p className="font-medium text-text-primary mt-1">{profile?.years_in_business || 'Not set'}</p>
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Employee Count</label>
                                <p className="font-medium text-text-primary mt-1">{profile?.employee_count_range || 'Not set'}</p>
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Annual Revenue</label>
                                <p className="font-medium text-text-primary mt-1">{profile?.annual_revenue_range || 'Not set'}</p>
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Headquarters</label>
                                <p className="font-medium text-text-primary mt-1">{profile?.headquarters_location || 'Not set'}</p>
                            </div>
                        </div>

                        {profile?.company_description && (
                            <div className="pt-4 border-t border-gray-100">
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Description</label>
                                <p className="text-text-primary mt-2 leading-relaxed">{profile.company_description}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-gray-100">
                            {profile?.mission_statement && (
                                <div>
                                    <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Mission Statement</label>
                                    <p className="text-text-primary mt-2 italic">"{profile.mission_statement}"</p>
                                </div>
                            )}
                            {profile?.value_proposition && (
                                <div>
                                    <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Value Proposition</label>
                                    <p className="text-text-primary mt-2">{profile.value_proposition}</p>
                                </div>
                            )}
                        </div>

                        {profile?.certifications?.length > 0 && (
                            <div className="pt-4 border-t border-gray-100">
                                <label className="text-xs text-text-secondary uppercase font-bold tracking-wider">Certifications</label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {profile.certifications.map((cert: string, idx: number) => (
                                        <span key={idx} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm flex items-center gap-1 border border-green-100">
                                            <CheckCircleIcon className="h-4 w-4" />
                                            {cert}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!profile?.company_name && (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <BriefcaseIcon className="h-12 w-12 mx-auto mb-3 opacity-30 text-indigo-600" />
                                <h4 className="font-bold text-text-primary">Empty Profile</h4>
                                <p className="text-text-secondary text-sm mb-6">Start by importing your company profile document or add info manually.</p>
                                <div className="flex justify-center gap-4">
                                    <button
                                        onClick={() => setShowCompanyInfoModal(true)}
                                        className="px-4 py-2 border border-gray-300 text-text-primary rounded-lg font-medium hover:bg-gray-100 transition-colors"
                                    >
                                        Add Manually
                                    </button>
                                    <button
                                        onClick={() => extractionInputRef.current?.click()}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                    >
                                        <ArrowUpTrayIcon className="h-4 w-4" />
                                        Import from Document
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'clients' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Client Portfolio</h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setBulkUploadType('clients');
                                        setShowBulkUpload(true);
                                    }}
                                    className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2"
                                >
                                    <ArrowUpTrayIcon className="h-4 w-4" />
                                    Bulk Upload
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingItem(null);
                                        setShowClientModal(true);
                                    }}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Client
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {clients.map((client) => (
                                <div key={client.id} className="border border-border rounded-xl p-5 hover:shadow-lg transition-all bg-white group relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-text-primary text-lg">{client.client_name}</h4>
                                            <p className="text-sm text-indigo-600 font-medium">{client.client_industry}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(client);
                                                    setShowClientModal(true);
                                                }}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <PencilIcon className="h-4 w-4 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClient(client.id!)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <TrashIcon className="h-4 w-4 text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-4 border-t border-gray-50">
                                        <div className="flex justify-between items-center">
                                            <span className="text-text-secondary text-sm">Status</span>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${client.relationship_status === 'ongoing'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {client.relationship_status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-text-secondary text-sm">Client Size</span>
                                            <span className="font-semibold text-text-primary text-sm">{client.client_size}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {clients.length === 0 && (
                            <EmptyState icon={UserGroupIcon} title="No clients added yet" description="Add your first client to showcase your portfolio" />
                        )}
                    </div>
                )}

                {activeTab === 'stories' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Success Stories</h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setBulkUploadType('stories');
                                        setShowBulkUpload(true);
                                    }}
                                    className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2"
                                >
                                    <ArrowUpTrayIcon className="h-4 w-4" />
                                    Bulk Upload
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingItem(null);
                                        setShowStoryModal(true);
                                    }}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Story
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {stories.map((story) => (
                                <div key={story.id} className="border border-border rounded-xl p-6 hover:shadow-lg transition-all bg-white group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="font-bold text-xl text-text-primary">{story.title}</h4>
                                                {story.is_featured && (
                                                    <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold uppercase">
                                                        <StarIconSolid className="h-3 w-3" /> Featured
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-medium text-indigo-600">
                                                {story.client_name} <span className="text-gray-300 mx-2">|</span> {story.industry}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleToggleFeatured(story.id!)}
                                                className={`p-2 rounded-lg transition-colors ${story.is_featured ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400 hover:text-yellow-600'}`}
                                            >
                                                <StarIconSolid className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingItem(story);
                                                    setShowStoryModal(true);
                                                }}
                                                className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStory(story.id!)}
                                                className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-100">
                                        <div>
                                            <h5 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Challenge</h5>
                                            <p className="text-sm text-text-primary leading-relaxed">{story.challenge}</p>
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Solution</h5>
                                            <p className="text-sm text-text-primary leading-relaxed">{story.solution}</p>
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Impact</h5>
                                            <p className="text-sm text-text-primary leading-relaxed font-medium">{story.impact}</p>
                                        </div>
                                    </div>

                                    {story.tags && story.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-6">
                                            {story.tags.map((tag, idx) => (
                                                <span key={idx} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium border border-gray-200">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {stories.length === 0 && (
                            <EmptyState icon={TrophyIcon} title="No success stories" description="Showcase your impact with detailed case studies." />
                        )}
                    </div>
                )}

                {activeTab === 'capabilities' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Accelerators & POCs</h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setBulkUploadType('capabilities');
                                        setShowBulkUpload(true);
                                    }}
                                    className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2"
                                >
                                    <ArrowUpTrayIcon className="h-4 w-4" />
                                    Bulk Upload
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingItem(null);
                                        setShowCapabilityModal(true);
                                    }}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Accelerator
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {capabilities.map((cap) => (
                                <div key={cap.id} className="border border-border rounded-xl p-6 bg-white hover:shadow-lg transition-all border-l-4 border-l-indigo-600">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-text-primary text-lg">{cap.capability_name}</h4>
                                        <button
                                            onClick={() => { setEditingItem(cap); setShowCapabilityModal(true); }}
                                            className="text-gray-400 hover:text-indigo-600 transition-colors"
                                        >
                                            <PencilIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-text-secondary mb-4 leading-relaxed">{cap.description}</p>
                                    {cap.time_saved && (
                                        <div className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 mb-4">
                                            <SparklesIcon className="h-4 w-4" />
                                            Efficiency Impact: {cap.time_saved}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        {cap.technologies_used?.map((tech, i) => (
                                            <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold border border-gray-200">{tech}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {capabilities.length === 0 && (
                            <EmptyState icon={SparklesIcon} title="No accelerators" description="List your technical assets and ready-made solutions." />
                        )}
                    </div>
                )}

                {activeTab === 'testimonials' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {testimonials.map((test) => (
                            <div key={test.id} className="bg-gray-50 border border-border rounded-xl p-6 relative">
                                <ChatBubbleLeftRightIcon className="absolute top-4 right-4 h-8 w-8 text-indigo-100" />
                                <div className="flex mb-4">
                                    {Array.from({ length: test.rating || 5 }).map((_, i) => (
                                        <StarIconSolid key={i} className="h-4 w-4 text-yellow-500" />
                                    ))}
                                </div>
                                <p className="text-text-primary italic mb-6 leading-relaxed">"{test.testimonial_text}"</p>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                                        {test.client_name[0]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-text-primary text-sm">{test.client_name}</p>
                                        <p className="text-xs text-text-secondary">{test.client_designation}, {test.client_company}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="md:col-span-2">
                            <button
                                onClick={() => { setEditingItem(null); setShowTestimonialModal(true); }}
                                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-text-secondary hover:bg-gray-50 transition-all flex items-center justify-center gap-2 font-medium"
                            >
                                <PlusIcon className="h-5 w-5" />
                                Add Customer Testimonial
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showClientModal && (
                <ClientModal
                    client={editingItem}
                    onClose={() => { setShowClientModal(false); setEditingItem(null); }}
                    onSave={() => { setShowClientModal(false); setEditingItem(null); loadClients(); loadProfile(); }}
                />
            )}

            {showCompanyInfoModal && (
                <CompanyInfoModal
                    profile={profile}
                    onClose={() => setShowCompanyInfoModal(false)}
                    onSave={() => { setShowCompanyInfoModal(false); loadProfile(); }}
                />
            )}

            {showStoryModal && (
                <SuccessStoryModal
                    story={editingItem}
                    onClose={() => { setShowStoryModal(false); setEditingItem(null); }}
                    onSave={() => { setShowStoryModal(false); setEditingItem(null); loadStories(); loadProfile(); }}
                />
            )}

            {showCapabilityModal && (
                <CapabilityModal
                    capability={editingItem}
                    onClose={() => { setShowCapabilityModal(false); setEditingItem(null); }}
                    onSave={() => { setShowCapabilityModal(false); setEditingItem(null); loadCapabilities(); loadProfile(); }}
                />
            )}

            {showTestimonialModal && (
                <TestimonialModal
                    testimonial={editingItem}
                    onClose={() => { setShowTestimonialModal(false); setEditingItem(null); }}
                    onSave={() => { setShowTestimonialModal(false); setEditingItem(null); loadTestimonials(); loadProfile(); }}
                />
            )}

            {showBulkUpload && (
                <BulkUploadModal
                    type={bulkUploadType}
                    onClose={() => setShowBulkUpload(false)}
                    onUpload={async (file) => {
                        const response = await vendorProfileApi.bulkUpload(bulkUploadType, file);
                        if (bulkUploadType === 'clients') await loadClients();
                        else if (bulkUploadType === 'stories') await loadStories();
                        else if (bulkUploadType === 'capabilities') await loadCapabilities();
                        else if (bulkUploadType === 'testimonials') await loadTestimonials();
                        await loadProfile();
                        return response.data;
                    }}
                />
            )}

            {showExtractionReview && extractionResult && (
                <ExtractionReviewModal
                    isOpen={showExtractionReview}
                    onClose={() => setShowExtractionReview(false)}
                    data={extractionResult}
                    onSaveComplete={() => {
                        loadProfile();
                        if (activeTab === 'clients') loadClients();
                        else if (activeTab === 'stories') loadStories();
                        else if (activeTab === 'capabilities') loadCapabilities();
                        else if (activeTab === 'testimonials') loadTestimonials();
                    }}
                />
            )}
        </div>
    );
}

function EmptyState({ icon: Icon, title, description }: any) {
    return (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Icon className="h-16 w-16 mx-auto mb-4 text-indigo-200" />
            <h4 className="text-lg font-bold text-text-primary">{title}</h4>
            <p className="text-text-secondary max-w-sm mx-auto mt-2">{description}</p>
        </div>
    );
}
