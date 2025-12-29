import { useCallback, useEffect, useRef } from 'react';

type KeyboardShortcut = {
    /** Key combination (e.g., 'ctrl+s', 'cmd+shift+p') */
    keys: string;
    /** Handler function */
    handler: (e: KeyboardEvent) => void;
    /** Description for help display */
    description?: string;
    /** Only trigger when no input is focused */
    ignoreInputs?: boolean;
    /** Prevent default browser behavior */
    preventDefault?: boolean;
};

/**
 * Global keyboard shortcut registry
 */
const shortcutRegistry: Map<string, { description: string; keys: string }[]> = new Map();

/**
 * Parse key combination string
 */
function parseKeys(keys: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } {
    const parts = keys.toLowerCase().split('+');
    const modifiers = {
        ctrl: parts.includes('ctrl') || parts.includes('control'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt') || parts.includes('option'),
        meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
    };

    // Find the main key (not a modifier)
    const key = parts.find(p => !['ctrl', 'control', 'shift', 'alt', 'option', 'meta', 'cmd', 'command'].includes(p)) || '';

    return { key, ...modifiers };
}

/**
 * Check if key event matches the shortcut
 */
function matchesShortcut(e: KeyboardEvent, parsed: ReturnType<typeof parseKeys>): boolean {
    const eventKey = e.key.toLowerCase();
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    // Handle cmd on Mac as meta
    const ctrlOrMeta = isMac ? e.metaKey : e.ctrlKey;

    // Check modifiers
    if (parsed.ctrl && !ctrlOrMeta) return false;
    if (parsed.shift && !e.shiftKey) return false;
    if (parsed.alt && !e.altKey) return false;
    if (parsed.meta && !e.metaKey) return false;

    // Check main key
    return eventKey === parsed.key;
}

/**
 * Check if an input element is focused
 */
function isInputFocused(): boolean {
    const active = document.activeElement;
    if (!active) return false;

    return (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.getAttribute('contenteditable') === 'true'
    );
}

/**
 * Custom hook for keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], deps: any[] = []) {
    const shortcutsRef = useRef(shortcuts);

    useEffect(() => {
        shortcutsRef.current = shortcuts;
    }, [shortcuts]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            for (const shortcut of shortcutsRef.current) {
                // Skip if ignoring inputs and an input is focused
                if (shortcut.ignoreInputs !== false && isInputFocused()) {
                    continue;
                }

                const parsed = parseKeys(shortcut.keys);

                if (matchesShortcut(e, parsed)) {
                    if (shortcut.preventDefault !== false) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    shortcut.handler(e);
                    return;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

/**
 * Register shortcuts for help display
 */
export function registerShortcuts(category: string, shortcuts: { keys: string; description: string }[]) {
    shortcutRegistry.set(category, shortcuts);
}

/**
 * Get all registered shortcuts
 */
export function getRegisteredShortcuts(): Map<string, { keys: string; description: string }[]> {
    return shortcutRegistry;
}

/**
 * Common application shortcuts
 */
export const APP_SHORTCUTS = {
    SAVE: 'ctrl+s',
    SEARCH: 'ctrl+k',
    NEW_PROJECT: 'ctrl+n',
    CLOSE: 'escape',
    HELP: 'ctrl+/',
    UNDO: 'ctrl+z',
    REDO: 'ctrl+shift+z',
};

/**
 * Keyboard shortcuts help modal component
 */
export function KeyboardShortcutsHelp({
    isOpen,
    onClose
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    // Close on escape
    useKeyboardShortcuts([
        { keys: 'escape', handler: onClose }
    ], [onClose]);

    if (!isOpen) return null;

    const allShortcuts = getRegisteredShortcuts();

    return (
        <div className= "fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick = { onClose } >
            <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-auto"
    onClick = { e => e.stopPropagation() }
        >
        <div className="flex justify-between items-center mb-6" >
            <h2 className="text-xl font-semibold" > Keyboard Shortcuts </h2>
                < button onClick = { onClose } className = "text-gray-500 hover:text-gray-700" >
                    <svg className="w-6 h-6" fill = "none" stroke = "currentColor" viewBox = "0 0 24 24" >
                        <path strokeLinecap="round" strokeLinejoin = "round" strokeWidth = { 2} d = "M6 18L18 6M6 6l12 12" />
                            </svg>
                            </button>
                            </div>

    {/* Default shortcuts */ }
    <div className="space-y-6" >
        <div>
        <h3 className="text-sm font-medium text-gray-500 mb-3" > General </h3>
            < div className = "space-y-2" >
                <ShortcutRow keys="Ctrl+S" description = "Save current work" />
                    <ShortcutRow keys="Ctrl+K" description = "Open search" />
                        <ShortcutRow keys="Ctrl+N" description = "New project" />
                            <ShortcutRow keys="Ctrl+/" description = "Show this help" />
                                <ShortcutRow keys="Escape" description = "Close modal/cancel" />
                                    </div>
                                    </div>

                                    < div >
                                    <h3 className="text-sm font-medium text-gray-500 mb-3" > Editor </h3>
                                        < div className = "space-y-2" >
                                            <ShortcutRow keys="Ctrl+Z" description = "Undo" />
                                                <ShortcutRow keys="Ctrl+Shift+Z" description = "Redo" />
                                                    <ShortcutRow keys="Ctrl+B" description = "Bold text" />
                                                        <ShortcutRow keys="Ctrl+I" description = "Italic text" />
                                                            </div>
                                                            </div>

    {/* Dynamic shortcuts from registry */ }
    {
        Array.from(allShortcuts.entries()).map(([category, shortcuts]) => (
            <div key= { category } >
            <h3 className="text-sm font-medium text-gray-500 mb-3" > { category } </h3>
        < div className = "space-y-2" >
        {
            shortcuts.map((s, i) => (
                <ShortcutRow key= { i } keys = { s.keys } description = { s.description } />
                ))
    }
    </div>
        </div>
          ))
}
</div>

    < p className = "text-xs text-gray-400 mt-6" >
        Tip: On Mac, use ⌘ (Cmd) instead of Ctrl
            </p>
            </div>
            </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
    const formattedKeys = keys.split('+').map(k => (
        <kbd 
      key= { k }
      className = "px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono"
        >
        { k }
        </kbd>
    ));

    return (
        <div className= "flex justify-between items-center" >
        <span className="text-sm text-gray-600 dark:text-gray-300" > { description } </span>
            < div className = "flex gap-1" > { formattedKeys } </div>
                </div>
  );
}

export default useKeyboardShortcuts;
