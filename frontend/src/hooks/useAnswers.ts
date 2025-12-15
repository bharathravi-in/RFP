import { useState, useCallback } from 'react';
import { answersApi } from '@/api/client';
import { Answer, Question } from '@/types';
import toast from 'react-hot-toast';

interface UseAnswerReturn {
    answer: Answer | null;
    isLoading: boolean;
    isGenerating: boolean;
    generate: () => Promise<Answer | null>;
    regenerate: (action: 'shorten' | 'expand' | 'improve_tone') => Promise<Answer | null>;
    updateContent: (content: string) => Promise<Answer | null>;
    review: (action: 'approve' | 'reject', reason?: string) => Promise<Answer | null>;
    addComment: (text: string, position?: number) => Promise<void>;
}

export function useAnswer(question: Question | null): UseAnswerReturn {
    const [answer, setAnswer] = useState<Answer | null>(question?.answer || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Sync answer when question changes
    if (question?.answer && answer?.id !== question.answer.id) {
        setAnswer(question.answer);
    }

    const generate = useCallback(async (): Promise<Answer | null> => {
        if (!question) return null;

        setIsGenerating(true);

        try {
            const response = await answersApi.generate(question.id);
            const newAnswer = response.data.answer;
            setAnswer(newAnswer);
            toast.success('Answer generated');
            return newAnswer;
        } catch (err) {
            toast.error('Failed to generate answer');
            console.error('Generation failed:', err);
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, [question]);

    const regenerate = useCallback(async (
        action: 'shorten' | 'expand' | 'improve_tone'
    ): Promise<Answer | null> => {
        if (!question) return null;

        setIsGenerating(true);

        try {
            const response = await answersApi.regenerate(question.id, action);
            const newAnswer = response.data.answer;
            setAnswer(newAnswer);

            const actionLabel = {
                shorten: 'shortened',
                expand: 'expanded',
                improve_tone: 'improved',
            }[action];

            toast.success(`Answer ${actionLabel}`);
            return newAnswer;
        } catch (err) {
            toast.error('Failed to regenerate answer');
            console.error('Regeneration failed:', err);
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, [question]);

    const updateContent = useCallback(async (content: string): Promise<Answer | null> => {
        if (!answer) return null;

        setIsLoading(true);

        try {
            const response = await answersApi.update(answer.id, content);
            const updatedAnswer = response.data.answer;
            setAnswer(updatedAnswer);
            return updatedAnswer;
        } catch (err) {
            toast.error('Failed to save changes');
            console.error('Update failed:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [answer]);

    const review = useCallback(async (
        action: 'approve' | 'reject',
        reason?: string
    ): Promise<Answer | null> => {
        if (!answer) return null;

        setIsLoading(true);

        try {
            const response = await answersApi.review(answer.id, action, reason);
            const updatedAnswer = response.data.answer;
            setAnswer(updatedAnswer);
            toast.success(action === 'approve' ? 'Answer approved!' : 'Answer rejected');
            return updatedAnswer;
        } catch (err) {
            toast.error(`Failed to ${action} answer`);
            console.error('Review failed:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [answer]);

    const addComment = useCallback(async (text: string, position?: number): Promise<void> => {
        if (!answer) return;

        try {
            await answersApi.addComment(answer.id, text, position);
            toast.success('Comment added');
        } catch (err) {
            toast.error('Failed to add comment');
            console.error('Add comment failed:', err);
        }
    }, [answer]);

    return {
        answer,
        isLoading,
        isGenerating,
        generate,
        regenerate,
        updateContent,
        review,
        addComment,
    };
}

// Batch operations hook
export function useAnswerBatch() {
    const [isLoading, setIsLoading] = useState(false);

    const generateBatch = async (questionIds: number[]): Promise<number> => {
        setIsLoading(true);
        let successCount = 0;

        try {
            for (const id of questionIds) {
                try {
                    await answersApi.generate(id);
                    successCount++;
                } catch {
                    // Continue with others
                }
            }

            toast.success(`Generated ${successCount}/${questionIds.length} answers`);
            return successCount;
        } finally {
            setIsLoading(false);
        }
    };

    const approveBatch = async (answerIds: number[]): Promise<number> => {
        setIsLoading(true);
        let successCount = 0;

        try {
            for (const id of answerIds) {
                try {
                    await answersApi.review(id, 'approve');
                    successCount++;
                } catch {
                    // Continue with others
                }
            }

            toast.success(`Approved ${successCount}/${answerIds.length} answers`);
            return successCount;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        generateBatch,
        approveBatch,
    };
}
