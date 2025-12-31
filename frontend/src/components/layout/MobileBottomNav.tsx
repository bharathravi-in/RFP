import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    HomeIcon,
    FolderIcon,
    BookOpenIcon,
    SparklesIcon,
    Cog6ToothIcon,
    Squares2X2Icon,
    XMarkIcon,
    BookmarkIcon,
    DocumentDuplicateIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

// Primary nav items (always visible in bottom bar)
const primaryNavItems = [
    { href: '/dashboard', icon: HomeIcon, label: 'Home' },
    { href: '/projects', icon: FolderIcon, label: 'Projects' },
    { href: '/co-pilot', icon: SparklesIcon, label: 'Co-Pilot' },
];

// More options (shown in floating menu)
const moreNavItems = [
    { href: '/knowledge', icon: BookOpenIcon, label: 'Knowledge Base' },
    { href: '/library', icon: BookmarkIcon, label: 'Answer Library' },
    { href: '/templates', icon: DocumentDuplicateIcon, label: 'Templates' },
    { href: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
    { href: '/usage', icon: ChartBarIcon, label: 'Usage' },
    { href: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
];

export default function MobileBottomNav() {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const isMoreActive = moreNavItems.some((item) =>
        location.pathname.startsWith(item.href)
    );

    return (
        <>
            {/* Floating Menu Overlay */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            {/* Floating Menu */}
            {isMenuOpen && (
                <div className="fixed bottom-20 right-4 z-50 md:hidden animate-slide-up">
                    <div className="bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden min-w-[200px]">
                        {/* Language Toggle */}
                        <div className="p-3 border-b border-border">
                            <p className="text-xs text-text-muted mb-2">Language / भाषा</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        localStorage.setItem('i18nextLng', 'en');
                                        window.location.reload();
                                    }}
                                    className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700"
                                >
                                    English
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.setItem('i18nextLng', 'hi');
                                        window.location.reload();
                                    }}
                                    className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700"
                                >
                                    हिंदी
                                </button>
                            </div>
                        </div>
                        {/* Theme Toggle */}
                        <div className="p-3 border-b border-border">
                            <p className="text-xs text-text-muted mb-2">Theme</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        document.documentElement.classList.remove('dark');
                                        localStorage.setItem('rfp-theme-storage', JSON.stringify({ state: { theme: 'light', effectiveTheme: 'light' }, version: 0 }));
                                        setIsMenuOpen(false);
                                    }}
                                    className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center gap-1"
                                >
                                    ☀️ Light
                                </button>
                                <button
                                    onClick={() => {
                                        document.documentElement.classList.add('dark');
                                        localStorage.setItem('rfp-theme-storage', JSON.stringify({ state: { theme: 'dark', effectiveTheme: 'dark' }, version: 0 }));
                                        setIsMenuOpen(false);
                                    }}
                                    className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center gap-1"
                                >
                                    🌙 Dark
                                </button>
                            </div>
                        </div>
                        {/* Navigation Items */}
                        <div className="py-2">
                            {moreNavItems.map((item) => {
                                const isActive = location.pathname.startsWith(item.href);
                                return (
                                    <NavLink
                                        key={item.href}
                                        to={item.href}
                                        onClick={() => setIsMenuOpen(false)}
                                        className={clsx(
                                            'flex items-center gap-3 px-4 py-3 transition-colors',
                                            isActive
                                                ? 'bg-primary-50 text-primary'
                                                : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-gray-800'
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation Bar */}
            <nav className="mobile-bottom-nav">
                {primaryNavItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.href);
                    return (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            className={clsx(
                                'flex flex-col items-center gap-0.5 px-3',
                                isActive ? 'text-primary' : 'text-text-muted'
                            )}
                        >
                            <item.icon className="h-6 w-6" />
                            <span className="text-[10px]">{item.label}</span>
                        </NavLink>
                    );
                })}

                {/* More Button - Floating Action Style */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={clsx(
                        'flex flex-col items-center gap-0.5 px-3 transition-all',
                        isMenuOpen || isMoreActive ? 'text-primary' : 'text-text-muted'
                    )}
                >
                    {isMenuOpen ? (
                        <XMarkIcon className="h-6 w-6" />
                    ) : (
                        <Squares2X2Icon className="h-6 w-6" />
                    )}
                    <span className="text-[10px]">More</span>
                </button>
            </nav>

            <style>{`
                @keyframes slide-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.2s ease-out;
                }
            `}</style>
        </>
    );
}
