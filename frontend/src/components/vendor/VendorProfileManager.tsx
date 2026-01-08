import { useState, useEffect } from 'react';
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
    CheckCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { vendorProfileApi, VendorClient, VendorSuccessStory, VendorCapability, VendorTestimonial } from '@/api/vendorProfile';
import ClientModal from './ClientModal.tsx';
import SuccessStoryModal from './SuccessStoryModal.tsx';
import CapabilityModal from './CapabilityModal.tsx';
import TestimonialModal from './TestimonialModal.tsx';

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
    const [editingItem, setEditingItem] = useState<any>(null);

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
            toast.error('Failed to load capabilities');
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
        { id: 'capabilities', label: 'Capabilities', icon: SparklesIcon, count: profile?.stats?.capabilities_count },
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
            {/* Header with Stats */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">Vendor Profile</h2>
                <p className="text-white/90 mb-6">
                    Build a comprehensive profile that AI agents use to create compelling, personalized RFP responses
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {['clients_count', 'ongoing_clients', 'success_stories_count', 'capabilities_count', 'testimonials_count'].map((key) => (
                        <div key={key} className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                            <div className="text-3xl font-bold">{profile?.stats?.[key] || 0}</div>
                            <div className="text-sm text-white/80 capitalize">{key.replace(/_/g, ' ')}</div>
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
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                                }`}
                        >
                            <tab.icon className="h-5 w-5" />
                            {tab.label}
                            {tab.count !== null && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-surface rounded-xl border border-border p-6">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Company Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-text-secondary">Company Name</label>
                                    <p className="font-medium">{profile?.company_name || 'Not set'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-text-secondary">Registration Country</label>
                                    <p className="font-medium">{profile?.registration_country || 'Not set'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-text-secondary">Years in Business</label>
                                    <p className="font-medium">{profile?.years_in_business || 'Not set'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-text-secondary">Employee Count</label>
                                    <p className="font-medium">{profile?.employee_count_range || 'Not set'}</p>
                                </div>
                            </div>
                        </div>

                        {profile?.company_description && (
                            <div>
                                <h4 className="text-sm font-medium text-text-secondary mb-2">Company Description</h4>
                                <p className="text-text-primary">{profile.company_description}</p>
                            </div>
                        )}

                        {profile?.industries_served?.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-text-secondary mb-2">Industries Served</h4>
                                <div className="flex flex-wrap gap-2">
                                    {profile.industries_served.map((industry: string, idx: number) => (
                                        <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                            {industry}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {profile?.certifications?.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-text-secondary mb-2">Certifications</h4>
                                <div className="flex flex-wrap gap-2">
                                    {profile.certifications.map((cert: string, idx: number) => (
                                        <span key={idx} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm flex items-center gap-1">
                                            <CheckCircleIcon className="h-4 w-4" />
                                            {cert}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'clients' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Client Portfolio</h3>
                            <button
                                onClick={() => {
                                    setEditingItem(null);
                                    setShowClientModal(true);
                                }}
                                className="btn-primary flex items-center gap-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Client
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clients.map((client) => (
                                <div key={client.id} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-semibold text-text-primary">{client.client_name}</h4>
                                            <p className="text-sm text-text-secondary">{client.client_industry}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(client);
                                                    setShowClientModal(true);
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded"
                                            >
                                                <PencilIcon className="h-4 w-4 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClient(client.id!)}
                                                className="p-1 hover:bg-red-50 rounded"
                                            >
                                                <TrashIcon className="h-4 w-4 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary">Status:</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${client.relationship_status === 'ongoing'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {client.relationship_status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary">Size:</span>
                                            <span className="font-medium">{client.client_size}</span>
                                        </div>
                                        {client.project_count && (
                                            <div className="flex justify-between">
                                                <span className="text-text-secondary">Projects:</span>
                                                <span className="font-medium">{client.project_count}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {clients.length === 0 && (
                            <div className="text-center py-12 text-text-secondary">
                                <UserGroupIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No clients added yet</p>
                                <p className="text-sm">Add your first client to showcase your portfolio</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'stories' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Success Stories</h3>
                            <button
                                onClick={() => {
                                    setEditingItem(null);
                                    setShowStoryModal(true);
                                }}
                                className="btn-primary flex items-center gap-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Success Story
                            </button>
                        </div>

                        <div className="space-y-4">
                            {stories.map((story) => (
                                <div key={story.id} className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-semibold text-lg text-text-primary">{story.title}</h4>
                                                {story.is_featured && (
                                                    <StarIconSolid className="h-5 w-5 text-yellow-500" />
                                                )}
                                            </div>
                                            <p className="text-sm text-text-secondary">
                                                {story.client_name} • {story.industry} • {story.client_size}
                                            </p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleToggleFeatured(story.id!)}
                                                className="p-1 hover:bg-yellow-50 rounded"
                                                title={story.is_featured ? 'Remove from featured' : 'Mark as featured'}
                                            >
                                                {story.is_featured ? (
                                                    <StarIconSolid className="h-5 w-5 text-yellow-500" />
                                                ) : (
                                                    <StarIcon className="h-5 w-5 text-gray-400" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingItem(story);
                                                    setShowStoryModal(true);
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded"
                                            >
                                                <PencilIcon className="h-4 w-4 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStory(story.id!)}
                                                className="p-1 hover:bg-red-50 rounded"
                                            >
                                                <TrashIcon className="h-4 w-4 text-red-600" />
                                            </button>
                                        </div>
                                    </div>

                                    {story.challenge && (
                                        <div className="mb-3">
                                            <h5 className="text-sm font-medium text-text-secondary mb-1">Challenge</h5>
                                            <p className="text-sm text-text-primary">{story.challenge}</p>
                                        </div>
                                    )}

                                    {story.solution && (
                                        <div className="mb-3">
                                            <h5 className="text-sm font-medium text-text-secondary mb-1">Solution</h5>
                                            <p className="text-sm text-text-primary">{story.solution}</p>
                                        </div>
                                    )}

                                    {story.impact && (
                                        <div className="mb-3">
                                            <h5 className="text-sm font-medium text-text-secondary mb-1">Impact</h5>
                                            <p className="text-sm text-text-primary">{story.impact}</p>
                                        </div>
                                    )}

                                    {story.impact_metrics && Object.keys(story.impact_metrics).length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            {Object.entries(story.impact_metrics).map(([key, value]: [string, any]) => (
                                                <span key={key} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
                                                    {key.replace(/_/g, ' ')}: {value.value}{value.unit}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {story.tags && story.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {story.tags.map((tag, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {stories.length === 0 && (
                            <div className="text-center py-12 text-text-secondary">
                                <TrophyIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No success stories added yet</p>
                                <p className="text-sm">Add your first success story to showcase your impact</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'capabilities' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Capabilities</h3>
                            <button
                                onClick={() => {
                                    setEditingItem(null);
                                    setShowCapabilityModal(true);
                                }}
                                className="btn-primary flex items-center gap-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Capability
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {capabilities.map((capability) => (
                                <div key={capability.id} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-semibold text-text-primary">{capability.capability_name}</h4>
                                            {capability.category && (
                                                <p className="text-sm text-text-secondary">{capability.category}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(capability);
                                                    setShowCapabilityModal(true);
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded"
                                            >
                                                <PencilIcon className="h-4 w-4 text-gray-600" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-text-primary mb-3">{capability.description}</p>
                                    <div className="flex items-center gap-4 text-sm">
                                        {capability.years_of_experience && (
                                            <span className="text-text-secondary">
                                                {capability.years_of_experience} years exp.
                                            </span>
                                        )}
                                        {capability.expertise_level && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${capability.expertise_level === 'expert'
                                                ? 'bg-green-100 text-green-700'
                                                : capability.expertise_level === 'intermediate'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {capability.expertise_level}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {capabilities.length === 0 && (
                            <div className="text-center py-12 text-text-secondary">
                                <SparklesIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No capabilities added yet</p>
                                <p className="text-sm">Add your first capability to showcase your expertise</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'testimonials' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Testimonials</h3>
                            <button
                                onClick={() => {
                                    setEditingItem(null);
                                    setShowTestimonialModal(true);
                                }}
                                className="btn-primary flex items-center gap-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Testimonial
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {testimonials.map((testimonial) => (
                                <div key={testimonial.id} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="mb-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            {testimonial.rating && (
                                                <div className="flex">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <StarIconSolid
                                                            key={i}
                                                            className={`h-4 w-4 ${i < testimonial.rating! ? 'text-yellow-500' : 'text-gray-300'}`}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {testimonial.is_verified && (
                                                <CheckCircleIcon className="h-4 w-4 text-green-500" title="Verified" />
                                            )}
                                        </div>
                                        <p className="text-sm text-text-primary italic">"{testimonial.testimonial_text}"</p>
                                    </div>
                                    <div className="text-sm">
                                        <p className="font-medium text-text-primary">{testimonial.client_name}</p>
                                        <p className="text-text-secondary">{testimonial.client_designation}</p>
                                        {testimonial.client_company && (
                                            <p className="text-text-secondary">{testimonial.client_company}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {testimonials.length === 0 && (
                            <div className="text-center py-12 text-text-secondary">
                                <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No testimonials added yet</p>
                                <p className="text-sm">Add your first testimonial to build credibility</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showClientModal && (
                <ClientModal
                    client={editingItem}
                    onClose={() => {
                        setShowClientModal(false);
                        setEditingItem(null);
                    }}
                    onSave={() => {
                        setShowClientModal(false);
                        setEditingItem(null);
                        loadClients();
                        loadProfile();
                    }}
                />
            )}

            {showStoryModal && (
                <SuccessStoryModal
                    story={editingItem}
                    onClose={() => {
                        setShowStoryModal(false);
                        setEditingItem(null);
                    }}
                    onSave={() => {
                        setShowStoryModal(false);
                        setEditingItem(null);
                        loadStories();
                        loadProfile();
                    }}
                />
            )}

            {showCapabilityModal && (
                <CapabilityModal
                    capability={editingItem}
                    onClose={() => {
                        setShowCapabilityModal(false);
                        setEditingItem(null);
                    }}
                    onSave={() => {
                        setShowCapabilityModal(false);
                        setEditingItem(null);
                        loadCapabilities();
                        loadProfile();
                    }}
                />
            )}

            {showTestimonialModal && (
                <TestimonialModal
                    testimonial={editingItem}
                    onClose={() => {
                        setShowTestimonialModal(false);
                        setEditingItem(null);
                    }}
                    onSave={() => {
                        setShowTestimonialModal(false);
                        setEditingItem(null);
                        loadTestimonials();
                        loadProfile();
                    }}
                />
            )}
        </div>
    );
}
