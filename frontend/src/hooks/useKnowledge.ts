import { useState, useEffect, useCallback } from 'react';
import { knowledgeApi } from '@/api/client';
import { KnowledgeItem, CreateKnowledgeData } from '@/types';

interface UseKnowledgeReturn {
    items: KnowledgeItem[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    create: (data: CreateKnowledgeData) => Promise<KnowledgeItem>;
    update: (id: number, data: Partial<CreateKnowledgeData>) => Promise<KnowledgeItem>;
    remove: (id: number) => Promise<void>;
    search: (query: string) => Promise<KnowledgeItem[]>;
}

export function useKnowledge(): UseKnowledgeReturn {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await knowledgeApi.list();
            setItems(response.data.items || []);
        } catch (err) {
            setError('Failed to load knowledge base');
            console.error('Failed to fetch knowledge:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const create = async (data: CreateKnowledgeData): Promise<KnowledgeItem> => {
        const response = await knowledgeApi.create(data);
        const newItem = response.data.item;
        setItems((prev) => [newItem, ...prev]);
        return newItem;
    };

    const update = async (id: number, data: Partial<CreateKnowledgeData>): Promise<KnowledgeItem> => {
        const response = await knowledgeApi.update(id, data);
        const updated = response.data.item;
        setItems((prev) =>
            prev.map((item) => (item.id === id ? updated : item))
        );
        return updated;
    };

    const remove = async (id: number): Promise<void> => {
        await knowledgeApi.delete(id);
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const search = async (query: string): Promise<KnowledgeItem[]> => {
        const response = await knowledgeApi.search(query);
        return response.data.items || [];
    };

    return {
        items,
        isLoading,
        error,
        refresh: fetchItems,
        create,
        update,
        remove,
        search,
    };
}

// Hook for filtered/tagged knowledge items
export function useFilteredKnowledge(
    items: KnowledgeItem[],
    filters: {
        tag?: string;
        sourceType?: string;
        search?: string;
    }
) {
    const filtered = items.filter((item) => {
        if (filters.tag && !item.tags.includes(filters.tag)) {
            return false;
        }
        if (filters.sourceType && item.source_type !== filters.sourceType) {
            return false;
        }
        if (filters.search) {
            const query = filters.search.toLowerCase();
            const matchesTitle = item.title.toLowerCase().includes(query);
            const matchesContent = item.content.toLowerCase().includes(query);
            if (!matchesTitle && !matchesContent) {
                return false;
            }
        }
        return true;
    });

    // Get all unique tags
    const allTags = [...new Set(items.flatMap((item) => item.tags))];

    // Stats
    const stats = {
        total: items.length,
        bySource: {
            document: items.filter((i) => i.source_type === 'document').length,
            csv: items.filter((i) => i.source_type === 'csv').length,
            manual: items.filter((i) => i.source_type === 'manual').length,
        },
        tagCount: allTags.length,
    };

    return {
        filtered,
        allTags,
        stats,
    };
}
