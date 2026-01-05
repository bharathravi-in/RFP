import { useState } from 'react';
import clsx from 'clsx';
import {
    XMarkIcon,
    CheckCircleIcon,
    XCircleIcon,
    SparklesIcon,
    TrashIcon,
    ArrowPathIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';

interface BulkActionBarProps {
    selectedCount: number;
    totalCount: number;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onBulkApprove?: () => void;
    onBulkReject?: () => void;
    onBulkGenerate?: () => void;
    onBulkDelete?: () => void;
    onBulkAssign?: () => void;
    isLoading?: boolean;
    actions?: ('approve' | 'reject' | 'generate' | 'delete' | 'assign')[];
}

export default function BulkActionBar({
    selectedCount,
    totalCount,
    onSelectAll,
    onClearSelection,
    onBulkApprove,
    onBulkReject,
    onBulkGenerate,
    onBulkDelete,
    onBulkAssign,
    isLoading = false,
    actions = ['approve', 'reject', 'generate'],
}: BulkActionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700">
                {/* Selection Count */}
                <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
                    <span className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-primary flex items-center justify-center text-xs sm:text-sm font-bold">
                        {selectedCount}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-300 hidden sm:inline">
                        of {totalCount} selected
                    </span>
                </div>

                {/* Select All */}
                <button
                    onClick={onSelectAll}
                    disabled={selectedCount === totalCount}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                    Select All
                </button>

                {/* Divider */}
                <div className="h-5 w-px bg-gray-700" />

                {/* Action Buttons */}
                <div className="flex items-center gap-1 sm:gap-2">
                    {actions.includes('generate') && onBulkGenerate && (
                        <button
                            onClick={onBulkGenerate}
                            disabled={isLoading}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Generate answers for selected"
                        >
                            {isLoading ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <SparklesIcon className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline">Generate</span>
                        </button>
                    )}

                    {actions.includes('approve') && onBulkApprove && (
                        <button
                            onClick={onBulkApprove}
                            disabled={isLoading}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Approve selected"
                        >
                            <CheckCircleIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Approve</span>
                        </button>
                    )}

                    {actions.includes('reject') && onBulkReject && (
                        <button
                            onClick={onBulkReject}
                            disabled={isLoading}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Reject selected"
                        >
                            <XCircleIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Reject</span>
                        </button>
                    )}

                    {actions.includes('assign') && onBulkAssign && (
                        <button
                            onClick={onBulkAssign}
                            disabled={isLoading}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Assign to team member"
                        >
                            <UserGroupIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Assign</span>
                        </button>
                    )}

                    {actions.includes('delete') && onBulkDelete && (
                        <button
                            onClick={onBulkDelete}
                            disabled={isLoading}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete selected"
                        >
                            <TrashIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Delete</span>
                        </button>
                    )}
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-gray-700" />

                {/* Clear Selection */}
                <button
                    onClick={onClearSelection}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    title="Clear selection"
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}
