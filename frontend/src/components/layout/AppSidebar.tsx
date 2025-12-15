import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
    HomeIcon,
    FolderIcon,
    BookOpenIcon,
    Cog6ToothIcon,
    ArrowRightOnRectangleIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Projects', href: '/projects', icon: FolderIcon },
    { name: 'Knowledge Base', href: '/knowledge', icon: BookOpenIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function AppSidebar() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <aside className="fixed left-0 top-0 h-full w-sidebar bg-surface border-r border-border flex flex-col">
            {/* Logo */}
            <div className="h-16 flex items-center gap-2 px-6 border-b border-border">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                    <SparklesIcon className="h-5 w-5 text-white" />
                </div>
                <span className="font-semibold text-lg text-text-primary">AutoRespond</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {navigation.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-fast',
                                isActive
                                    ? 'bg-primary-light text-primary'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-background'
                            )
                        }
                    >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                    </NavLink>
                ))}
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                            {user?.name || 'User'}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                            {user?.email}
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"
                        title="Logout"
                    >
                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
