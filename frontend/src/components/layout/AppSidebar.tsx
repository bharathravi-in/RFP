import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import {
    HomeIcon,
    FolderIcon,
    BookOpenIcon,
    DocumentDuplicateIcon,
    Cog6ToothIcon,
    ArrowRightOnRectangleIcon,
    XMarkIcon,
    BookmarkIcon,
    ChartBarIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

// Translation keys for navigation items
const navigationKeys = [
    { key: 'nav.dashboard', href: '/dashboard', icon: HomeIcon },
    { key: 'nav.projects', href: '/projects', icon: FolderIcon },
    { key: 'nav.knowledgeBase', href: '/knowledge', icon: BookOpenIcon },
    { key: 'nav.answerLibrary', href: '/library', icon: BookmarkIcon },
    { key: 'nav.templates', href: '/templates', icon: DocumentDuplicateIcon },
    { key: 'nav.analytics', href: '/analytics', icon: ChartBarIcon },
    { key: 'nav.usage', href: '/usage', icon: ChartBarIcon },
    { key: 'nav.coPilot', href: '/co-pilot', icon: SparklesIcon },
    { key: 'nav.settings', href: '/settings', icon: Cog6ToothIcon },
];

interface AppSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

export default function AppSidebar({
    isOpen = false,
    onClose,
    isCollapsed = false,
}: AppSidebarProps) {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleNavClick = () => {
        if (onClose) onClose();
    };

    return (
        <aside
            className={clsx(
                "sidebar",
                "fixed inset-y-0 left-0 z-40",
                isCollapsed ? "w-[72px]" : "w-[280px] lg:w-sidebar",
                "transform transition-all duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
        >
            {/* Logo Header */}
            <div className={clsx(
                "h-16 flex items-center border-b border-border flex-shrink-0",
                isCollapsed ? "justify-center px-2" : "justify-between px-5"
            )}>
                <div className={clsx("flex items-center", isCollapsed ? "" : "gap-3")}>
                    <img
                        src="/logo.svg"
                        alt="RFP Pro"
                        className="h-10 w-10 flex-shrink-0"
                    />
                    {!isCollapsed && (
                        <div>
                            <span className="font-display font-bold text-lg text-text-primary">{t('common.appName')}</span>
                            <p className="text-xs text-text-muted">{t('common.tagline')}</p>
                        </div>
                    )}
                </div>
                {!isCollapsed && (
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 -mr-2 rounded-button hover:bg-surface-elevated transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5 text-text-secondary" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className={clsx(
                "flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar",
                isCollapsed ? "px-2" : "px-3"
            )}>
                {navigationKeys.map((item) => (
                    <NavLink
                        key={item.key}
                        to={item.href}
                        onClick={handleNavClick}
                        title={isCollapsed ? t(item.key) : undefined}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center rounded-button text-sm font-medium transition-all duration-fast',
                                isCollapsed
                                    ? 'justify-center p-3'
                                    : 'gap-3 px-4 py-3',
                                isActive
                                    ? 'bg-gradient-to-r from-primary-100 to-primary-50 text-primary-700 shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                            )
                        }
                    >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!isCollapsed && <span>{t(item.key)}</span>}
                    </NavLink>
                ))}


                {/* Super Admin Section */}
                {user?.is_super_admin && (
                    <>
                        {!isCollapsed && (
                            <div className="pt-4 pb-2 px-4">
                                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Super Admin
                                </p>
                            </div>
                        )}
                        <NavLink
                            to="/superadmin"
                            onClick={handleNavClick}
                            title={isCollapsed ? "Admin Dashboard" : undefined}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center rounded-button text-sm font-medium transition-all duration-fast',
                                    isCollapsed
                                        ? 'justify-center p-3'
                                        : 'gap-3 px-4 py-3',
                                    isActive
                                        ? 'bg-gradient-to-r from-amber-100 to-orange-50 text-amber-700 shadow-sm'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                                )
                            }
                        >
                            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                            {!isCollapsed && <span>Admin Dashboard</span>}
                        </NavLink>
                        <NavLink
                            to="/superadmin/tenants"
                            onClick={handleNavClick}
                            title={isCollapsed ? "Tenants" : undefined}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center rounded-button text-sm font-medium transition-all duration-fast',
                                    isCollapsed
                                        ? 'justify-center p-3'
                                        : 'gap-3 px-4 py-3',
                                    isActive
                                        ? 'bg-gradient-to-r from-amber-100 to-orange-50 text-amber-700 shadow-sm'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                                )
                            }
                        >
                            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                            </svg>
                            {!isCollapsed && <span>Tenants</span>}
                        </NavLink>
                        <NavLink
                            to="/superadmin/features"
                            onClick={handleNavClick}
                            title={isCollapsed ? "Feature Flags" : undefined}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center rounded-button text-sm font-medium transition-all duration-fast',
                                    isCollapsed
                                        ? 'justify-center p-3'
                                        : 'gap-3 px-4 py-3',
                                    isActive
                                        ? 'bg-gradient-to-r from-amber-100 to-orange-50 text-amber-700 shadow-sm'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                                )
                            }
                        >
                            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                            </svg>
                            {!isCollapsed && <span>Feature Flags</span>}
                        </NavLink>
                        <NavLink
                            to="/superadmin/agent-performance"
                            onClick={handleNavClick}
                            title={isCollapsed ? "Agent Performance" : undefined}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center rounded-button text-sm font-medium transition-all duration-fast',
                                    isCollapsed
                                        ? 'justify-center p-3'
                                        : 'gap-3 px-4 py-3',
                                    isActive
                                        ? 'bg-gradient-to-r from-amber-100 to-orange-50 text-amber-700 shadow-sm'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                                )
                            }
                        >
                            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                            </svg>
                            {!isCollapsed && <span>Agent Performance</span>}
                        </NavLink>
                    </>
                )}
            </nav>

            {/* User section */}
            <div className={clsx(
                "border-t border-border flex-shrink-0",
                isCollapsed ? "p-2" : "p-4"
            )}>
                <div className={clsx(
                    "flex items-center rounded-button bg-surface-elevated",
                    isCollapsed ? "justify-center p-2" : "gap-3 p-3"
                )}>
                    {user?.profile_photo ? (
                        <img
                            src={user.profile_photo}
                            alt={user.name}
                            className={clsx(
                                "rounded-full object-cover flex-shrink-0",
                                isCollapsed ? "h-8 w-8" : "h-10 w-10"
                            )}
                            onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <div
                        className={clsx(
                            "rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0",
                            isCollapsed ? "h-8 w-8" : "h-10 w-10"
                        )}
                        style={{ display: user?.profile_photo ? 'none' : 'flex' }}
                        title={isCollapsed ? user?.name : undefined}
                    >
                        <span className={clsx(
                            "font-semibold text-white",
                            isCollapsed ? "text-xs" : "text-sm"
                        )}>
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                    </div>
                    {!isCollapsed && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">
                                    {user?.name || 'User'}
                                </p>
                                <p className="text-xs text-text-muted truncate">
                                    {user?.role === 'admin' ? 'Administrator' : 'Team Member'}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-button text-text-muted hover:text-error hover:bg-error-light transition-colors flex-shrink-0"
                                title="Logout"
                            >
                                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                            </button>
                        </>
                    )}
                </div>
                {isCollapsed && (
                    <button
                        onClick={handleLogout}
                        className="w-full mt-2 p-2 rounded-button text-text-muted hover:text-error hover:bg-error-light transition-colors flex items-center justify-center"
                        title="Logout"
                    >
                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    </button>
                )}
            </div>
        </aside>
    );
}
