import { useState, useEffect, useRef, useCallback } from 'react';
import { usersApi } from '@/api/client';
import clsx from 'clsx';

interface User {
    id: number;
    name: string;
    email: string;
}

interface MentionInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: () => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    rows?: number;
}

export default function MentionInput({
    value,
    onChange,
    onSubmit,
    placeholder = 'Type @ to mention someone...',
    className,
    disabled = false,
    rows = 3,
}: MentionInputProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState(-1);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Load users on mount
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await usersApi.list();
            setUsers(response.data.users || []);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    };

    // Filter users based on search term
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);

    // Handle text change
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const position = e.target.selectionStart;
        onChange(newValue);
        setCursorPosition(position);

        // Check if we're in a mention context
        const textBeforeCursor = newValue.slice(0, position);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            // Check if @ is at start or after whitespace
            const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
            if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
                const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
                // Only show suggestions if no space after @
                if (!textAfterAt.includes(' ')) {
                    setSearchTerm(textAfterAt);
                    setMentionStart(lastAtIndex);
                    setShowSuggestions(true);
                    setSelectedIndex(0);
                    return;
                }
            }
        }

        setShowSuggestions(false);
    }, [onChange]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showSuggestions) {
            if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
                e.preventDefault();
                onSubmit();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < filteredUsers.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                if (filteredUsers[selectedIndex]) {
                    insertMention(filteredUsers[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                break;
        }
    }, [showSuggestions, filteredUsers, selectedIndex, onSubmit]);

    // Insert mention into text
    const insertMention = useCallback((user: User) => {
        if (mentionStart === -1) return;

        const beforeMention = value.slice(0, mentionStart);
        const afterMention = value.slice(cursorPosition);
        const mentionText = `@${user.name.replace(/\s+/g, '')} `;

        const newValue = beforeMention + mentionText + afterMention;
        onChange(newValue);

        // Move cursor after mention
        const newPosition = mentionStart + mentionText.length;
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = newPosition;
                textareaRef.current.selectionEnd = newPosition;
                textareaRef.current.focus();
            }
        }, 0);

        setShowSuggestions(false);
    }, [mentionStart, cursorPosition, value, onChange]);

    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={rows}
                className={clsx(
                    'w-full px-3 py-2 border border-border rounded-lg resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                    'placeholder:text-text-muted',
                    disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
                    className
                )}
            />

            {/* Mention Suggestions Dropdown */}
            {showSuggestions && filteredUsers.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-64 mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden"
                >
                    <div className="py-1">
                        {filteredUsers.map((user, index) => (
                            <button
                                key={user.id}
                                onClick={() => insertMention(user)}
                                className={clsx(
                                    'w-full px-3 py-2 text-left flex items-center gap-2 transition-colors',
                                    index === selectedIndex
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-gray-50'
                                )}
                            >
                                <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary font-medium text-sm">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{user.name}</p>
                                    <p className="text-xs text-text-muted truncate">{user.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Helper text */}
            <p className="mt-1 text-xs text-text-muted">
                Type @ to mention team members
            </p>
        </div>
    );
}
