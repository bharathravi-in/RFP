import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import Breadcrumbs from './Breadcrumbs';
import { Bars3Icon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import OrganizationOnboarding from '@/components/onboarding/OrganizationOnboarding';
import NotificationDropdown from '@/components/NotificationDropdown';
import SmartSearch from '@/components/search/SmartSearch';

export default function PageLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, organization, fetchUser } = useAuthStore();
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // Check if user needs to complete organization onboarding
    // User needs onboarding if: logged in AND has no organization_id AND onboarding not completed
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
        // Refresh user data to get updated organization
        await fetchUser();
        setOnboardingComplete(true);
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
            />

            {/* Main content area */}
            <main className="lg:ml-sidebar min-h-screen transition-all duration-normal">
                {/* Header - visible on all screens */}
                <header className="sticky top-0 z-20 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
                    {/* Left: Mobile menu + branding (mobile only) */}
                    <div className="flex items-center gap-3 lg:hidden">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 -ml-2 rounded-button hover:bg-surface-elevated transition-colors"
                        >
                            <Bars3Icon className="h-6 w-6 text-text-primary" />
                        </button>
                        <div className="flex items-center gap-2">
                            <img src="/logo.svg" alt="RFP Pro" className="h-8 w-8" />
                            <span className="font-display font-bold text-lg text-text-primary">RFP Pro</span>
                        </div>
                    </div>

                    {/* Desktop: Spacer */}
                    <div className="hidden lg:block" />

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
