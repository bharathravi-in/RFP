import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
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

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Projects', href: '/projects', icon: FolderIcon },
    { name: 'Knowledge Base', href: '/knowledge', icon: BookOpenIcon },
    { name: 'Answer Library', href: '/library', icon: BookmarkIcon },
    { name: 'Templates', href: '/templates', icon: DocumentDuplicateIcon },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Co-Pilot', href: '/co-pilot', icon: SparklesIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
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
                            <span className="font-display font-bold text-lg text-text-primary">RFP Pro</span>
                            <p className="text-xs text-text-muted">AI-Powered Proposals</p>
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
                {navigation.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={handleNavClick}
                        title={isCollapsed ? item.name : undefined}
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
                        {!isCollapsed && <span>{item.name}</span>}
                    </NavLink>
                ))}
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
