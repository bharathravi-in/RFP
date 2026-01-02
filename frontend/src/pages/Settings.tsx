import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { usersApi, organizationsApi, invitationsApi } from '@/api/client';
import InviteMemberModal from '@/components/modals/InviteMemberModal';
import toast from 'react-hot-toast';
import {
    UserCircleIcon,
    BuildingOfficeIcon,
    KeyIcon,
    BellIcon,
    CogIcon,
    FolderIcon,
    TagIcon,
    PencilIcon,
    ShieldCheckIcon,
    EnvelopeIcon,
    CameraIcon,
    TrashIcon,
    PlusIcon,
    BriefcaseIcon,
    DocumentArrowUpIcon,
    QuestionMarkCircleIcon,
    RocketLaunchIcon,
    BookOpenIcon,
    SwatchIcon,
    BeakerIcon,
    LinkIcon,
    ClipboardDocumentListIcon,
    CurrencyDollarIcon,
    CloudIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import KnowledgeProfiles from '@/components/knowledge/KnowledgeProfiles';
import FilterDimensions from '@/components/knowledge/FilterDimensions';
import AIConfigurationSection from '@/components/settings/AIConfigurationSection';
import ExperimentsSection from '@/components/settings/ExperimentsSection';
import WebhooksSection from '@/components/settings/WebhooksSection';
import ApprovalWorkflowsSection from '@/components/settings/ApprovalWorkflowsSection';
import RevenueTrackingSection from '@/components/settings/RevenueTrackingSection';
import SSOConfigurationSection from '@/components/settings/SSOConfigurationSection';
import CRMIntegrationSection from '@/components/settings/CRMIntegrationSection';
import PlatformTour from '@/components/onboarding/PlatformTour';
import LanguageSelector from '@/components/common/LanguageSelector';
import ThemeSelector from '@/components/common/ThemeSelector';

const TOUR_COMPLETED_KEY = 'rfp_pro_tour_completed';

// Tabs with role restrictions - using translation keys
const allTabs = [
    { id: 'profile', key: 'settings.profile', icon: UserCircleIcon },
    { id: 'organization', key: 'settings.organization', icon: BuildingOfficeIcon },
    { id: 'vendor', key: 'settings.vendorProfile', icon: BriefcaseIcon, adminOnly: true },
    { id: 'knowledge', key: 'settings.knowledgeProfiles', icon: FolderIcon },
    { id: 'dimensions', key: 'settings.filterDimensions', icon: TagIcon },
    { id: 'security', key: 'settings.security', icon: KeyIcon },
    { id: 'sso', key: 'SSO / SAML', icon: ShieldCheckIcon, superAdminOnly: true },
    { id: 'notifications', key: 'settings.notifications', icon: BellIcon, superAdminOnly: true },
    { id: 'ai', key: 'settings.aiSettings', icon: CogIcon, adminOnly: true },
    { id: 'experiments', key: 'A/B Experiments', icon: BeakerIcon, superAdminOnly: true },
    { id: 'webhooks', key: 'Webhooks', icon: LinkIcon, superAdminOnly: true },
    { id: 'approvals', key: 'Approval Workflows', icon: ClipboardDocumentListIcon, superAdminOnly: true },
    { id: 'revenue', key: 'Revenue Tracking', icon: CurrencyDollarIcon, superAdminOnly: true },
    { id: 'crm', key: 'CRM Integration', icon: CloudIcon, superAdminOnly: true },
    { id: 'branding', key: 'settings.branding', icon: SwatchIcon, adminOnly: true },
    { id: 'help', key: 'settings.helpSupport', icon: QuestionMarkCircleIcon },
];

export default function Settings() {
    const { user, organization, setUser, setOrganization } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();

    // Filter tabs based on user role - hide admin-only and super-admin-only tabs
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isSuperAdmin = user?.role === 'super_admin';
    const tabs = allTabs.filter(tab => {
        if (tab.superAdminOnly) return isSuperAdmin;
        if (tab.adminOnly) return isAdmin;
        return true;
    });

    const tabFromUrl = searchParams.get('tab');
    const validTab = tabs.find(t => t.id === tabFromUrl)?.id || 'profile';
    const [activeTab, setActiveTab] = useState(validTab);

    // Profile state
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [expertiseTags, setExpertiseTags] = useState<string>(user?.expertise_tags?.join(', ') || '');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Organization state
    const [orgName, setOrgName] = useState(organization?.name || '');
    const [isEditingOrg, setIsEditingOrg] = useState(false);
    const [isSavingOrg, setIsSavingOrg] = useState(false);
    const [showCreateOrg, setShowCreateOrg] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loadingInvitations, setLoadingInvitations] = useState(false);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Vendor Profile state
    const [vendorProfile, setVendorProfile] = useState({
        registration_country: '',
        years_in_business: '',
        employee_count: '',
        certifications: '',
        geographies: '',
    });
    const [isSavingVendor, setIsSavingVendor] = useState(false);
    const [isExtractingVendor, setIsExtractingVendor] = useState(false);
    const vendorFileInputRef = useRef<HTMLInputElement>(null);

    // Platform Tour state
    const [showTour, setShowTour] = useState(false);

    const handleStartTour = () => {
        setShowTour(true);
    };

    const handleTourComplete = () => {
        localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
        setShowTour(false);
    };

    // Sync activeTab with URL parameter
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam && tabs.find(t => t.id === tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    // Fetch organization data when tab is organization
    useEffect(() => {
        const fetchOrganization = async () => {
            try {
                const response = await organizationsApi.get();
                if (response.data.organization) {
                    setOrganization(response.data.organization);
                    setOrgName(response.data.organization.name);
                }
            } catch (error) {
                console.error('Failed to fetch organization:', error);
            }
        };

        if (activeTab === 'organization') {
            fetchOrganization();
            fetchInvitations();
            fetchTeamMembers();
        }
    }, [activeTab, setOrganization]);

    // Fetch team members
    const fetchTeamMembers = async () => {
        try {
            const response = await organizationsApi.getMembers();
            setTeamMembers(response.data.members || []);
        } catch (error) {
            console.error('Failed to fetch team members:', error);
        }
    };

    // Fetch invitations
    const fetchInvitations = async () => {
        setLoadingInvitations(true);
        try {
            const response = await invitationsApi.list();
            setInvitations(response.data.invitations || []);
        } catch (error) {
            console.error('Failed to fetch invitations:', error);
        } finally {
            setLoadingInvitations(false);
        }
    };

    const handleCancelInvitation = async (invitationId: number) => {
        try {
            await invitationsApi.cancel(invitationId);
            toast.success('Invitation cancelled');
            fetchInvitations();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to cancel invitation');
        }
    };

    const handleResendInvitation = async (invitationId: number) => {
        try {
            await invitationsApi.resend(invitationId);
            toast.success('Invitation resent');
            fetchInvitations();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to resend invitation');
        }
    };

    // Update URL when tab changes
    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId });
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const tagsArray = expertiseTags.split(',').map(tag => tag.trim()).filter(Boolean);
            const response = await usersApi.updateProfile({ name, email, expertise_tags: tagsArray });
            setUser(response.data.user);
            toast.success('Profile updated successfully');
            setIsEditing(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Photo must be less than 5MB');
            return;
        }

        setIsUploadingPhoto(true);
        try {
            const response = await usersApi.uploadPhoto(file);
            setUser(response.data.user);
            toast.success('Photo uploaded successfully');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to upload photo');
        } finally {
            setIsUploadingPhoto(false);
            if (photoInputRef.current) {
                photoInputRef.current.value = '';
            }
        }
    };

    const handleRemovePhoto = async () => {
        try {
            const response = await usersApi.removePhoto();
            setUser(response.data.user);
            toast.success('Photo removed');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to remove photo');
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsChangingPassword(true);
        try {
            await usersApi.changePassword({ current_password: currentPassword, new_password: newPassword });
            toast.success('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to change password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    // Load vendor profile from organization settings
    useEffect(() => {
        if (activeTab === 'vendor' && organization?.settings?.vendor_profile) {
            const vp = organization.settings.vendor_profile as any;
            setVendorProfile({
                registration_country: vp.registration_country || '',
                years_in_business: vp.years_in_business?.toString() || '',
                employee_count: vp.employee_count?.toString() || '',
                certifications: Array.isArray(vp.certifications) ? vp.certifications.join(', ') : (vp.certifications || ''),
                geographies: Array.isArray(vp.geographies) ? vp.geographies.join(', ') : (vp.geographies || ''),
            });
        }
    }, [activeTab, organization]);

    const handleSaveVendorProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization?.id) {
            toast.error('No organization found');
            return;
        }

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
                ...organization.settings,
                vendor_profile: vendorData,
            };

            const response = await organizationsApi.update(organization.id, { settings: updatedSettings });
            setOrganization(response.data.organization);
            toast.success('Vendor profile saved successfully');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save vendor profile');
        } finally {
            setIsSavingVendor(false);
        }
    };

    const handleVendorFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'];
        const allowedExtensions = ['pdf', 'docx', 'doc', 'pptx', 'ppt'];
        const fileExt = file.name.split('.').pop()?.toLowerCase();

        if (!allowedExtensions.includes(fileExt || '')) {
            toast.error('Unsupported file type. Allowed: PDF, DOCX, PPTX');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('File too large. Maximum 10MB allowed.');
            return;
        }

        setIsExtractingVendor(true);
        try {
            const response = await organizationsApi.extractVendorProfile(file);
            const extracted = response.data.vendor_profile;

            // Auto-populate form fields
            setVendorProfile({
                registration_country: extracted.registration_country || '',
                years_in_business: extracted.years_in_business?.toString() || '',
                employee_count: extracted.employee_count?.toString() || '',
                certifications: Array.isArray(extracted.certifications) ? extracted.certifications.join(', ') : '',
                geographies: Array.isArray(extracted.geographies) ? extracted.geographies.join(', ') : '',
            });

            toast.success(`Extracted from ${file.name}! Please review and save.`);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to extract vendor profile');
        } finally {
            setIsExtractingVendor(false);
            if (vendorFileInputRef.current) {
                vendorFileInputRef.current.value = '';
            }
        }
    };

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrgName.trim()) {
            toast.error('Organization name is required');
            return;
        }

        setIsSavingOrg(true);
        try {
            const response = await organizationsApi.create({ name: newOrgName });
            setOrganization(response.data.organization);
            setOrgName(response.data.organization.name);
            toast.success('Organization created successfully');
            setShowCreateOrg(false);
            setNewOrgName('');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create organization');
        } finally {
            setIsSavingOrg(false);
        }
    };

    const handleUpdateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization?.id) return;

        setIsSavingOrg(true);
        try {
            const response = await organizationsApi.update(organization.id, { name: orgName });
            setOrganization(response.data.organization);
            toast.success('Organization updated successfully');
            setIsEditingOrg(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update organization');
        } finally {
            setIsSavingOrg(false);
        }
    };

    const handleDeleteOrg = async () => {
        if (!organization?.id) return;

        setIsSavingOrg(true);
        try {
            await organizationsApi.delete(organization.id, true);
            setOrganization(null);
            setOrgName('');
            toast.success('Organization deleted');
            setShowDeleteConfirm(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete organization');
        } finally {
            setIsSavingOrg(false);
        }
    };

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-text-primary">{t('settings.title')}</h1>
                <p className="text-text-secondary mt-1">{t('settings.subtitle')}</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === tab.id
                                ? 'bg-primary text-white'
                                : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-background border border-border'
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        {t(tab.key)}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="w-full">
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div className="bg-surface rounded-xl border border-border max-w-3xl">
                        <div className="bg-gradient-to-r from-primary/5 via-blue-50 to-purple-50 p-6 rounded-t-xl">
                            <div className="flex items-center gap-5">
                                <div className="relative group">
                                    {user?.profile_photo ? (
                                        <img src={user.profile_photo} alt={user.name} className="w-20 h-20 rounded-full object-cover shadow-lg" />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                            {getInitials(user?.name || '')}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                        onClick={() => photoInputRef.current?.click()}
                                    >
                                        <CameraIcon className="h-6 w-6 text-white" />
                                    </div>
                                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                                    {isUploadingPhoto && (
                                        <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-bold text-text-primary truncate">{user?.name || 'User'}</h2>
                                    <p className="text-text-secondary flex items-center gap-1.5 mt-0.5">
                                        <EnvelopeIcon className="h-4 w-4 flex-shrink-0" />
                                        <span className="truncate">{user?.email}</span>
                                    </p>
                                    <span className={clsx("inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium",
                                        user?.role === 'admin' ? "bg-primary/15 text-primary" : "bg-gray-100 text-gray-600"
                                    )}>
                                        <ShieldCheckIcon className="h-3.5 w-3.5" />
                                        {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1) || 'Viewer'}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setIsEditing(!isEditing)} className={clsx(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                        isEditing ? "bg-gray-200 text-gray-700" : "bg-white text-text-primary border border-border hover:border-primary"
                                    )}>
                                        <PencilIcon className="h-4 w-4" />
                                        {isEditing ? 'Cancel' : 'Edit'}
                                    </button>
                                    {user?.profile_photo && (
                                        <button onClick={handleRemovePhoto} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-red-600 border border-border hover:border-red-300 transition-all">
                                            <TrashIcon className="h-4 w-4" />
                                            Remove Photo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <form onSubmit={handleSaveProfile} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Full Name</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!isEditing}
                                        className={clsx("input w-full", !isEditing && "bg-background cursor-not-allowed opacity-70")} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">Email Address</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isEditing}
                                        className={clsx("input w-full", !isEditing && "bg-background cursor-not-allowed opacity-70")} />
                                </div>
                            </div>
                            <div className="mt-6">
                                <label className="block text-sm font-medium text-text-primary mb-2">Expertise Tags</label>
                                <input
                                    type="text"
                                    value={expertiseTags}
                                    onChange={(e) => setExpertiseTags(e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="e.g. security, pricing, legal, cloud..."
                                    className={clsx("input w-full", !isEditing && "bg-background cursor-not-allowed opacity-70")}
                                />
                                <p className="text-xs text-text-secondary mt-1">Separate with commas. These help AI suggest you for relevant tasks.</p>
                            </div>
                            {isEditing && (
                                <div className="flex justify-end mt-6 pt-6 border-t border-border">
                                    <button type="submit" disabled={isSaving} className="btn-primary">
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                )}

                {/* Organization Tab */}
                {activeTab === 'organization' && (
                    <div className="space-y-6">
                        {/* Organization Header Card */}
                        <div className="bg-surface rounded-xl border border-border">
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                                        {organization?.name?.charAt(0)?.toUpperCase() || 'O'}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-text-primary">{organization?.name || 'Organization'}</h2>
                                        <p className="text-sm text-text-secondary">Enterprise Account</p>
                                    </div>
                                </div>
                                {organization && user?.role === 'admin' && !isEditingOrg && (
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsEditingOrg(true)} className="btn-secondary btn-sm">
                                            <PencilIcon className="h-4 w-4 mr-1" />Edit
                                        </button>
                                        <button onClick={() => setShowDeleteConfirm(true)} className="btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {organization ? (
                                <div className="p-6">
                                    {isEditingOrg ? (
                                        <form onSubmit={handleUpdateOrg} className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-text-primary mb-2">Organization Name</label>
                                                <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="input w-full max-w-md" placeholder="Enter organization name" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setIsEditingOrg(false)} className="btn-secondary">Cancel</button>
                                                <button type="submit" disabled={isSavingOrg} className="btn-primary">{isSavingOrg ? 'Saving...' : 'Save Changes'}</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                                                        <UserCircleIcon className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-blue-700">{organization.user_count || 1}</p>
                                                        <p className="text-sm text-blue-600">Team Members</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center">
                                                        <FolderIcon className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-green-700">{organization.project_count || 0}</p>
                                                        <p className="text-sm text-green-600">Projects</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-purple-500 flex items-center justify-center">
                                                        <CogIcon className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-purple-700">∞</p>
                                                        <p className="text-sm text-purple-600">Knowledge Items</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    {showCreateOrg ? (
                                        <form onSubmit={handleCreateOrg} className="max-w-md mx-auto space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-text-primary mb-2 text-left">Organization Name</label>
                                                <input type="text" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} className="input w-full" placeholder="e.g., Acme Corporation" autoFocus />
                                            </div>
                                            <div className="flex justify-center gap-2">
                                                <button type="button" onClick={() => setShowCreateOrg(false)} className="btn-secondary">Cancel</button>
                                                <button type="submit" disabled={isSavingOrg} className="btn-primary">{isSavingOrg ? 'Creating...' : 'Create Organization'}</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <BuildingOfficeIcon className="h-12 w-12 mx-auto text-text-muted mb-3" />
                                            <p className="text-text-secondary mb-4">No organization associated</p>
                                            <button onClick={() => setShowCreateOrg(true)} className="btn-primary">
                                                <PlusIcon className="h-4 w-4 mr-2" />Create Organization
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Team Members Section */}
                        {organization && (
                            <div className="bg-surface rounded-xl border border-border">
                                <div className="p-6 border-b border-border flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-text-primary">Team Members</h3>
                                        <p className="text-sm text-text-secondary mt-1">Manage your organization's team</p>
                                    </div>
                                    {user?.role === 'admin' && (
                                        <button onClick={() => setShowInviteModal(true)} className="btn-primary btn-sm">
                                            <PlusIcon className="h-4 w-4 mr-1" />Invite Member
                                        </button>
                                    )}
                                </div>
                                <div className="p-6">
                                    <div className="space-y-3">
                                        {teamMembers.map((member) => (
                                            <div key={member.id} className={clsx(
                                                "flex items-center justify-between p-4 rounded-xl border",
                                                member.is_current_user
                                                    ? "bg-gradient-to-r from-primary/5 to-blue-50 border-primary/10"
                                                    : "bg-gray-50 border-gray-100"
                                            )}>
                                                <div className="flex items-center gap-3">
                                                    {member.profile_photo ? (
                                                        <img src={member.profile_photo} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-medium">
                                                            {member.name?.charAt(0)?.toUpperCase() || 'U'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-text-primary">{member.name}</p>
                                                        <p className="text-sm text-text-secondary">{member.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={clsx(
                                                        "px-3 py-1 rounded-full text-xs font-medium",
                                                        member.role === 'admin' ? "bg-primary/15 text-primary" : "bg-gray-200 text-gray-600"
                                                    )}>
                                                        {member.role?.charAt(0).toUpperCase() + member.role?.slice(1)}
                                                    </span>
                                                    {member.is_current_user && <span className="text-xs text-text-muted">You</span>}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Pending Invitations */}
                                        {invitations.filter(inv => inv.status === 'pending').length > 0 && (
                                            <div className="mt-4">
                                                <h4 className="text-sm font-medium text-text-primary mb-3">Pending Invitations</h4>
                                                <div className="space-y-2">
                                                    {invitations.filter(inv => inv.status === 'pending').map((inv) => (
                                                        <div key={inv.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-yellow-200 flex items-center justify-center">
                                                                    <EnvelopeIcon className="h-4 w-4 text-yellow-700" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-text-primary">{inv.email}</p>
                                                                    <p className="text-xs text-text-secondary">
                                                                        {inv.role} • {inv.is_expired ? 'Expired' : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {user?.role === 'admin' && (
                                                                <div className="flex gap-2">
                                                                    {inv.is_expired ? (
                                                                        <button onClick={() => handleResendInvitation(inv.id)} className="text-xs text-primary hover:underline">
                                                                            Resend
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={() => handleCancelInvitation(inv.id)} className="text-xs text-red-600 hover:underline">
                                                                            Cancel
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Info box for no pending invitations */}
                                        {invitations.filter(inv => inv.status === 'pending').length === 0 && (
                                            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                                <div className="flex gap-3">
                                                    <EnvelopeIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-medium text-blue-800">Invite team members</p>
                                                        <p className="text-sm text-blue-600 mt-1">Click "Invite Member" to send email invitations. Team members will be able to collaborate on projects and access the knowledge base.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Invite Member Modal */}
                        <InviteMemberModal
                            isOpen={showInviteModal}
                            onClose={() => setShowInviteModal(false)}
                            onInviteSent={fetchInvitations}
                        />

                        {/* Delete Confirmation Modal */}
                        {showDeleteConfirm && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
                                    <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Organization?</h3>
                                    <p className="text-text-secondary mb-4">This will permanently delete "{organization?.name}" and remove all users from the organization. This action cannot be undone.</p>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancel</button>
                                        <button onClick={handleDeleteOrg} disabled={isSavingOrg} className="btn-sm bg-red-600 text-white hover:bg-red-700">
                                            {isSavingOrg ? 'Deleting...' : 'Delete Organization'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Vendor Profile Tab */}
                {activeTab === 'vendor' && (
                    <div className="space-y-6">
                        <div className="bg-surface rounded-xl border border-border">
                            <div className="p-6 border-b border-border">
                                <h2 className="text-xl font-bold text-text-primary">Vendor Profile</h2>
                                <p className="text-sm text-text-secondary mt-1">
                                    This information is used to assess eligibility for RFPs and display on your dashboard.
                                </p>
                            </div>

                            <form onSubmit={handleSaveVendorProfile} className="p-6 space-y-6">
                                {/* Document Upload Section */}
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-3 mb-3">
                                        <DocumentArrowUpIcon className="h-6 w-6 text-primary" />
                                        <div>
                                            <h3 className="font-medium text-text-primary">Quick Fill from Document</h3>
                                            <p className="text-xs text-text-secondary">Upload your company profile, capability statement, or about us document</p>
                                        </div>
                                    </div>

                                    <input
                                        type="file"
                                        ref={vendorFileInputRef}
                                        onChange={handleVendorFileUpload}
                                        accept=".pdf,.docx,.doc,.pptx,.ppt"
                                        className="hidden"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => vendorFileInputRef.current?.click()}
                                        disabled={isExtractingVendor}
                                        className={clsx(
                                            "w-full p-4 border-2 border-dashed rounded-lg text-center transition-all",
                                            isExtractingVendor
                                                ? "border-primary bg-primary-50 cursor-wait"
                                                : "border-gray-300 hover:border-primary hover:bg-primary-50/50 cursor-pointer"
                                        )}
                                    >
                                        {isExtractingVendor ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="h-8 w-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                                                <span className="text-sm font-medium text-primary">Extracting vendor profile with AI...</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <DocumentArrowUpIcon className="h-8 w-8 text-gray-400" />
                                                <span className="text-sm font-medium text-text-secondary">
                                                    Click to upload PDF, DOCX, or PPTX
                                                </span>
                                                <span className="text-xs text-text-muted">Maximum 10MB</span>
                                            </div>
                                        )}
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-border"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="px-3 bg-surface text-sm text-text-muted">Or fill in manually</span>
                                    </div>
                                </div>

                                {/* Company Registration */}
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Company Registration Country
                                    </label>
                                    <input
                                        type="text"
                                        value={vendorProfile.registration_country}
                                        onChange={(e) => setVendorProfile(prev => ({ ...prev, registration_country: e.target.value }))}
                                        className="input w-full max-w-md"
                                        placeholder="e.g., United States, India, United Kingdom"
                                    />
                                </div>

                                {/* Years in Business */}
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Years in Business
                                    </label>
                                    <input
                                        type="number"
                                        value={vendorProfile.years_in_business}
                                        onChange={(e) => setVendorProfile(prev => ({ ...prev, years_in_business: e.target.value }))}
                                        className="input w-full max-w-md"
                                        placeholder="e.g., 5"
                                        min="0"
                                    />
                                </div>

                                {/* Team Size / Employee Count */}
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Team Size (Number of Employees)
                                    </label>
                                    <input
                                        type="number"
                                        value={vendorProfile.employee_count}
                                        onChange={(e) => setVendorProfile(prev => ({ ...prev, employee_count: e.target.value }))}
                                        className="input w-full max-w-md"
                                        placeholder="e.g., 50"
                                        min="1"
                                    />
                                </div>

                                {/* Certifications */}
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Certifications
                                    </label>
                                    <input
                                        type="text"
                                        value={vendorProfile.certifications}
                                        onChange={(e) => setVendorProfile(prev => ({ ...prev, certifications: e.target.value }))}
                                        className="input w-full max-w-md"
                                        placeholder="e.g., ISO 27001, SOC 2, GDPR Compliant (comma-separated)"
                                    />
                                    <p className="text-xs text-text-muted mt-1">Enter certifications separated by commas</p>
                                </div>

                                {/* Geographic Presence */}
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-2">
                                        Geographic Presence
                                    </label>
                                    <input
                                        type="text"
                                        value={vendorProfile.geographies}
                                        onChange={(e) => setVendorProfile(prev => ({ ...prev, geographies: e.target.value }))}
                                        className="input w-full max-w-md"
                                        placeholder="e.g., North America, Europe, APAC (comma-separated)"
                                    />
                                    <p className="text-xs text-text-muted mt-1">Enter regions where you operate, separated by commas</p>
                                </div>

                                {/* Submit Button */}
                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSavingVendor}
                                        className="btn-primary"
                                    >
                                        {isSavingVendor ? (
                                            <span className="flex items-center gap-2">
                                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Saving...
                                            </span>
                                        ) : (
                                            'Save Vendor Profile'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Info Note */}
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex items-start gap-3">
                                <ShieldCheckIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-medium text-blue-800">Why is this important?</h4>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Your vendor profile is used to assess eligibility for RFPs. Complete profiles have higher chances of meeting RFP requirements. This information appears in the Vendor Eligibility panel on your dashboard.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'knowledge' && <KnowledgeProfiles />}
                {activeTab === 'dimensions' && <FilterDimensions />}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <div className="bg-surface rounded-xl border border-border max-w-3xl">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-lg font-semibold text-text-primary">Security</h2>
                            <p className="text-sm text-text-secondary mt-1">Manage your password and security</p>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-6 space-y-6">
                            <div>
                                <h3 className="text-sm font-medium text-text-primary mb-4">Change Password</h3>
                                <div className="space-y-3 max-w-md">
                                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="input w-full" />
                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="input w-full" />
                                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="input w-full" />
                                </div>
                                <button type="submit" disabled={isChangingPassword} className="btn-primary mt-4">
                                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                            <div className="pt-6 border-t border-border">
                                <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                                    <div>
                                        <p className="font-medium text-text-primary">Two-Factor Authentication</p>
                                        <p className="text-sm text-text-secondary">Add extra security</p>
                                    </div>
                                    <button type="button" className="btn-secondary btn-sm">Enable</button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="bg-surface rounded-xl border border-border max-w-3xl">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-lg font-semibold text-text-primary">Notifications</h2>
                            <p className="text-sm text-text-secondary mt-1">Configure your alert preferences</p>
                        </div>
                        <div className="p-6 space-y-3">
                            {[
                                { id: 'email_project', label: 'Project assignments', desc: 'When assigned to a project' },
                                { id: 'email_review', label: 'Answer reviews', desc: 'When answers are reviewed' },
                                { id: 'email_export', label: 'Export completions', desc: 'When exports are ready' },
                                { id: 'browser', label: 'Browser notifications', desc: 'Real-time alerts' },
                            ].map(setting => (
                                <label key={setting.id} className="flex items-center justify-between p-4 bg-background rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-text-primary">{setting.label}</p>
                                        <p className="text-sm text-text-secondary">{setting.desc}</p>
                                    </div>
                                    <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-border text-primary focus:ring-primary flex-shrink-0 ml-4" />
                                </label>
                            ))}
                        </div>

                        {/* Language Section */}
                        <div className="p-6 border-t border-border">
                            <h3 className="text-sm font-semibold text-text-primary mb-3">Language / भाषा</h3>
                            <div className="flex items-center gap-4">
                                <LanguageSelector variant="buttons" />
                            </div>
                        </div>

                        {/* Theme Section */}
                        <div className="p-6 border-t border-border">
                            <h3 className="text-sm font-semibold text-text-primary mb-3">Theme</h3>
                            <div className="flex items-center gap-4">
                                <ThemeSelector variant="buttons" />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && <AIConfigurationSection />}

                {/* Experiments Tab */}
                {activeTab === 'experiments' && <ExperimentsSection />}

                {/* Webhooks Tab */}
                {activeTab === 'webhooks' && <WebhooksSection />}

                {/* Approval Workflows Tab */}
                {activeTab === 'approvals' && <ApprovalWorkflowsSection />}

                {/* Revenue Tracking Tab */}
                {activeTab === 'revenue' && <RevenueTrackingSection />}

                {/* SSO Configuration Tab */}
                {activeTab === 'sso' && <SSOConfigurationSection />}

                {/* CRM Integration Tab */}
                {activeTab === 'crm' && <CRMIntegrationSection />}

                {/* Branding Tab */}
                {activeTab === 'branding' && (
                    <div className="space-y-6 max-w-3xl">
                        <div className="bg-surface rounded-xl border border-border p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-gradient-to-br from-primary/20 to-purple-100 rounded-xl">
                                    <SwatchIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-text-primary">Custom Branding</h2>
                                    <p className="text-text-secondary">Customize your organization's look and feel</p>
                                </div>
                            </div>
                            <Link
                                to="/settings/branding"
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <SwatchIcon className="h-4 w-4" />
                                Open Branding Settings
                            </Link>
                        </div>
                    </div>
                )}

                {/* Help & Support Tab */}
                {activeTab === 'help' && (
                    <div className="space-y-6 max-w-3xl">
                        {/* Platform Tour Card */}
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <RocketLaunchIcon className="h-8 w-8" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold mb-2">Platform Tour</h3>
                                    <p className="text-white/90 mb-4">
                                        New to RFP Pro? Take an interactive tour to learn how our AI-powered platform
                                        helps you create winning proposals.
                                    </p>
                                    <button
                                        onClick={handleStartTour}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all"
                                    >
                                        <RocketLaunchIcon className="h-5 w-5" />
                                        Start Platform Tour
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Documentation Card */}
                        <div className="bg-surface rounded-xl border border-border">
                            <div className="p-6 border-b border-border">
                                <h2 className="text-lg font-semibold text-text-primary">Documentation & Resources</h2>
                                <p className="text-sm text-text-secondary mt-1">Learn how to use RFP Pro effectively</p>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link
                                    to="/projects"
                                    className="p-4 bg-background rounded-lg border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                            <BookOpenIcon className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-text-primary group-hover:text-primary transition-colors">Getting Started Guide</p>
                                            <p className="text-sm text-text-secondary">Create your first project</p>
                                        </div>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => {
                                        handleStartTour();
                                    }}
                                    className="p-4 bg-background rounded-lg border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer group text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                                            <CogIcon className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-text-primary group-hover:text-primary transition-colors">AI Agents Overview</p>
                                            <p className="text-sm text-text-secondary">See our 27 AI agents in action</p>
                                        </div>
                                    </div>
                                </button>
                                <Link
                                    to="/knowledge"
                                    className="p-4 bg-background rounded-lg border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                                            <FolderIcon className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-text-primary group-hover:text-primary transition-colors">Knowledge Base Tips</p>
                                            <p className="text-sm text-text-secondary">Upload and manage content</p>
                                        </div>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => {
                                        toast.success('FAQ section coming soon!');
                                    }}
                                    className="p-4 bg-background rounded-lg border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer group text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                                            <QuestionMarkCircleIcon className="h-5 w-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-text-primary group-hover:text-primary transition-colors">FAQ</p>
                                            <p className="text-sm text-text-secondary">Common questions answered</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Contact Support Card */}
                        <div className="bg-surface rounded-xl border border-border">
                            <div className="p-6 border-b border-border">
                                <h2 className="text-lg font-semibold text-text-primary">Need Help?</h2>
                                <p className="text-sm text-text-secondary mt-1">Our support team is here to assist you</p>
                            </div>
                            <div className="p-6">
                                <a
                                    href="mailto:support@rfppro.com?subject=RFP Pro Support Request"
                                    className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 hover:border-blue-200 transition-all"
                                >
                                    <EnvelopeIcon className="h-6 w-6 text-blue-600" />
                                    <div className="flex-1">
                                        <p className="font-medium text-text-primary">Email Support</p>
                                        <p className="text-sm text-blue-600">support@rfppro.com</p>
                                    </div>
                                    <span className="px-4 py-2 bg-white text-primary border border-primary/20 rounded-lg text-sm font-medium hover:bg-primary hover:text-white transition-colors">Contact</span>
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Platform Tour Modal */}
            <PlatformTour
                isOpen={showTour}
                onClose={() => setShowTour(false)}
                onComplete={handleTourComplete}
            />
        </div>
    );
}
