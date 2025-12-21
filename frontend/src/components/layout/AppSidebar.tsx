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
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Projects', href: '/projects', icon: FolderIcon },
    { name: 'Knowledge Base', href: '/knowledge', icon: BookOpenIcon },
    { name: 'Templates', href: '/templates', icon: DocumentDuplicateIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

interface AppSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function AppSidebar({ isOpen = false, onClose }: AppSidebarProps) {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleNavClick = () => {
        // Close sidebar on mobile after navigation
        if (onClose) onClose();
    };

    return (
        <aside
            className={clsx(
                "sidebar",
                // Mobile: slide in from left
                "fixed inset-y-0 left-0 z-40",
                "w-[280px] lg:w-sidebar",
                "transform transition-transform duration-normal ease-in-out",
                // Mobile visibility
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
        >
            {/* Logo Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-3">
                    <img
                        src="/logo.svg"
                        alt="RFP Pro"
                        className="h-10 w-10"
                    />
                    <div>
                        <span className="font-display font-bold text-lg text-text-primary">RFP Pro</span>
                        <p className="text-xs text-text-muted">AI-Powered Proposals</p>
                    </div>
                </div>
                {/* Mobile close button */}
                <button
                    onClick={onClose}
                    className="lg:hidden p-2 -mr-2 rounded-button hover:bg-surface-elevated transition-colors"
                >
                    <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                {navigation.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-4 py-3 rounded-button text-sm font-medium transition-all duration-fast',
                                isActive
                                    ? 'bg-gradient-to-r from-primary-100 to-primary-50 text-primary-700 shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                            )
                        }
                    >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        <span>{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-border flex-shrink-0">
                <div className="flex items-center gap-3 p-3 rounded-button bg-surface-elevated">
                    {user?.profile_photo ? (
                        <img
                            src={user.profile_photo}
                            alt={user.name}
                            className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                            onError={(e) => {
                                // Fallback to initials if image fails to load
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <div
                        className="h-10 w-10 rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0"
                        style={{ display: user?.profile_photo ? 'none' : 'flex' }}
                    >
                        <span className="text-sm font-semibold text-white">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                    </div>
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
                </div>
            </div>
        </aside>
    );
}
