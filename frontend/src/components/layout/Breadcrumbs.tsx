import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

export default function Breadcrumbs() {
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const [projectName, setProjectName] = useState<string>('');

    // Get project name from sessionStorage (set by ProjectDetail) to avoid duplicate API calls
    // This prevents Breadcrumbs and ProjectDetail from both fetching the same project
    useEffect(() => {
        if (id) {
            // Try to get cached project name from sessionStorage
            const cachedName = sessionStorage.getItem(`project-name-${id}`);
            if (cachedName) {
                setProjectName(cachedName);
            } else {
                // Fallback: use a generic label (ProjectDetail will set the correct name)
                setProjectName('Project');

                // Listen for storage changes (when ProjectDetail updates)
                const handleStorage = () => {
                    const name = sessionStorage.getItem(`project-name-${id}`);
                    if (name) setProjectName(name);
                };
                window.addEventListener('storage', handleStorage);

                // Also check after a short delay in case ProjectDetail sets it
                const timeout = setTimeout(() => {
                    const name = sessionStorage.getItem(`project-name-${id}`);
                    if (name) setProjectName(name);
                }, 100);

                return () => {
                    window.removeEventListener('storage', handleStorage);
                    clearTimeout(timeout);
                };
            }
        }
    }, [id]);

    const getBreadcrumbs = (): BreadcrumbItem[] => {
        const path = location.pathname;
        const breadcrumbs: BreadcrumbItem[] = [];

        // Dashboard is always the home
        if (path === '/dashboard') {
            return [{ label: 'Dashboard' }];
        }

        breadcrumbs.push({ label: 'Dashboard', href: '/dashboard' });

        // Projects
        if (path.startsWith('/projects')) {
            if (path === '/projects') {
                breadcrumbs.push({ label: 'Projects' });
            } else if (id) {
                breadcrumbs.push({ label: 'Projects', href: '/projects' });

                if (path.includes('/workspace')) {
                    breadcrumbs.push({
                        label: projectName || 'Project',
                        href: `/projects/${id}`
                    });
                    breadcrumbs.push({ label: 'Answer Workspace' });
                } else if (path.includes('/proposal')) {
                    breadcrumbs.push({
                        label: projectName || 'Project',
                        href: `/projects/${id}`
                    });
                    breadcrumbs.push({ label: 'Proposal Builder' });
                } else {
                    breadcrumbs.push({ label: projectName || 'Project' });
                }
            }
        }

        // Knowledge Base
        if (path === '/knowledge') {
            breadcrumbs.push({ label: 'Knowledge Base' });
        }

        // Templates
        if (path === '/templates') {
            breadcrumbs.push({ label: 'Templates' });
        }

        // Settings
        if (path === '/settings') {
            breadcrumbs.push({ label: 'Settings' });
        }

        return breadcrumbs;
    };

    const breadcrumbs = getBreadcrumbs();

    if (breadcrumbs.length <= 1) {
        return null; // Don't show breadcrumbs on the dashboard
    }

    return (
        <nav className="flex items-center gap-2 text-sm mb-6" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center gap-2">
                    {index > 0 && (
                        <ChevronRightIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                    )}
                    {index === 0 && (
                        <HomeIcon className="h-4 w-4 text-text-secondary" />
                    )}
                    {crumb.href ? (
                        <Link
                            to={crumb.href}
                            className="text-text-secondary hover:text-primary transition-colors"
                        >
                            {crumb.label}
                        </Link>
                    ) : (
                        <span className="text-text-primary font-medium">
                            {crumb.label}
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
}
