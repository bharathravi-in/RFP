import { useState } from 'react';
import { Question } from '@/types';
import clsx from 'clsx';
import {
    SparklesIcon,
    ArrowPathIcon,
    PencilIcon,
    TrashIcon,
    CheckIcon,
    PlusIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { answersApi } from '@/api/client';
import toast from 'react-hot-toast';

interface QuestionsTableViewProps {
    questions: Question[];
    projectId: number;
    onQuestionClick: (question: Question) => void;
    onQuestionUpdate: (questionId: number, updates: Partial<Question>) => void;
    onQuestionDelete: (questionId: number) => void;
    onCreateQuestion: (text: string) => void;
}

export default function QuestionsTableView({
    questions,
    projectId,
    onQuestionClick,
    onQuestionUpdate,
    onQuestionDelete,
    onCreateQuestion,
}: QuestionsTableViewProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [generatingIds, setGeneratingIds] = useState<Set<number>>(new Set());
    const [newQuestionText, setNewQuestionText] = useState('');
    const [isAddingRow, setIsAddingRow] = useState(false);

    const toggleSelect = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === questions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(questions.map(q => q.id)));
        }
    };

    const handleGenerateAnswer = async (question: Question, silent = false) => {
        setGeneratingIds(prev => new Set(prev).add(question.id));
        try {
            const response = await answersApi.generate(question.id);
            onQuestionUpdate(question.id, {
                answer: response.data.answer,
                status: 'answered',
            });
            if (!silent) {
                toast.success('Answer generated!');
            }
            return true;
        } catch (error) {
            if (!silent) {
                toast.error('Failed to generate answer');
            }
            return false;
        } finally {
            setGeneratingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(question.id);
                return newSet;
            });
        }
    };

    const [isBatchGenerating, setIsBatchGenerating] = useState(false);

    const handleGenerateSelected = async () => {
        const toGenerate = questions.filter(q => selectedIds.has(q.id) && !q.answer);
        if (toGenerate.length === 0) return;

        setIsBatchGenerating(true);
        let successCount = 0;
        let failCount = 0;

        for (const question of toGenerate) {
            const success = await handleGenerateAnswer(question, true); // silent mode
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        setIsBatchGenerating(false);
        setSelectedIds(new Set());

        // Show single summary toast
        if (failCount === 0) {
            toast.success(`Generated ${successCount} answer${successCount > 1 ? 's' : ''}!`);
        } else {
            toast.error(`Generated ${successCount}, failed ${failCount}`);
        }
    };

    const handleAddRow = () => {
        if (newQuestionText.trim()) {
            onCreateQuestion(newQuestionText.trim());
            setNewQuestionText('');
            setIsAddingRow(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsAddingRow(true)}
                        className="btn-secondary text-sm flex items-center gap-1.5"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add Row
                    </button>
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleGenerateSelected}
                            disabled={isBatchGenerating}
                            className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {isBatchGenerating ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <SparklesIcon className="h-4 w-4" />
                            )}
                            {isBatchGenerating ? 'Generating...' : `Generate Selected (${selectedIds.size})`}
                        </button>
                    )}
                </div>
                <div className="text-sm text-gray-500">
                    {questions.length} questions • {questions.filter(q => q.answer).length} answered
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="w-10 px-3 py-3 border-b border-gray-200">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === questions.length && questions.length > 0}
                                    onChange={toggleSelectAll}
                                    className="rounded text-primary"
                                />
                            </th>
                            <th className="w-10 px-3 py-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">
                                #
                            </th>
                            <th className="px-4 py-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase min-w-[300px]">
                                Question
                            </th>
                            <th className="px-4 py-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase min-w-[350px]">
                                Answer
                            </th>
                            <th className="w-20 px-3 py-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">
                                Status
                            </th>
                            <th className="w-24 px-3 py-3 border-b border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {questions.map((question, index) => (
                            <tr
                                key={question.id}
                                className={clsx(
                                    'border-b border-gray-100 hover:bg-blue-50/50 transition-colors',
                                    selectedIds.has(question.id) && 'bg-blue-50'
                                )}
                            >
                                <td className="px-3 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(question.id)}
                                        onChange={() => toggleSelect(question.id)}
                                        className="rounded text-primary"
                                    />
                                </td>
                                <td className="px-3 py-3 text-gray-400 text-sm">
                                    {index + 1}
                                </td>
                                <td className="px-4 py-3">
                                    <p
                                        onClick={() => onQuestionClick(question)}
                                        className="text-gray-800 text-sm leading-relaxed cursor-pointer hover:text-primary"
                                    >
                                        {question.text}
                                    </p>
                                    {question.section && (
                                        <span className="text-xs text-gray-400 mt-1 block">
                                            Section: {question.section}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {question.answer ? (
                                        <p className="text-gray-600 text-sm line-clamp-3">
                                            {question.answer.content}
                                        </p>
                                    ) : (
                                        <span className="text-gray-400 text-sm italic">
                                            No answer yet
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-3">
                                    <span className={clsx(
                                        'px-2 py-1 rounded-full text-xs font-medium',
                                        question.status === 'approved' && 'bg-green-100 text-green-700',
                                        question.status === 'answered' && 'bg-blue-100 text-blue-700',
                                        question.status === 'pending' && 'bg-gray-100 text-gray-600',
                                    )}>
                                        {question.status}
                                    </span>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        {!question.answer ? (
                                            <button
                                                onClick={() => handleGenerateAnswer(question)}
                                                disabled={generatingIds.has(question.id)}
                                                className="p-1.5 rounded hover:bg-primary/10 text-primary disabled:opacity-50"
                                                title="Generate Answer"
                                            >
                                                {generatingIds.has(question.id) ? (
                                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <SparklesIcon className="h-4 w-4" />
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => onQuestionClick(question)}
                                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                                                title="Edit Answer"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onQuestionDelete(question.id)}
                                            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                                            title="Delete"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {/* Add row */}
                        {isAddingRow && (
                            <tr className="border-b border-gray-100 bg-green-50/50">
                                <td className="px-3 py-3"></td>
                                <td className="px-3 py-3 text-gray-400 text-sm">
                                    {questions.length + 1}
                                </td>
                                <td className="px-4 py-3" colSpan={3}>
                                    <input
                                        type="text"
                                        value={newQuestionText}
                                        onChange={(e) => setNewQuestionText(e.target.value)}
                                        placeholder="Type your question here..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddRow();
                                            if (e.key === 'Escape') {
                                                setIsAddingRow(false);
                                                setNewQuestionText('');
                                            }
                                        }}
                                    />
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={handleAddRow}
                                            disabled={!newQuestionText.trim()}
                                            className="p-1.5 rounded hover:bg-green-100 text-green-600 disabled:opacity-50"
                                        >
                                            <CheckIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsAddingRow(false);
                                                setNewQuestionText('');
                                            }}
                                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Empty state */}
                {questions.length === 0 && !isAddingRow && (
                    <div className="text-center py-16">
                        <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-700 mb-2">No Questions Yet</h3>
                        <p className="text-gray-500 mb-4">Add questions to track and answer them</p>
                        <button
                            onClick={() => setIsAddingRow(true)}
                            className="btn-primary inline-flex items-center gap-2"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Add First Question
                        </button>
                    </div>
                )}
            </div>

            {/* Footer with Add Row button */}
            {questions.length > 0 && !isAddingRow && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={() => setIsAddingRow(true)}
                        className="text-sm text-gray-500 hover:text-primary flex items-center gap-1.5"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add Row
                    </button>
                </div>
            )}
        </div>
    );
}
