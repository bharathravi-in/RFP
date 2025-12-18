import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import {
    UserCircleIcon,
    BuildingOfficeIcon,
    KeyIcon,
    BellIcon,
    CogIcon,
    FolderIcon,
    TagIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import KnowledgeProfiles from '@/components/knowledge/KnowledgeProfiles';
import FilterDimensions from '@/components/knowledge/FilterDimensions';
import AIConfigurationSection from '@/components/settings/AIConfigurationSection';

const tabs = [
    { id: 'profile', name: 'Profile', icon: UserCircleIcon },
    { id: 'organization', name: 'Organization', icon: BuildingOfficeIcon },
    { id: 'knowledge', name: 'Knowledge Profiles', icon: FolderIcon },
    { id: 'dimensions', name: 'Filter Dimensions', icon: TagIcon },
    { id: 'security', name: 'Security', icon: KeyIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'ai', name: 'AI Settings', icon: CogIcon },
];

export default function Settings() {
    const { user, organization } = useAuthStore();
    const [activeTab, setActiveTab] = useState('profile');
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        // Simulated save
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Profile updated');
        setIsSaving(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-semibold text-text-primary">Settings</h1>
                <p className="mt-1 text-text-secondary">
                    Manage your account and organization settings
                </p>
            </div>

            <div className="flex gap-8">
                {/* Sidebar */}
                <div className="w-48 flex-shrink-0">
                    <nav className="space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                                    activeTab === tab.id
                                        ? 'bg-primary-light text-primary'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-background'
                                )}
                            >
                                <tab.icon className="h-5 w-5" />
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 max-w-2xl">
                    {activeTab === 'profile' && (
                        <div className="card">
                            <h2 className="text-xl font-semibold text-text-primary mb-6">Profile Settings</h2>
                            <form onSubmit={handleSaveProfile} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Role
                                    </label>
                                    <input
                                        type="text"
                                        value={user?.role || 'viewer'}
                                        disabled
                                        className="input bg-background"
                                    />
                                </div>
                                <button type="submit" disabled={isSaving} className="btn-primary">
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'organization' && (
                        <div className="card">
                            <h2 className="text-xl font-semibold text-text-primary mb-6">Organization</h2>
                            {organization ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary mb-2">
                                            Organization Name
                                        </label>
                                        <input
                                            type="text"
                                            value={organization.name}
                                            disabled
                                            className="input bg-background"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-background rounded-lg">
                                            <p className="text-2xl font-semibold text-text-primary">
                                                {organization.user_count}
                                            </p>
                                            <p className="text-sm text-text-secondary">Team Members</p>
                                        </div>
                                        <div className="p-4 bg-background rounded-lg">
                                            <p className="text-2xl font-semibold text-text-primary">
                                                {organization.project_count}
                                            </p>
                                            <p className="text-sm text-text-secondary">Projects</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-text-secondary">No organization associated</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'knowledge' && (
                        <div className="max-w-4xl">
                            <KnowledgeProfiles />
                        </div>
                    )}

                    {activeTab === 'dimensions' && (
                        <div className="max-w-4xl">
                            <FilterDimensions />
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="card">
                            <h2 className="text-xl font-semibold text-text-primary mb-6">Security</h2>
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-text-primary mb-2">Change Password</h3>
                                    <div className="space-y-3">
                                        <input
                                            type="password"
                                            placeholder="Current password"
                                            className="input"
                                        />
                                        <input
                                            type="password"
                                            placeholder="New password"
                                            className="input"
                                        />
                                        <input
                                            type="password"
                                            placeholder="Confirm new password"
                                            className="input"
                                        />
                                    </div>
                                    <button className="btn-primary mt-4">Update Password</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="card">
                            <h2 className="text-xl font-semibold text-text-primary mb-6">Notifications</h2>
                            <div className="space-y-4">
                                {[
                                    { id: 'email_project', label: 'Email me when a project is assigned to me' },
                                    { id: 'email_review', label: 'Email me when my answer is reviewed' },
                                    { id: 'email_export', label: 'Email me when an export is ready' },
                                    { id: 'browser', label: 'Enable browser notifications' },
                                ].map(setting => (
                                    <label key={setting.id} className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                        />
                                        <span className="text-text-primary">{setting.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="max-w-4xl">
                            <AIConfigurationSection />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
