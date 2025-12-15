import { useState, useEffect, useRef, Fragment } from 'react';
import { Dialog, Combobox, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

interface CommandItem {
    id: string;
    name: string;
    description?: string;
    icon?: React.ReactNode;
    action: () => void;
    category: string;
    shortcut?: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    commands: CommandItem[];
}

export default function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter commands by query
    const filteredCommands = query === ''
        ? commands
        : commands.filter((cmd) =>
            cmd.name.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description?.toLowerCase().includes(query.toLowerCase()) ||
            cmd.category.toLowerCase().includes(query.toLowerCase())
        );

    // Group by category
    const grouped = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = [];
        acc[cmd.category].push(cmd);
        return acc;
    }, {} as Record<string, CommandItem[]>);

    const handleSelect = (command: CommandItem | null) => {
        if (command) {
            command.action();
            onClose();
            setQuery('');
        }
    };

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-50"
                onClose={onClose}
                initialFocus={inputRef}
            >
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6 md:p-20">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="mx-auto max-w-xl transform rounded-xl bg-surface shadow-modal overflow-hidden">
                            <Combobox onChange={handleSelect}>
                                {/* Search Input */}
                                <div className="relative">
                                    <MagnifyingGlassIcon className="absolute left-4 top-3.5 h-5 w-5 text-text-muted" />
                                    <Combobox.Input
                                        ref={inputRef}
                                        className="w-full border-0 bg-transparent pl-11 pr-4 py-3 text-text-primary placeholder:text-text-muted focus:ring-0 focus:outline-none"
                                        placeholder="Type a command or search..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                    />
                                </div>

                                {/* Results */}
                                <Combobox.Options
                                    static
                                    className="max-h-80 overflow-y-auto border-t border-border"
                                >
                                    {Object.entries(grouped).length === 0 ? (
                                        <div className="p-4 text-sm text-text-muted text-center">
                                            No commands found
                                        </div>
                                    ) : (
                                        Object.entries(grouped).map(([category, items]) => (
                                            <div key={category}>
                                                <div className="px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider bg-background">
                                                    {category}
                                                </div>
                                                {items.map((cmd) => (
                                                    <Combobox.Option
                                                        key={cmd.id}
                                                        value={cmd}
                                                        className={({ active }) =>
                                                            clsx(
                                                                'flex items-center gap-3 px-4 py-3 cursor-pointer',
                                                                active ? 'bg-primary-light' : ''
                                                            )
                                                        }
                                                    >
                                                        {({ active }) => (
                                                            <>
                                                                {cmd.icon && (
                                                                    <div className={clsx('text-text-muted', active && 'text-primary')}>
                                                                        {cmd.icon}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={clsx(
                                                                        'text-sm font-medium',
                                                                        active ? 'text-primary' : 'text-text-primary'
                                                                    )}>
                                                                        {cmd.name}
                                                                    </p>
                                                                    {cmd.description && (
                                                                        <p className="text-xs text-text-muted truncate">
                                                                            {cmd.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                {cmd.shortcut && (
                                                                    <kbd className="px-2 py-0.5 text-xs font-mono bg-background text-text-muted rounded">
                                                                        {cmd.shortcut}
                                                                    </kbd>
                                                                )}
                                                            </>
                                                        )}
                                                    </Combobox.Option>
                                                ))}
                                            </div>
                                        ))
                                    )}
                                </Combobox.Options>
                            </Combobox>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition.Root>
    );
}

// Hook to use command palette with default commands
export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    // Register Cmd+K shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Default commands
    const defaultCommands: CommandItem[] = [
        {
            id: 'nav-dashboard',
            name: 'Go to Dashboard',
            category: 'Navigation',
            shortcut: '⌘D',
            action: () => navigate('/'),
        },
        {
            id: 'nav-projects',
            name: 'View Projects',
            category: 'Navigation',
            action: () => navigate('/projects'),
        },
        {
            id: 'nav-knowledge',
            name: 'Knowledge Base',
            category: 'Navigation',
            action: () => navigate('/knowledge'),
        },
        {
            id: 'new-project',
            name: 'Create New Project',
            category: 'Actions',
            shortcut: '⌘N',
            action: () => navigate('/projects/new'),
        },
    ];

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((v) => !v),
        defaultCommands,
    };
}
