import { RemoteUser } from '@/hooks/useRealTime';
import { useAuthStore } from '@/store/authStore';
import clsx from 'clsx';

interface ActiveUsersProps {
    users: Record<string, RemoteUser>;
}

export default function ActiveUsers({ users }: ActiveUsersProps) {
    const { user: currentUser } = useAuthStore();

    // Convert to array and filter unique user_ids (handling multiple tabs/SIDs for same user)
    const uniqueUsers = Object.entries(users).reduce((acc, [sid, user]) => {
        if (user.user_id === currentUser?.id) return acc; // Skip self
        if (!acc.find(u => u.user_id === user.user_id)) {
            acc.push(user);
        }
        return acc;
    }, [] as RemoteUser[]);

    if (uniqueUsers.length === 0) return null;

    return (
        <div className="flex -space-x-2 overflow-hidden items-center">
            {uniqueUsers.map((user) => (
                <div
                    key={user.user_id}
                    className="relative group"
                    title={user.name}
                >
                    <div className="h-8 w-8 rounded-full bg-gradient-brand flex items-center justify-center ring-2 ring-white text-xs font-bold text-white shadow-sm hover:scale-110 transition-transform cursor-help">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    {/* Status Dot */}
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                </div>
            ))}
            <span className="ml-3 text-xs text-text-muted font-medium">
                {uniqueUsers.length} {uniqueUsers.length === 1 ? 'other person' : 'others'} viewing
            </span>
        </div>
    );
}
