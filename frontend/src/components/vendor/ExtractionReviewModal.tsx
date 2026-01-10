import React, { useState } from 'react';
import {
    XMarkIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    TrashIcon,
    BriefcaseIcon,
    UserGroupIcon,
    TrophyIcon,
    SparklesIcon,
    ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { vendorProfileApi, VendorExtractionResult } from '@/api/vendorProfile';
import toast from 'react-hot-toast';

interface ExtractionReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: VendorExtractionResult;
    onSaveComplete: () => void;
}

type TabType = 'overview' | 'clients' | 'stories' | 'capabilities' | 'testimonials';

export default function ExtractionReviewModal({ isOpen, onClose, data, onSaveComplete }: ExtractionReviewModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isSaving, setIsSaving] = useState(false);

    // State for editable data
    const [companyInfo, setCompanyInfo] = useState(data.company_info || {});
    const [clients, setClients] = useState(data.clients || []);
    const [stories, setStories] = useState(data.success_stories || []);
    const [capabilities, setCapabilities] = useState(data.capabilities || []);
    const [testimonials, setTestimonials] = useState(data.testimonials || []);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        const loadingToast = toast.loading('Saving extracted data to profile...');

        try {
            // 1. Update Profile (Company Info)
            if (Object.keys(companyInfo).length > 0) {
                await vendorProfileApi.updateProfile(companyInfo as any);
            }

            // 2. Add Clients
            for (const client of clients) {
                await vendorProfileApi.addClient(client);
            }

            // 3. Add Stories
            for (const story of stories) {
                await vendorProfileApi.addSuccessStory(story);
            }

            // 4. Add Capabilities
            for (const cap of capabilities) {
                await vendorProfileApi.addCapability(cap);
            }

            // 5. Add Testimonials
            for (const test of testimonials) {
                await vendorProfileApi.addTestimonial(test);
            }

            toast.success('All approved data saved successfully!', { id: loadingToast });
            onSaveComplete();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save some data', { id: loadingToast });
        } finally {
            setIsSaving(false);
        }
    };

    const removeItem = (type: TabType, index: number) => {
        if (type === 'clients') setClients(clients.filter((_, i) => i !== index));
        if (type === 'stories') setStories(stories.filter((_, i) => i !== index));
        if (type === 'capabilities') setCapabilities(capabilities.filter((_, i) => i !== index));
        if (type === 'testimonials') setTestimonials(testimonials.filter((_, i) => i !== index));
    };

    const updateItem = (type: TabType, index: number, field: string, value: any) => {
        if (type === 'clients') {
            const newItems = [...clients];
            (newItems[index] as any)[field] = value;
            setClients(newItems);
        }
        if (type === 'stories') {
            const newItems = [...stories];
            (newItems[index] as any)[field] = value;
            setStories(newItems);
        }
        // ... similar for others if needed, keeping it simple for now
    };

    const tabs = [
        { id: 'overview', label: 'Company Info', icon: BriefcaseIcon, count: Object.keys(companyInfo).length },
        { id: 'clients', label: 'Clients', icon: UserGroupIcon, count: clients.length },
        { id: 'stories', label: 'Success Stories', icon: TrophyIcon, count: stories.length },
        { id: 'capabilities', label: 'Accelerators', icon: SparklesIcon, count: capabilities.length },
        { id: 'testimonials', label: 'Testimonials', icon: ChatBubbleLeftRightIcon, count: testimonials.length },
    ];

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>

                <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    <div className="bg-white px-6 py-4 border-b border-border flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary">Review Extracted Data</h3>
                            <p className="text-sm text-text-secondary mt-1">Review and refine the information found in your document before saving.</p>
                        </div>
                        <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex border-b border-border bg-gray-50 px-6">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                                    }`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 max-h-[60vh] overflow-y-auto bg-gray-50/30">
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-text-primary mb-2">Company Description</label>
                                    <textarea
                                        value={companyInfo.company_description || ''}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, company_description: e.target.value })}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-text-primary mb-2">Mission Statement</label>
                                    <textarea
                                        value={companyInfo.mission_statement || ''}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, mission_statement: e.target.value })}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-text-primary mb-2">Value Proposition</label>
                                    <textarea
                                        value={companyInfo.value_proposition || ''}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, value_proposition: e.target.value })}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Registration Country</label>
                                    <input
                                        type="text"
                                        value={companyInfo.registration_country || ''}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, registration_country: e.target.value })}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Headquarters Location</label>
                                    <input
                                        type="text"
                                        value={companyInfo.headquarters_location || ''}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, headquarters_location: e.target.value })}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Employee Count Range</label>
                                    <input
                                        type="text"
                                        value={companyInfo.employee_count_range || ''}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, employee_count_range: e.target.value })}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. 500+"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Annual Revenue Range</label>
                                    <input
                                        type="text"
                                        value={companyInfo.annual_revenue_range || ''}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, annual_revenue_range: e.target.value })}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. $10M-$50M"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Years in Business</label>
                                    <input
                                        type="number"
                                        value={companyInfo.years_in_business || ''}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, years_in_business: parseInt(e.target.value) || null })}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'clients' && (
                            <div className="space-y-4">
                                {clients.length === 0 ? (
                                    <EmptyState tab="clients" />
                                ) : (
                                    clients.map((client, idx) => (
                                        <div key={idx} className="bg-white p-4 border border-border rounded-xl shadow-sm group">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 grid grid-cols-2 gap-4">
                                                    <input
                                                        value={client.client_name}
                                                        onChange={(e) => updateItem('clients', idx, 'client_name', e.target.value)}
                                                        className="font-bold text-text-primary border-none focus:ring-0 p-0 text-lg w-full"
                                                        placeholder="Client Name"
                                                    />
                                                    <input
                                                        value={client.client_industry || ''}
                                                        onChange={(e) => updateItem('clients', idx, 'client_industry', e.target.value)}
                                                        className="text-indigo-600 font-medium text-sm border-none focus:ring-0 p-0"
                                                        placeholder="Industry"
                                                    />
                                                </div>
                                                <button onClick={() => removeItem('clients', idx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'stories' && (
                            <div className="space-y-4">
                                {stories.length === 0 ? (
                                    <EmptyState tab="stories" />
                                ) : (
                                    stories.map((story, idx) => (
                                        <div key={idx} className="bg-white p-4 border border-border rounded-xl shadow-sm group">
                                            <div className="flex justify-between items-start mb-3">
                                                <input
                                                    value={story.title}
                                                    onChange={(e) => updateItem('stories', idx, 'title', e.target.value)}
                                                    className="font-bold text-text-primary border-none focus:ring-0 p-0 text-lg w-full"
                                                />
                                                <button onClick={() => removeItem('stories', idx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                                <div>
                                                    <label className="text-xs text-text-secondary uppercase">Challenge</label>
                                                    <textarea
                                                        value={story.challenge || ''}
                                                        onChange={(e) => updateItem('stories', idx, 'challenge', e.target.value)}
                                                        className="w-full mt-1 border-gray-200 rounded-lg text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-text-secondary uppercase">Solution</label>
                                                    <textarea
                                                        value={story.solution || ''}
                                                        onChange={(e) => updateItem('stories', idx, 'solution', e.target.value)}
                                                        className="w-full mt-1 border-gray-200 rounded-lg text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'capabilities' && (
                            <div className="space-y-4">
                                {capabilities.length === 0 ? (
                                    <EmptyState tab="capabilities" />
                                ) : (
                                    capabilities.map((cap, idx) => (
                                        <div key={idx} className="bg-white p-4 border border-border rounded-xl shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-text-primary">{cap.capability_name}</p>
                                                <p className="text-sm text-text-secondary">{cap.description}</p>
                                            </div>
                                            <button onClick={() => removeItem('capabilities', idx)} className="text-red-400 hover:text-red-600">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'testimonials' && (
                            <div className="space-y-4">
                                {testimonials.length === 0 ? (
                                    <EmptyState tab="testimonials" />
                                ) : (
                                    testimonials.map((test, idx) => (
                                        <div key={idx} className="bg-white p-4 border border-border rounded-xl shadow-sm">
                                            <p className="italic text-text-primary mb-2 text-sm">"{test.testimonial_text}"</p>
                                            <div className="flex justify-between items-center">
                                                <p className="text-xs font-semibold text-text-secondary">
                                                    - {test.client_name}, {test.client_company}
                                                </p>
                                                <button onClick={() => removeItem('testimonials', idx)} className="text-red-400 hover:text-red-600">
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 px-6 py-4 border-t border-border flex justify-between items-center">
                        <div className="flex items-center text-amber-600 text-sm gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            <span>Verify extracted info before saving. Existing data will not be overwritten.</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 border border-border text-text-secondary rounded-lg font-medium hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:bg-indigo-400"
                            >
                                {isSaving ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <CheckIcon className="h-4 w-4" />
                                )}
                                Save All Approved Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}

function EmptyState({ tab }: { tab: string }) {
    return (
        <div className="text-center py-8 bg-gray-100/50 rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-text-secondary text-sm">We couldn't find any {tab} in the document.</p>
        </div>
    );
}

