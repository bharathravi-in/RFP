import { useState, useEffect } from 'react';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    GlobeAltIcon,
    BuildingOffice2Icon,
    CurrencyDollarIcon,
    BriefcaseIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface KnowledgeProfile {
    id: number;
    name: string;
    description?: string;
    geographies: string[];
    client_types: string[];
    currencies: string[];
    industries: string[];
    compliance_frameworks: string[];
    is_default: boolean;
    items_count?: number;
    created_at: string;
}

// Dimension options
const GEOGRAPHIES = [
    { code: 'GLOBAL', name: 'Global' },
    { code: 'US', name: 'United States' },
    { code: 'EU', name: 'European Union' },
    { code: 'UK', name: 'United Kingdom' },
    { code: 'APAC', name: 'Asia Pacific' },
    { code: 'IN', name: 'India' },
    { code: 'MEA', name: 'Middle East & Africa' },
    { code: 'LATAM', name: 'Latin America' },
];

const CLIENT_TYPES = [
    { code: 'government', name: 'Government' },
    { code: 'private', name: 'Private Sector' },
    { code: 'enterprise', name: 'Enterprise' },
    { code: 'public_sector', name: 'Public Sector' },
    { code: 'ngo', name: 'NGO' },
    { code: 'smb', name: 'SMB' },
];

const CURRENCIES = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'JPY', name: 'Japanese Yen' },
];

const INDUSTRIES = [
    { code: 'healthcare', name: 'Healthcare' },
    { code: 'finance', name: 'Financial Services' },
    { code: 'technology', name: 'Technology' },
    { code: 'defense', name: 'Defense & Aerospace' },
    { code: 'manufacturing', name: 'Manufacturing' },
    { code: 'energy', name: 'Energy & Utilities' },
];

const COMPLIANCE = [
    { code: 'SOC2', name: 'SOC 2' },
    { code: 'ISO27001', name: 'ISO 27001' },
    { code: 'GDPR', name: 'GDPR' },
    { code: 'HIPAA', name: 'HIPAA' },
    { code: 'FedRAMP', name: 'FedRAMP' },
    { code: 'PCI_DSS', name: 'PCI DSS' },
];

export default function KnowledgeProfiles() {
    const [profiles, setProfiles] = useState<KnowledgeProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState<KnowledgeProfile | null>(null);

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            const response = await api.get('/knowledge/profiles');
            setProfiles(response.data.profiles || []);
        } catch {
            toast.error('Failed to load profiles');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this profile?')) return;
        try {
            await api.delete(`/knowledge/profiles/${id}`);
            toast.success('Profile deleted');
            loadProfiles();
        } catch {
            toast.error('Failed to delete profile');
        }
    };

    const DimensionBadges = ({ items, icon: Icon, color }: { items: string[]; icon: React.ElementType; color: string }) => {
        if (!items?.length) return null;
        return (
            <div className="flex items-center gap-1 flex-wrap">
                <Icon className={`h-4 w-4 ${color}`} />
                {items.slice(0, 3).map((item) => (
                    <span key={item} className="text-xs px-2 py-0.5 bg-background rounded-full">
                        {item}
                    </span>
                ))}
                {items.length > 3 && (
                    <span className="text-xs text-text-muted">+{items.length - 3}</span>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-text-primary">Knowledge Profiles</h2>
                    <p className="text-text-secondary text-sm mt-1">
                        Create profiles to filter knowledge by Geography, Client Type, Industry, and more
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                    <PlusIcon className="h-5 w-5" />
                    New Profile
                </button>
            </div>

            {/* Profiles Grid */}
            {isLoading ? (
                <div className="text-text-muted text-center py-12">Loading profiles...</div>
            ) : profiles.length === 0 ? (
                <div className="card text-center py-12">
                    <GlobeAltIcon className="h-12 w-12 text-text-muted mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-text-primary mb-2">No profiles yet</h3>
                    <p className="text-text-secondary mb-4">
                        Create your first knowledge profile to organize content by dimensions
                    </p>
                    <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                        <PlusIcon className="h-5 w-5" />
                        Create Profile
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {profiles.map((profile) => (
                        <div key={profile.id} className="card hover:border-primary transition-all">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-text-primary">{profile.name}</h3>
                                    {profile.is_default && (
                                        <span className="text-xs text-primary font-medium">Default</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setEditingProfile(profile)}
                                        className="p-1.5 hover:bg-background rounded-lg"
                                    >
                                        <PencilIcon className="h-4 w-4 text-text-muted" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(profile.id)}
                                        className="p-1.5 hover:bg-background rounded-lg"
                                    >
                                        <TrashIcon className="h-4 w-4 text-text-muted hover:text-red-500" />
                                    </button>
                                </div>
                            </div>

                            {profile.description && (
                                <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                                    {profile.description}
                                </p>
                            )}

                            <div className="space-y-2">
                                <DimensionBadges items={profile.geographies} icon={GlobeAltIcon} color="text-blue-500" />
                                <DimensionBadges items={profile.client_types} icon={BuildingOffice2Icon} color="text-green-500" />
                                <DimensionBadges items={profile.industries} icon={BriefcaseIcon} color="text-purple-500" />
                                <DimensionBadges items={profile.compliance_frameworks} icon={ShieldCheckIcon} color="text-orange-500" />
                            </div>

                            {profile.items_count !== undefined && (
                                <div className="mt-3 pt-3 border-t border-border text-sm text-text-muted">
                                    {profile.items_count} knowledge items
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || editingProfile) && (
                <ProfileModal
                    profile={editingProfile}
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingProfile(null);
                    }}
                    onSaved={() => {
                        setShowCreateModal(false);
                        setEditingProfile(null);
                        loadProfiles();
                    }}
                />
            )}
        </div>
    );
}

// Profile Modal Component
function ProfileModal({
    profile,
    onClose,
    onSaved,
}: {
    profile: KnowledgeProfile | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(profile?.name || '');
    const [description, setDescription] = useState(profile?.description || '');
    const [geographies, setGeographies] = useState<string[]>(profile?.geographies || []);
    const [clientTypes, setClientTypes] = useState<string[]>(profile?.client_types || []);
    const [currencies, setCurrencies] = useState<string[]>(profile?.currencies || []);
    const [industries, setIndustries] = useState<string[]>(profile?.industries || []);
    const [compliance, setCompliance] = useState<string[]>(profile?.compliance_frameworks || []);
    const [isDefault, setIsDefault] = useState(profile?.is_default || false);
    const [isLoading, setIsLoading] = useState(false);

    const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Profile name is required');
            return;
        }

        setIsLoading(true);
        try {
            const data = {
                name,
                description,
                geographies,
                client_types: clientTypes,
                currencies,
                industries,
                compliance_frameworks: compliance,
                is_default: isDefault,
            };

            if (profile) {
                await api.put(`/knowledge/profiles/${profile.id}`, data);
                toast.success('Profile updated');
            } else {
                await api.post('/knowledge/profiles', data);
                toast.success('Profile created');
            }
            onSaved();
        } catch {
            toast.error(profile ? 'Failed to update profile' : 'Failed to create profile');
        } finally {
            setIsLoading(false);
        }
    };

    const CheckboxGroup = ({
        label,
        options,
        selected,
        setSelected,
    }: {
        label: string;
        options: { code: string; name: string }[];
        selected: string[];
        setSelected: React.Dispatch<React.SetStateAction<string[]>>;
    }) => (
        <div>
            <label className="block text-sm font-medium text-text-primary mb-2">{label}</label>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <button
                        key={opt.code}
                        type="button"
                        onClick={() => toggleItem(selected, setSelected, opt.code)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${selected.includes(opt.code)
                                ? 'bg-primary text-white'
                                : 'bg-background text-text-secondary hover:bg-primary-light'
                            }`}
                    >
                        {opt.name}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-modal w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-semibold text-text-primary mb-6">
                    {profile ? 'Edit Profile' : 'Create Knowledge Profile'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-text-primary mb-2">
                                Profile Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="input"
                                placeholder="e.g., US Government Healthcare"
                                autoFocus
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-text-primary mb-2">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="input min-h-[60px] resize-none"
                                placeholder="Optional description..."
                            />
                        </div>
                    </div>

                    {/* Dimension Selection */}
                    <div className="space-y-4 border-t border-border pt-4">
                        <h3 className="font-medium text-text-primary">Filter Dimensions</h3>
                        <p className="text-sm text-text-muted -mt-2">
                            Select which dimensions this profile should match
                        </p>

                        <CheckboxGroup label="Geographies" options={GEOGRAPHIES} selected={geographies} setSelected={setGeographies} />
                        <CheckboxGroup label="Client Types" options={CLIENT_TYPES} selected={clientTypes} setSelected={setClientTypes} />
                        <CheckboxGroup label="Currencies" options={CURRENCIES} selected={currencies} setSelected={setCurrencies} />
                        <CheckboxGroup label="Industries" options={INDUSTRIES} selected={industries} setSelected={setIndustries} />
                        <CheckboxGroup label="Compliance" options={COMPLIANCE} selected={compliance} setSelected={setCompliance} />
                    </div>

                    {/* Default Toggle */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="isDefault"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                            className="w-4 h-4 text-primary"
                        />
                        <label htmlFor="isDefault" className="text-sm text-text-primary">
                            Set as default profile for new projects
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                            {isLoading ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
