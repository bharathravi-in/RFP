/**
 * Collaboration Presence Indicator
 * Shows who is currently viewing/editing the proposal
 */
import { useState, useEffect } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { WifiIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { ActiveUser } from '@/hooks/useCollaboration';

interface PresenceIndicatorProps {
    activeUsers: Record<string, ActiveUser>;
    isConnected: boolean;
    currentUserId?: number;
}

// Generate a consistent color for a user based on their ID
const getUserColor = (userId: number): string => {
    const colors = [
        'bg-blue-500',
        'bg-green-500',
        'bg-purple-500',
        'bg-pink-500',
        'bg-orange-500',
        'bg-teal-500',
        'bg-indigo-500',
        'bg-rose-500',
    ];
    return colors[userId % colors.length];
};

export default function PresenceIndicator({
    activeUsers,
    isConnected,
    currentUserId,
}: PresenceIndicatorProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    
    // Filter out current user
    const otherUsers = Object.values(activeUsers).filter(
        (user) => user.user_id !== currentUserId
    );

    // Get initials from name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    if (otherUsers.length === 0 && isConnected) {
        return (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
                <WifiIcon className="h-4 w-4 text-green-500" />
                <span>Just you</span>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2"
            >
                {/* Connection indicator */}
                <div
                    className={clsx(
                        'h-2 w-2 rounded-full',
                        isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    )}
                    title={isConnected ? 'Connected' : 'Disconnected'}
                />

                {/* Avatar stack */}
                <div className="flex -space-x-2">
                    {otherUsers.slice(0, 4).map((user, idx) => (
                        <div
                            key={user.user_id}
                            className={clsx(
                                'h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium',
                                getUserColor(user.user_id)
                            )}
                            style={{ zIndex: 10 - idx }}
                            title={user.name}
                        >
                            {getInitials(user.name)}
                        </div>
                    ))}
                    {otherUsers.length > 4 && (
                        <div
                            className="h-8 w-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                            style={{ zIndex: 5 }}
                        >
                            +{otherUsers.length - 4}
                        </div>
                    )}
                </div>

                <span className="text-sm text-gray-600">
                    {otherUsers.length} {otherUsers.length === 1 ? 'user' : 'users'} online
                </span>
            </button>

            {/* Dropdown */}
            {showDropdown && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                        <div className="p-3 border-b border-gray-100">
                            <h4 className="text-sm font-semibold text-gray-900">
                                Active Collaborators
                            </h4>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {otherUsers.map((user) => (
                                <div
                                    key={user.user_id}
                                    className="flex items-center gap-3 p-3 hover:bg-gray-50"
                                >
                                    <div
                                        className={clsx(
                                            'h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-medium',
                                            getUserColor(user.user_id)
                                        )}
                                    >
                                        {getInitials(user.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {user.name}
                                        </p>
                                        {user.cursor?.section_id && (
                                            <p className="text-xs text-gray-500">
                                                Editing section #{user.cursor.section_id}
                                            </p>
                                        )}
                                    </div>
                                    <div
                                        className={clsx(
                                            'h-2 w-2 rounded-full',
                                            user.status === 'online'
                                                ? 'bg-green-500'
                                                : user.status === 'away'
                                                ? 'bg-yellow-500'
                                                : 'bg-red-500'
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
