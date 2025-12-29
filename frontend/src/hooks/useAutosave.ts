import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom hook for autosaving content with debounce.
 * 
 * Features:
 * - Debounced saves to prevent excessive API calls
 * - Dirty state tracking
 * - Error handling with retry
 * - Save status feedback
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutosaveOptions {
    /** Debounce delay in milliseconds (default: 2000) */
    debounceMs?: number;
    /** Function to call when saving */
    onSave: (data: any) => Promise<void>;
    /** Called when save succeeds */
    onSuccess?: () => void;
    /** Called when save fails */
    onError?: (error: Error) => void;
    /** Enable/disable autosave */
    enabled?: boolean;
}

interface AutosaveReturn<T> {
    /** Current data value */
    data: T;
    /** Update data (triggers autosave) */
    setData: (data: T | ((prev: T) => T)) => void;
    /** Current save status */
    status: SaveStatus;
    /** Whether there are unsaved changes */
    isDirty: boolean;
    /** Manually trigger save */
    save: () => Promise<void>;
    /** Reset dirty state without saving */
    reset: () => void;
    /** Last save timestamp */
    lastSaved: Date | null;
}

export function useAutosave<T>(
    initialData: T,
    options: AutosaveOptions
): AutosaveReturn<T> {
    const {
        debounceMs = 2000,
        onSave,
        onSuccess,
        onError,
        enabled = true,
    } = options;

    const [data, setDataInternal] = useState<T>(initialData);
    const [status, setStatus] = useState<SaveStatus>('idle');
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dataRef = useRef<T>(data);
    const isSavingRef = useRef(false);

    // Keep dataRef in sync
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Perform save
    const performSave = useCallback(async () => {
        if (isSavingRef.current || !isDirty) return;

        isSavingRef.current = true;
        setStatus('saving');

        try {
            await onSave(dataRef.current);
            setStatus('saved');
            setIsDirty(false);
            setLastSaved(new Date());
            onSuccess?.();

            // Reset to idle after 2 seconds
            setTimeout(() => {
                setStatus((s) => (s === 'saved' ? 'idle' : s));
            }, 2000);
        } catch (error) {
            setStatus('error');
            onError?.(error as Error);
        } finally {
            isSavingRef.current = false;
        }
    }, [isDirty, onSave, onSuccess, onError]);

    // Set data with autosave trigger
    const setData = useCallback(
        (newData: T | ((prev: T) => T)) => {
            setDataInternal((prev) => {
                const next = typeof newData === 'function'
                    ? (newData as (prev: T) => T)(prev)
                    : newData;
                return next;
            });
            setIsDirty(true);

            if (!enabled) return;

            // Clear existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            // Schedule new save
            saveTimeoutRef.current = setTimeout(() => {
                performSave();
            }, debounceMs);
        },
        [enabled, debounceMs, performSave]
    );

    // Manual save
    const save = useCallback(async () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        await performSave();
    }, [performSave]);

    // Reset without saving
    const reset = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        setIsDirty(false);
        setStatus('idle');
    }, []);

    return {
        data,
        setData,
        status,
        isDirty,
        save,
        reset,
        lastSaved,
    };
}

/**
 * Autosave status indicator component
 */
export function AutosaveIndicator({
    status,
    lastSaved,
    className = ''
}: {
    status: SaveStatus;
    lastSaved: Date | null;
    className?: string;
}) {
    const statusConfig = {
        idle: { text: '', color: '' },
        saving: { text: 'Saving...', color: 'text-yellow-500' },
        saved: { text: 'Saved', color: 'text-green-500' },
        error: { text: 'Save failed', color: 'text-red-500' },
    };

    const config = statusConfig[status];

    if (status === 'idle' && !lastSaved) return null;

    return (
        <div className= {`flex items-center gap-2 text-sm ${className}`
}>
    { status === 'saving' && (
        <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      )}
{
    status === 'saved' && (
        <svg className="w-4 h-4 text-green-500" fill = "none" stroke = "currentColor" viewBox = "0 0 24 24" >
            <path strokeLinecap="round" strokeLinejoin = "round" strokeWidth = { 2} d = "M5 13l4 4L19 7" />
                </svg>
      )
}
{
    status === 'error' && (
        <svg className="w-4 h-4 text-red-500" fill = "none" stroke = "currentColor" viewBox = "0 0 24 24" >
            <path strokeLinecap="round" strokeLinejoin = "round" strokeWidth = { 2} d = "M6 18L18 6M6 6l12 12" />
                </svg>
      )
}
<span className={ config.color }> { config.text } </span>
{
    status === 'idle' && lastSaved && (
        <span className="text-gray-400 text-xs" >
            Last saved { formatTime(lastSaved) }
    </span>
      )
}
</div>
  );
}

function formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString();
}

export default useAutosave;
