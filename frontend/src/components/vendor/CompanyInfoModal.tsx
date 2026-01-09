import { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { vendorProfileApi, VendorProfile } from '@/api/vendorProfile';

interface CompanyInfoModalProps {
    profile: VendorProfile | null;
    onClose: () => void;
    onSave: () => void;
}

const EMPLOYEE_COUNT_OPTIONS = [
    '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'
];

const ANNUAL_REVENUE_OPTIONS = [
    'Under $1M', '$1M-$5M', '$5M-$10M', '$10M-$50M', '$50M-$100M', '$100M-$500M', '$500M+'
];

const COMMON_CERTIFICATIONS = [
    'ISO 9001', 'ISO 27001', 'ISO 27017', 'ISO 27018', 'ISO 22301',
    'SOC 1 Type II', 'SOC 2 Type II', 'SOC 3',
    'CMMI Level 3', 'CMMI Level 5',
    'PCI DSS', 'GDPR Compliant', 'HIPAA Compliant',
    'AWS Partner', 'Azure Partner', 'Google Cloud Partner'
];

const COMMON_INDUSTRIES = [
    'Technology', 'Healthcare', 'Finance & Banking', 'Insurance',
    'Retail & E-commerce', 'Manufacturing', 'Energy & Utilities',
    'Government & Public Sector', 'Education', 'Telecommunications',
    'Transportation & Logistics', 'Real Estate', 'Media & Entertainment'
];

export default function CompanyInfoModal({ profile, onClose, onSave }: CompanyInfoModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        company_name: '',
        registration_country: '',
        years_in_business: '',
        company_description: '',
        headquarters_location: '',
        office_locations: [] as string[],
        employee_count_range: '',
        annual_revenue_range: '',
        certifications: [] as string[],
        industries_served: [] as string[],
        mission_statement: '',
        value_proposition: '',
        key_differentiators: [] as string[],
    });

    const [newLocation, setNewLocation] = useState('');
    const [newCertification, setNewCertification] = useState('');
    const [newIndustry, setNewIndustry] = useState('');
    const [newDifferentiator, setNewDifferentiator] = useState('');

    useEffect(() => {
        if (profile) {
            setForm({
                company_name: profile.company_name || '',
                registration_country: profile.registration_country || '',
                years_in_business: profile.years_in_business?.toString() || '',
                company_description: profile.company_description || '',
                headquarters_location: profile.headquarters_location || '',
                office_locations: profile.office_locations || [],
                employee_count_range: profile.employee_count_range || '',
                annual_revenue_range: profile.annual_revenue_range || '',
                certifications: profile.certifications || [],
                industries_served: profile.industries_served || [],
                mission_statement: profile.mission_statement || '',
                value_proposition: profile.value_proposition || '',
                key_differentiators: profile.key_differentiators || [],
            });
        }
    }, [profile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            await vendorProfileApi.updateProfile({
                company_name: form.company_name || undefined,
                registration_country: form.registration_country || undefined,
                years_in_business: form.years_in_business ? parseInt(form.years_in_business) : undefined,
                company_description: form.company_description || undefined,
                headquarters_location: form.headquarters_location || undefined,
                office_locations: form.office_locations,
                employee_count_range: form.employee_count_range || undefined,
                annual_revenue_range: form.annual_revenue_range || undefined,
                certifications: form.certifications,
                industries_served: form.industries_served,
                mission_statement: form.mission_statement || undefined,
                value_proposition: form.value_proposition || undefined,
                key_differentiators: form.key_differentiators,
            });
            toast.success('Company information updated successfully');
            onSave();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update company information');
        } finally {
            setIsSaving(false);
        }
    };

    const addToArray = (field: 'office_locations' | 'certifications' | 'industries_served' | 'key_differentiators', value: string, setValue: (v: string) => void) => {
        if (value.trim() && !form[field].includes(value.trim())) {
            setForm(prev => ({
                ...prev,
                [field]: [...prev[field], value.trim()]
            }));
            setValue('');
        }
    };

    const removeFromArray = (field: 'office_locations' | 'certifications' | 'industries_served' | 'key_differentiators', index: number) => {
        setForm(prev => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== index)
        }));
    };


    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-text-primary">Edit Company Information</h2>
                    <button onClick={onClose} className="p-2 hover:bg-background rounded-lg transition-colors">
                        <XMarkIcon className="h-5 w-5 text-text-secondary" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <div>
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Basic Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Company Name</label>
                                    <input
                                        type="text"
                                        value={form.company_name}
                                        onChange={(e) => setForm(prev => ({ ...prev, company_name: e.target.value }))}
                                        className="input w-full"
                                        placeholder="Your Company Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Registration Country</label>
                                    <input
                                        type="text"
                                        value={form.registration_country}
                                        onChange={(e) => setForm(prev => ({ ...prev, registration_country: e.target.value }))}
                                        className="input w-full"
                                        placeholder="e.g., United States"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Years in Business</label>
                                    <input
                                        type="number"
                                        value={form.years_in_business}
                                        onChange={(e) => setForm(prev => ({ ...prev, years_in_business: e.target.value }))}
                                        className="input w-full"
                                        placeholder="e.g., 15"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Employee Count</label>
                                    <select
                                        value={form.employee_count_range}
                                        onChange={(e) => setForm(prev => ({ ...prev, employee_count_range: e.target.value }))}
                                        className="input w-full"
                                    >
                                        <option value="">Select range</option>
                                        {EMPLOYEE_COUNT_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Annual Revenue</label>
                                    <select
                                        value={form.annual_revenue_range}
                                        onChange={(e) => setForm(prev => ({ ...prev, annual_revenue_range: e.target.value }))}
                                        className="input w-full"
                                    >
                                        <option value="">Select range</option>
                                        {ANNUAL_REVENUE_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Location</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Headquarters</label>
                                    <input
                                        type="text"
                                        value={form.headquarters_location}
                                        onChange={(e) => setForm(prev => ({ ...prev, headquarters_location: e.target.value }))}
                                        className="input w-full"
                                        placeholder="e.g., San Francisco, CA, USA"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Branch Offices</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {form.office_locations.map((location, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                                                {location}
                                                <button type="button" onClick={() => removeFromArray('office_locations', idx)} className="hover:text-red-500">
                                                    <XCircleIcon className="h-4 w-4" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newLocation}
                                            onChange={(e) => setNewLocation(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addToArray('office_locations', newLocation, setNewLocation);
                                                }
                                            }}
                                            placeholder="Add branch location (e.g., New York, USA)"
                                            className="input flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => addToArray('office_locations', newLocation, setNewLocation)}
                                            className="btn-secondary px-3"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Certifications & Industries */}
                        <div>
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Certifications & Industries</h3>
                            <div className="space-y-4">
                                {/* Certifications */}
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Certifications</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {form.certifications.map((cert, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                                                {cert}
                                                <button type="button" onClick={() => removeFromArray('certifications', idx)} className="hover:text-red-500">
                                                    <XCircleIcon className="h-4 w-4" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCertification}
                                            onChange={(e) => setNewCertification(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addToArray('certifications', newCertification, setNewCertification);
                                                }
                                            }}
                                            placeholder="Add certification (e.g., ISO 27001)"
                                            list="certifications-suggestions"
                                            className="input flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => addToArray('certifications', newCertification, setNewCertification)}
                                            className="btn-secondary px-3"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <datalist id="certifications-suggestions">
                                        {COMMON_CERTIFICATIONS.filter(s => !form.certifications.includes(s)).map((s, i) => (
                                            <option key={i} value={s} />
                                        ))}
                                    </datalist>
                                </div>

                                {/* Industries */}
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Industries Served</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {form.industries_served.map((industry, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                                {industry}
                                                <button type="button" onClick={() => removeFromArray('industries_served', idx)} className="hover:text-red-500">
                                                    <XCircleIcon className="h-4 w-4" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newIndustry}
                                            onChange={(e) => setNewIndustry(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addToArray('industries_served', newIndustry, setNewIndustry);
                                                }
                                            }}
                                            placeholder="Add industry"
                                            list="industries-suggestions"
                                            className="input flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => addToArray('industries_served', newIndustry, setNewIndustry)}
                                            className="btn-secondary px-3"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <datalist id="industries-suggestions">
                                        {COMMON_INDUSTRIES.filter(s => !form.industries_served.includes(s)).map((s, i) => (
                                            <option key={i} value={s} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                        </div>

                        {/* Company Overview */}
                        <div>
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Company Overview</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Company Description</label>
                                    <textarea
                                        value={form.company_description}
                                        onChange={(e) => setForm(prev => ({ ...prev, company_description: e.target.value }))}
                                        className="input w-full"
                                        rows={3}
                                        placeholder="Brief description of your company..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Mission Statement</label>
                                    <textarea
                                        value={form.mission_statement}
                                        onChange={(e) => setForm(prev => ({ ...prev, mission_statement: e.target.value }))}
                                        className="input w-full"
                                        rows={2}
                                        placeholder="Your company's mission..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Value Proposition</label>
                                    <textarea
                                        value={form.value_proposition}
                                        onChange={(e) => setForm(prev => ({ ...prev, value_proposition: e.target.value }))}
                                        className="input w-full"
                                        rows={2}
                                        placeholder="What makes you unique..."
                                    />
                                </div>
                                {/* Key Differentiators */}
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Key Differentiators</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {form.key_differentiators.map((diff, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
                                                {diff}
                                                <button type="button" onClick={() => removeFromArray('key_differentiators', idx)} className="hover:text-red-500">
                                                    <XCircleIcon className="h-4 w-4" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newDifferentiator}
                                            onChange={(e) => setNewDifferentiator(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addToArray('key_differentiators', newDifferentiator, setNewDifferentiator);
                                                }
                                            }}
                                            placeholder="Add differentiator (e.g., 24/7 Support)"
                                            className="input flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => addToArray('key_differentiators', newDifferentiator, setNewDifferentiator)}
                                            className="btn-secondary px-3"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-border bg-background">
                    <button type="button" onClick={onClose} className="btn-secondary">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="btn-primary"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
