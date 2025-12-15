/**
 * Optimistic update utilities for better UX.
 * 
 * Pattern: Update UI immediately, sync with server in background,
 * rollback on error.
 */

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface OptimisticState<T> {
    data: T;
    pending: boolean;
    error: string | null;
}

/**
 * Hook for managing optimistic updates.
 * 
 * Usage:
 * ```tsx
 * const { data, update, pending } = useOptimistic(initialData, async (newData) => {
 *   await api.save(newData);
 * });
 * ```
 */
export function useOptimistic<T>(
    initialData: T,
    onUpdate: (newData: T) => Promise<void>
) {
    const [state, setState] = useState<OptimisticState<T>>({
        data: initialData,
        pending: false,
        error: null,
    });

    const update = useCallback(
        async (newData: T) => {
            const previousData = state.data;

            // Optimistically update
            setState({
                data: newData,
                pending: true,
                error: null,
            });

            try {
                await onUpdate(newData);
                setState((s) => ({ ...s, pending: false }));
            } catch (err: any) {
                // Rollback on error
                setState({
                    data: previousData,
                    pending: false,
                    error: err.message || 'Update failed',
                });
                toast.error('Update failed. Please try again.');
            }
        },
        [state.data, onUpdate]
    );

    return {
        data: state.data,
        pending: state.pending,
        error: state.error,
        update,
    };
}

/**
 * Hook for optimistic list mutations.
 */
export function useOptimisticList<T extends { id: string | number }>(
    initialItems: T[],
    handlers: {
        onAdd?: (item: T) => Promise<T>;
        onUpdate?: (item: T) => Promise<T>;
        onDelete?: (id: string | number) => Promise<void>;
    }
) {
    const [items, setItems] = useState(initialItems);
    const [pendingIds, setPendingIds] = useState<Set<string | number>>(new Set());

    const addItem = useCallback(
        async (item: T) => {
            // Optimistically add
            setItems((prev) => [item, ...prev]);
            setPendingIds((prev) => new Set(prev).add(item.id));

            try {
                const savedItem = handlers.onAdd ? await handlers.onAdd(item) : item;
                setItems((prev) =>
                    prev.map((i) => (i.id === item.id ? savedItem : i))
                );
            } catch {
                // Rollback
                setItems((prev) => prev.filter((i) => i.id !== item.id));
                toast.error('Failed to add item');
            } finally {
                setPendingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                });
            }
        },
        [handlers]
    );

    const updateItem = useCallback(
        async (item: T) => {
            const previousItem = items.find((i) => i.id === item.id);
            if (!previousItem) return;

            // Optimistically update
            setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
            setPendingIds((prev) => new Set(prev).add(item.id));

            try {
                const savedItem = handlers.onUpdate
                    ? await handlers.onUpdate(item)
                    : item;
                setItems((prev) =>
                    prev.map((i) => (i.id === item.id ? savedItem : i))
                );
            } catch {
                // Rollback
                setItems((prev) =>
                    prev.map((i) => (i.id === item.id ? previousItem : i))
                );
                toast.error('Failed to update');
            } finally {
                setPendingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                });
            }
        },
        [items, handlers]
    );

    const deleteItem = useCallback(
        async (id: string | number) => {
            const previousItem = items.find((i) => i.id === id);
            if (!previousItem) return;

            // Optimistically remove
            setItems((prev) => prev.filter((i) => i.id !== id));
            setPendingIds((prev) => new Set(prev).add(id));

            try {
                if (handlers.onDelete) {
                    await handlers.onDelete(id);
                }
            } catch {
                // Rollback
                setItems((prev) => [previousItem, ...prev]);
                toast.error('Failed to delete');
            } finally {
                setPendingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        },
        [items, handlers]
    );

    return {
        items,
        pendingIds,
        isPending: (id: string | number) => pendingIds.has(id),
        addItem,
        updateItem,
        deleteItem,
        setItems,
    };
}
