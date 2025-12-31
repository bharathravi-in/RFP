import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppSidebar from './AppSidebar';
import Breadcrumbs from './Breadcrumbs';
import MobileBottomNav from './MobileBottomNav';
import { Bars3Icon, MagnifyingGlassIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import OrganizationOnboarding from '@/components/onboarding/OrganizationOnboarding';
import NotificationDropdown from '@/components/NotificationDropdown';
import SmartSearch from '@/components/search/SmartSearch';
import { TrialStatusBanner, useTrialStatus } from '@/components/subscription/TrialStatusBanner';
import LanguageSelector from '@/components/common/LanguageSelector';
import ThemeSelector from '@/components/common/ThemeSelector';
import clsx from 'clsx';

const SIDEBAR_COLLAPSED_KEY = 'rfp-sidebar-collapsed';

export default function PageLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return saved === 'true';
    });
    const { user, organization, fetchUser } = useAuthStore();
    const trialStatus = useTrialStatus();

    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // Check if we're on a builder/proposal page
    const isBuilderPage = location.pathname.includes('/proposal') || location.pathname.includes('/versions');

    // Track if user manually expanded on builder page
    const [builderExpanded, setBuilderExpanded] = useState(false);

    // Reset builder expanded state when leaving builder page
    useEffect(() => {
        if (!isBuilderPage) {
            setBuilderExpanded(false);
        }
    }, [isBuilderPage]);

    // Effective collapsed state:
    // - On builder page: collapsed unless user manually expanded
    // - On other pages: use manual collapsed state
    const isEffectivelyCollapsed = isBuilderPage
        ? !builderExpanded
        : sidebarCollapsed;

    // Persist manual collapse state (for non-builder pages)
    useEffect(() => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    const hasOrganization = organization || user?.organization_id;
    const needsOnboarding = user && !hasOrganization && !onboardingComplete;

    // Keyboard shortcut: Cmd+K or Ctrl+K to open search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleOnboardingComplete = async () => {
        await fetchUser();
        setOnboardingComplete(true);
    };

    const toggleSidebarCollapse = () => {
        if (isBuilderPage) {
            // On builder page, toggle the builder-specific expanded state
            setBuilderExpanded(prev => !prev);
        } else {
            // On other pages, toggle the regular collapsed state
            setSidebarCollapsed(prev => !prev);
        }
    };

    const handleUpgrade = () => {
        navigate('/settings?tab=billing');
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Trial Status Banner */}
            {trialStatus && (
                <TrialStatusBanner
                    trialDaysRemaining={trialStatus.trialDaysRemaining}
                    isTrialActive={trialStatus.isTrialActive}
                    subscriptionPlan={trialStatus.subscriptionPlan}
                    subscriptionStatus={trialStatus.subscriptionStatus}
                    onUpgrade={handleUpgrade}
                />
            )}

            {/* Smart Search Modal */}
            {searchOpen && <SmartSearch onClose={() => setSearchOpen(false)} />}

            {/* Organization Onboarding Modal */}
            <OrganizationOnboarding
                isOpen={needsOnboarding ?? false}
                onComplete={handleOnboardingComplete}
            />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="mobile-overlay animate-fade-in"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <AppSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                isCollapsed={isEffectivelyCollapsed}
                onToggleCollapse={toggleSidebarCollapse}
            />

            {/* Main content area */}
            <main className={clsx(
                "min-h-screen transition-all duration-300",
                isEffectivelyCollapsed ? "lg:ml-[72px]" : "lg:ml-sidebar"
            )}>
                {/* Header - visible on all screens */}
                <header className="sticky top-0 z-20 bg-surface border-b border-border px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
                    {/* Left: Mobile menu + branding (mobile only) OR collapse toggle (desktop) */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 -ml-1 rounded-button hover:bg-surface-elevated transition-colors"
                        >
                            <Bars3Icon className="h-5 w-5 sm:h-6 sm:w-6 text-text-primary" />
                        </button>

                        {/* Mobile branding - logo only on very small, text on sm+ */}
                        <div className="flex items-center gap-2 lg:hidden">
                            <img src="/logo.svg" alt="RFP Pro" className="h-7 w-7 sm:h-8 sm:w-8" />
                            <span className="hidden sm:inline font-display font-bold text-lg text-text-primary">RFP Pro</span>
                        </div>

                        {/* Desktop collapse toggle */}
                        <button
                            onClick={toggleSidebarCollapse}
                            className="hidden lg:flex items-center gap-2 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                            title={isEffectivelyCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {isEffectivelyCollapsed ? (
                                <ChevronDoubleRightIcon className="h-5 w-5" />
                            ) : (
                                <ChevronDoubleLeftIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>

                    {/* Right: Search + Theme + Notifications (compact on mobile) */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Search Button - icon only on mobile */}
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Search (⌘K)"
                        >
                            <MagnifyingGlassIcon className="h-5 w-5 text-text-secondary" />
                        </button>
                        {/* Language Selector - hidden on mobile */}
                        <div className="hidden md:block">
                            <LanguageSelector />
                        </div>
                        {/* Theme Selector - hidden on mobile (accessible via More menu) */}
                        <div className="hidden sm:block">
                            <ThemeSelector />
                        </div>
                        {/* Notification Bell */}
                        <NotificationDropdown />
                    </div>
                </header>

                {/* Page content */}
                <div className="p-4 md:p-6 lg:p-8 pb-20 md:pb-6 lg:pb-8">
                    <Breadcrumbs />
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />
        </div>
    );
}
