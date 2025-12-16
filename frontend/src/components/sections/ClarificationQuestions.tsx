import { useState } from 'react';
import { sectionsApi } from '@/api/client';
import { RFPSection } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
    QuestionMarkCircleIcon,
    PlusIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ExclamationTriangleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

interface ClarificationQuestion {
    id: string;
    question: string;
    category: 'gap' | 'clarification' | 'assumption';
    priority: 'high' | 'medium' | 'low';
    resolved: boolean;
    answer?: string;
}

interface ClarificationQuestionsProps {
    section: RFPSection;
    projectId: number;
    onUpdate: (section: RFPSection) => void;
}

export default function ClarificationQuestions({ section, projectId, onUpdate }: ClarificationQuestionsProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newCategory, setNewCategory] = useState<'gap' | 'clarification' | 'assumption'>('clarification');
    const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [isSaving, setIsSaving] = useState(false);

    // Get clarification questions from section's flags or a dedicated field
    const clarifications: ClarificationQuestion[] = section.flags?.filter(
        (f: any) => f.type === 'clarification_question'
    ).map((f: any) => ({
        id: f.id || Math.random().toString(36).substr(2, 9),
        question: f.question || f.text || '',
        category: f.category || 'clarification',
        priority: f.priority || 'medium',
        resolved: f.resolved || false,
        answer: f.answer || '',
    })) || [];

    const handleAddQuestion = async () => {
        if (!newQuestion.trim()) {
            toast.error('Please enter a question');
            return;
        }

        setIsSaving(true);
        try {
            const newClarification: ClarificationQuestion = {
                id: Math.random().toString(36).substr(2, 9),
                question: newQuestion,
                category: newCategory,
                priority: newPriority,
                resolved: false,
            };

            // Add to section flags
            const updatedFlags = [
                ...(section.flags || []),
                {
                    type: 'clarification_question',
                    id: newClarification.id,
                    question: newClarification.question,
                    category: newClarification.category,
                    priority: newClarification.priority,
                    resolved: false,
                }
            ];

            const response = await sectionsApi.updateSection(projectId, section.id, {
                flags: updatedFlags,
            });

            onUpdate(response.data.section);
            setNewQuestion('');
            setShowAddForm(false);
            toast.success('Question added');
        } catch {
            toast.error('Failed to add question');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveQuestion = async (questionId: string) => {
        try {
            const updatedFlags = (section.flags || []).filter(
                (f: any) => !(f.type === 'clarification_question' && f.id === questionId)
            );

            const response = await sectionsApi.updateSection(projectId, section.id, {
                flags: updatedFlags,
            });

            onUpdate(response.data.section);
            toast.success('Question removed');
        } catch {
            toast.error('Failed to remove question');
        }
    };

    const handleToggleResolved = async (questionId: string) => {
        try {
            const updatedFlags = (section.flags || []).map((f: any) => {
                if (f.type === 'clarification_question' && f.id === questionId) {
                    return { ...f, resolved: !f.resolved };
                }
                return f;
            });

            const response = await sectionsApi.updateSection(projectId, section.id, {
                flags: updatedFlags,
            });

            onUpdate(response.data.section);
        } catch {
            toast.error('Failed to update question');
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'gap':
                return 'bg-red-100 text-red-700';
            case 'assumption':
                return 'bg-yellow-100 text-yellow-700';
            default:
                return 'bg-blue-100 text-blue-700';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'text-red-500';
            case 'low':
                return 'text-gray-400';
            default:
                return 'text-yellow-500';
        }
    };

    const unresolvedCount = clarifications.filter(c => !c.resolved).length;

    return (
        <div className="border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
                <div className="flex items-center gap-2">
                    <QuestionMarkCircleIcon className="h-5 w-5 text-warning" />
                    <span className="font-medium text-text-primary">
                        Questions for RFP Issuer
                    </span>
                    {unresolvedCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-warning-light text-warning text-xs font-medium">
                            {unresolvedCount} pending
                        </span>
                    )}
                </div>
                {isExpanded ? (
                    <ChevronUpIcon className="h-5 w-5 text-text-muted" />
                ) : (
                    <ChevronDownIcon className="h-5 w-5 text-text-muted" />
                )}
            </button>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 space-y-3">
                    {/* Add Question Button / Form */}
                    {showAddForm ? (
                        <div className="p-4 bg-gray-50 rounded-lg border border-border space-y-3">
                            <textarea
                                value={newQuestion}
                                onChange={(e) => setNewQuestion(e.target.value)}
                                placeholder="What would you like to clarify about the RFP?"
                                rows={2}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            />
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-text-secondary">Type:</label>
                                    <select
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value as any)}
                                        className="px-2 py-1 border border-border rounded text-sm bg-surface"
                                    >
                                        <option value="clarification">Clarification</option>
                                        <option value="gap">Gap</option>
                                        <option value="assumption">Assumption</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-text-secondary">Priority:</label>
                                    <select
                                        value={newPriority}
                                        onChange={(e) => setNewPriority(e.target.value as any)}
                                        className="px-2 py-1 border border-border rounded text-sm bg-surface"
                                    >
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setNewQuestion('');
                                    }}
                                    className="btn-secondary text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddQuestion}
                                    disabled={isSaving}
                                    className="btn-primary text-sm"
                                >
                                    {isSaving ? 'Adding...' : 'Add Question'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="w-full py-2 border border-dashed border-border rounded-lg text-text-muted hover:text-primary hover:border-primary flex items-center justify-center gap-2 transition-colors"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Add Question / Gap / Assumption
                        </button>
                    )}

                    {/* Questions List */}
                    {clarifications.length === 0 ? (
                        <p className="text-center text-text-muted py-4 text-sm">
                            No clarification questions yet. Add any gaps or questions you need to ask the RFP issuer.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {clarifications.map((item) => (
                                <div
                                    key={item.id}
                                    className={clsx(
                                        'p-3 rounded-lg border transition-colors',
                                        item.resolved
                                            ? 'bg-gray-50 border-gray-200 opacity-60'
                                            : 'bg-surface border-border'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={item.resolved}
                                            onChange={() => handleToggleResolved(item.id)}
                                            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className={clsx(
                                                'text-text-primary text-sm',
                                                item.resolved && 'line-through'
                                            )}>
                                                {item.question}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={clsx(
                                                    'px-2 py-0.5 rounded text-xs font-medium',
                                                    getCategoryColor(item.category)
                                                )}>
                                                    {item.category}
                                                </span>
                                                <ExclamationTriangleIcon className={clsx(
                                                    'h-4 w-4',
                                                    getPriorityColor(item.priority)
                                                )} />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveQuestion(item.id)}
                                            className="p-1 text-text-muted hover:text-error transition-colors"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary */}
                    {clarifications.length > 0 && (
                        <div className="pt-2 border-t border-border text-xs text-text-muted">
                            {clarifications.filter(c => c.resolved).length} of {clarifications.length} resolved
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
