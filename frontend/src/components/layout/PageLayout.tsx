import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import Breadcrumbs from './Breadcrumbs';
import { Bars3Icon, MagnifyingGlassIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import OrganizationOnboarding from '@/components/onboarding/OrganizationOnboarding';
import NotificationDropdown from '@/components/NotificationDropdown';
import SmartSearch from '@/components/search/SmartSearch';
import clsx from 'clsx';

const SIDEBAR_COLLAPSED_KEY = 'rfp-sidebar-collapsed';

export default function PageLayout() {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return saved === 'true';
    });
    const { user, organization, fetchUser } = useAuthStore();

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

    return (
        <div className="min-h-screen bg-background">
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
                <header className="sticky top-0 z-20 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
                    {/* Left: Mobile menu + branding (mobile only) OR collapse toggle (desktop) */}
                    <div className="flex items-center gap-3">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 -ml-2 rounded-button hover:bg-surface-elevated transition-colors"
                        >
                            <Bars3Icon className="h-6 w-6 text-text-primary" />
                        </button>

                        {/* Mobile branding */}
                        <div className="flex items-center gap-2 lg:hidden">
                            <img src="/logo.svg" alt="RFP Pro" className="h-8 w-8" />
                            <span className="font-display font-bold text-lg text-text-primary">RFP Pro</span>
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

                    {/* Right: Search + Notifications */}
                    <div className="flex items-center gap-3">
                        {/* Search Button */}
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Search (⌘K)"
                        >
                            <MagnifyingGlassIcon className="h-4 w-4 text-text-secondary" />
                            <span className="hidden sm:inline text-sm text-text-muted">Search...</span>
                            <kbd className="hidden md:inline text-xs px-1.5 py-0.5 bg-white text-text-muted rounded border border-gray-200">⌘K</kbd>
                        </button>
                        {/* Notification Bell */}
                        <NotificationDropdown />
                    </div>
                </header>

                {/* Page content */}
                <div className="p-4 md:p-6 lg:p-8">
                    <Breadcrumbs />
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
