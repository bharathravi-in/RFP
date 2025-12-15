import { useState, useEffect, useCallback } from 'react';
import { questionsApi } from '@/api/client';
import { Question } from '@/types';

interface UseQuestionsReturn {
    questions: Question[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    updateQuestion: (id: number, data: Partial<Question>) => Promise<Question>;
    mergeQuestions: (ids: number[], mergedText: string) => Promise<Question>;
    splitQuestion: (id: number, texts: string[]) => Promise<Question[]>;
}

export function useQuestions(projectId: number | undefined): UseQuestionsReturn {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQuestions = useCallback(async () => {
        if (!projectId) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await questionsApi.list(projectId);
            setQuestions(response.data.questions || []);
        } catch (err) {
            setError('Failed to load questions');
            console.error('Failed to fetch questions:', err);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    const updateQuestion = async (id: number, data: Partial<Question>): Promise<Question> => {
        const response = await questionsApi.update(id, data);
        const updated = response.data.question;
        setQuestions((prev) =>
            prev.map((q) => (q.id === id ? updated : q))
        );
        return updated;
    };

    const mergeQuestions = async (ids: number[], mergedText: string): Promise<Question> => {
        const response = await questionsApi.merge(ids, mergedText);
        const merged = response.data.question;
        // Remove old questions and add merged one
        setQuestions((prev) => [
            merged,
            ...prev.filter((q) => !ids.includes(q.id)),
        ]);
        return merged;
    };

    const splitQuestion = async (id: number, texts: string[]): Promise<Question[]> => {
        const response = await questionsApi.split(id, texts);
        const newQuestions = response.data.questions;
        // Remove old question and add split ones
        setQuestions((prev) => [
            ...newQuestions,
            ...prev.filter((q) => q.id !== id),
        ]);
        return newQuestions;
    };

    return {
        questions,
        isLoading,
        error,
        refresh: fetchQuestions,
        updateQuestion,
        mergeQuestions,
        splitQuestion,
    };
}

// Hook for filtering and grouped questions
export function useFilteredQuestions(
    questions: Question[],
    filters: {
        status?: string;
        section?: string;
        search?: string;
    }
) {
    const filtered = questions.filter((q) => {
        if (filters.status && filters.status !== 'all' && q.status !== filters.status) {
            return false;
        }
        if (filters.section && q.section !== filters.section) {
            return false;
        }
        if (filters.search && !q.text.toLowerCase().includes(filters.search.toLowerCase())) {
            return false;
        }
        return true;
    });

    // Group by section
    const grouped = filtered.reduce((acc, question) => {
        const section = question.section || 'Unsorted';
        if (!acc[section]) {
            acc[section] = [];
        }
        acc[section].push(question);
        return acc;
    }, {} as Record<string, Question[]>);

    // Stats
    const stats = {
        total: questions.length,
        pending: questions.filter((q) => q.status === 'pending').length,
        answered: questions.filter((q) => q.status === 'answered').length,
        approved: questions.filter((q) => q.status === 'approved').length,
        rejected: questions.filter((q) => q.status === 'rejected').length,
    };

    return {
        filtered,
        grouped,
        stats,
    };
}
