import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowsRightLeftIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { versionsApi } from '@/api/client';
import { ProposalVersion, SectionDiff, VersionComparisonStats } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface VersionComparisonProps {
    isOpen: boolean;
    onClose: () => void;
    versionA: ProposalVersion;
    versionB: ProposalVersion;
}

export default function VersionComparison({
    isOpen,
    onClose,
    versionA,
    versionB
}: VersionComparisonProps) {
    const [loading, setLoading] = useState(false);
    const [sectionDiffs, setSectionDiffs] = useState<SectionDiff[]>([]);
    const [stats, setStats] = useState<VersionComparisonStats | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [showUnchanged, setShowUnchanged] = useState(false);

    useEffect(() => {
        if (isOpen && versionA && versionB) {
            loadComparison();
        }
    }, [isOpen, versionA?.id, versionB?.id]);

    const loadComparison = async () => {
        setLoading(true);
        try {
            const response = await versionsApi.compare(versionA.id, versionB.id);
            setSectionDiffs(response.data.section_diffs || []);
            setStats(response.data.stats || null);

            // Auto-expand modified sections
            const modified = (response.data.section_diffs || [])
                .filter((d: SectionDiff) => d.status === 'modified')
                .map((d: SectionDiff) => d.title);
            setExpandedSections(new Set(modified));
        } catch (error) {
            console.error('Failed to load comparison:', error);
            toast.error('Failed to compare versions');
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (title: string) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(title)) {
            newSet.delete(title);
        } else {
            newSet.add(title);
        }
        setExpandedSections(newSet);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'added': return 'text-emerald-600 bg-emerald-50';
            case 'removed': return 'text-red-600 bg-red-50';
            case 'modified': return 'text-amber-600 bg-amber-50';
            default: return 'text-gray-500 bg-gray-50';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'added': return 'Added';
            case 'removed': return 'Removed';
            case 'modified': return 'Modified';
            default: return 'Unchanged';
        }
    };

    const filteredDiffs = showUnchanged
        ? sectionDiffs
        : sectionDiffs.filter(d => d.status !== 'unchanged');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-primary to-primary-dark">
                    <div className="flex items-center gap-3 text-white">
                        <ArrowsRightLeftIcon className="h-6 w-6" />
                        <div>
                            <h2 className="text-lg font-semibold">Version Comparison</h2>
                            <p className="text-sm opacity-90">
                                v{versionA.version_number} ({versionA.title})
                                <span className="mx-2">→</span>
                                v{versionB.version_number} ({versionB.title})
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Stats Bar */}
                {stats && (
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-6">
                        <span className="text-sm text-gray-600">
                            <strong>{stats.total_sections}</strong> total sections
                        </span>
                        {stats.added > 0 && (
                            <span className="text-sm text-emerald-600">
                                <span className="font-bold">+{stats.added}</span> added
                            </span>
                        )}
                        {stats.removed > 0 && (
                            <span className="text-sm text-red-600">
                                <span className="font-bold">-{stats.removed}</span> removed
                            </span>
                        )}
                        {stats.modified > 0 && (
                            <span className="text-sm text-amber-600">
                                <span className="font-bold">{stats.modified}</span> modified
                            </span>
                        )}
                        {stats.unchanged > 0 && (
                            <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showUnchanged}
                                    onChange={(e) => setShowUnchanged(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                Show unchanged ({stats.unchanged})
                            </label>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredDiffs.length === 0 ? (
                        <div className="text-center py-16">
                            <ArrowsRightLeftIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No differences found</p>
                            <p className="text-sm text-gray-400 mt-1">
                                The selected versions have identical content
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredDiffs.map((diff) => (
                                <div key={diff.title} className="border-b border-gray-100">
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(diff.title)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        {expandedSections.has(diff.title) ? (
                                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                                        ) : (
                                            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span className="font-medium text-gray-900 flex-1">
                                            {diff.title}
                                        </span>
                                        <span className={clsx(
                                            'text-xs px-2 py-1 rounded-full font-medium',
                                            getStatusColor(diff.status)
                                        )}>
                                            {getStatusLabel(diff.status)}
                                        </span>
                                    </button>

                                    {/* Section Diff Content */}
                                    {expandedSections.has(diff.title) && (
                                        <div className="px-4 pb-4">
                                            {diff.status === 'modified' && diff.diff_lines.length > 0 ? (
                                                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                                                    {diff.diff_lines.map((line, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={clsx(
                                                                'whitespace-pre',
                                                                line.type === 'added' && 'text-emerald-400 bg-emerald-900/30',
                                                                line.type === 'removed' && 'text-red-400 bg-red-900/30',
                                                                line.type === 'context' && 'text-cyan-400',
                                                                line.type === 'unchanged' && 'text-gray-400'
                                                            )}
                                                        >
                                                            {line.type === 'added' && '+ '}
                                                            {line.type === 'removed' && '- '}
                                                            {line.type === 'unchanged' && '  '}
                                                            {line.content}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : diff.status === 'added' ? (
                                                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                                    <p className="text-sm text-emerald-800 whitespace-pre-wrap">
                                                        {diff.content_b || 'No content'}
                                                    </p>
                                                </div>
                                            ) : diff.status === 'removed' ? (
                                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                                    <p className="text-sm text-red-800 whitespace-pre-wrap line-through">
                                                        {diff.content_a || 'No content'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                                        {diff.content_a || diff.content_b || 'No content'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        Click on a section to expand/collapse its diff
                    </p>
                    <button onClick={onClose} className="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
