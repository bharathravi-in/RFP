import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import Breadcrumbs from './Breadcrumbs';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import OrganizationOnboarding from '@/components/onboarding/OrganizationOnboarding';

export default function PageLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, organization, fetchUser } = useAuthStore();
    const [onboardingComplete, setOnboardingComplete] = useState(false);

    // Check if user needs to complete organization onboarding
    // User needs onboarding if: logged in AND has no organization_id AND onboarding not completed
    const hasOrganization = organization || user?.organization_id;
    const needsOnboarding = user && !hasOrganization && !onboardingComplete;

    const handleOnboardingComplete = async () => {
        // Refresh user data to get updated organization
        await fetchUser();
        setOnboardingComplete(true);
    };

    return (
        <div className="min-h-screen bg-background">
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
                {/* Mobile Header */}
                <header className="lg:hidden sticky top-0 z-20 bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
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
                </header>

                {/* Page content */}
                <div className="p-4 md:p-6 lg:p-content">
                    <Breadcrumbs />
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

