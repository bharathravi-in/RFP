import { useEffect, useCallback } from 'react';

type KeyCombo = {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
};

type ShortcutHandler = () => void;

interface Shortcut {
    combo: KeyCombo;
    handler: ShortcutHandler;
    description: string;
}

/**
 * Hook for registering keyboard shortcuts.
 * 
 * Usage:
 * ```tsx
 * useKeyboardShortcuts([
 *   { combo: { key: 'k', meta: true }, handler: openSearch, description: 'Open search' },
 *   { combo: { key: 's', ctrl: true }, handler: save, description: 'Save' },
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Don't trigger shortcuts when typing in inputs
        if (
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            (event.target as HTMLElement)?.isContentEditable
        ) {
            // Allow Escape and specific combos
            if (event.key !== 'Escape' && !event.metaKey && !event.ctrlKey) {
                return;
            }
        }

        for (const shortcut of shortcuts) {
            const { combo, handler } = shortcut;

            const keyMatch = event.key.toLowerCase() === combo.key.toLowerCase();
            const ctrlMatch = combo.ctrl ? event.ctrlKey : !event.ctrlKey;
            const metaMatch = combo.meta ? event.metaKey : !event.metaKey;
            const shiftMatch = combo.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = combo.alt ? event.altKey : !event.altKey;

            // On Mac, treat Ctrl+Key as Cmd+Key for convenience
            const isMac = navigator.platform.includes('Mac');
            const cmdEquivalent = combo.meta && isMac ? event.metaKey : (combo.meta ? event.ctrlKey : true);

            if (keyMatch && (ctrlMatch || cmdEquivalent) && shiftMatch && altMatch) {
                event.preventDefault();
                handler();
                return;
            }
        }
    }, [shortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

// Common shortcut presets
export const SHORTCUT_LABELS = {
    save: '⌘S',
    search: '⌘K',
    escape: 'Esc',
    generate: '⌘⏎',
    approve: '⌘⇧A',
    reject: '⌘⇧R',
    next: '⌘↓',
    prev: '⌘↑',
};

// Display helper for shortcut hints
export function ShortcutHint({ label }: { label: keyof typeof SHORTCUT_LABELS }) {
    return (
        <kbd className= "hidden sm:inline-block px-1.5 py-0.5 text-xs font-mono bg-gray-100 text-gray-500 rounded" >
        { SHORTCUT_LABELS[label]}
        </kbd>
    );
}
