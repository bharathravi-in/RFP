/**
 * Section Lock Indicator
 * Shows when a section is being edited by another user
 */
import { LockClosedIcon, UserIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { SectionLock } from '@/hooks/useCollaboration';

interface SectionLockIndicatorProps {
    lock: SectionLock | null;
    className?: string;
}

export default function SectionLockIndicator({ lock, className }: SectionLockIndicatorProps) {
    if (!lock) return null;

    return (
        <div
            className={clsx(
                'flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg',
                className
            )}
        >
            <LockClosedIcon className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">
                <span className="font-medium">{lock.user_name}</span> is editing this section
            </span>
        </div>
    );
}

/**
 * Typing Indicator
 * Shows when someone is typing in a section
 */
interface TypingIndicatorProps {
    typingUsers: Array<{ user_name: string }>;
    className?: string;
}

export function TypingIndicator({ typingUsers, className }: TypingIndicatorProps) {
    if (typingUsers.length === 0) return null;

    const names = typingUsers.map((u) => u.user_name);
    let text = '';
    
    if (names.length === 1) {
        text = `${names[0]} is typing...`;
    } else if (names.length === 2) {
        text = `${names[0]} and ${names[1]} are typing...`;
    } else {
        text = `${names.length} people are typing...`;
    }

    return (
        <div
            className={clsx(
                'flex items-center gap-2 px-3 py-1 text-sm text-gray-500',
                className
            )}
        >
            <div className="flex gap-1">
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{text}</span>
        </div>
    );
}

/**
 * Cursor Indicator
 * Shows another user's cursor position
 */
interface CursorIndicatorProps {
    userName: string;
    color: string;
    position?: { x: number; y: number };
}

export function CursorIndicator({ userName, color, position }: CursorIndicatorProps) {
    if (!position) return null;

    return (
        <div
            className="absolute pointer-events-none z-50"
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-2px, -2px)',
            }}
        >
            {/* Cursor arrow */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className={color}
            >
                <path
                    d="M5.5 3.5L18 12L12 13.5L9 20.5L5.5 3.5Z"
                    fill="currentColor"
                    stroke="white"
                    strokeWidth="1.5"
                />
            </svg>
            {/* Name badge */}
            <div
                className={clsx(
                    'absolute left-4 top-4 px-2 py-0.5 rounded text-xs text-white font-medium whitespace-nowrap',
                    color.replace('text-', 'bg-')
                )}
            >
                {userName}
            </div>
        </div>
    );
}

/**
 * Collaborative Editor Wrapper
 * Adds collaboration indicators to any editor
 */
interface CollaborativeEditorWrapperProps {
    children: React.ReactNode;
    lock: SectionLock | null;
    typingUsers: Array<{ user_name: string }>;
    isDisabled?: boolean;
}

export function CollaborativeEditorWrapper({
    children,
    lock,
    typingUsers,
    isDisabled,
}: CollaborativeEditorWrapperProps) {
    return (
        <div className={clsx('relative', isDisabled && 'pointer-events-none opacity-60')}>
            {lock && (
                <div className="absolute inset-0 bg-amber-50/50 z-10 flex items-center justify-center rounded-lg">
                    <SectionLockIndicator lock={lock} />
                </div>
            )}
            {children}
            <TypingIndicator typingUsers={typingUsers} className="mt-2" />
        </div>
    );
}
