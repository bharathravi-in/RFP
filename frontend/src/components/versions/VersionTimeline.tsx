import React, { useState } from 'react';
import clsx from 'clsx';
import { ProposalVersion } from '@/types';
import {
    DocumentTextIcon,
    ArrowPathIcon,
    ArrowDownTrayIcon,
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface VersionTimelineProps {
    versions: ProposalVersion[];
    selectedVersion: ProposalVersion | null;
    onSelect: (version: ProposalVersion) => void;
    onRestore?: (version: ProposalVersion) => void;
    onBranch?: (version: ProposalVersion) => void;
    onDownload?: (version: ProposalVersion) => void;
    onDelete?: (version: ProposalVersion) => void;
    onTag?: (version: ProposalVersion, tag: string) => void;
}

type VersionTag = 'draft' | 'review' | 'final' | 'archived' | null;

const TAG_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
    review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Review' },
    final: { bg: 'bg-green-100', text: 'text-green-700', label: 'Final' },
    archived: { bg: 'bg-red-100', text: 'text-red-600', label: 'Archived' },
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        year: date.getFullYear(),
    };
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const VersionTimeline: React.FC<VersionTimelineProps> = ({
    versions,
    selectedVersion,
    onSelect,
    onRestore,
    onBranch,
    onDownload,
    onDelete,
}) => {
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    if (versions.length === 0) {
        return (
            <div className="text-center py-12">
                <DocumentTextIcon className="h-12 w-12 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary text-sm">No versions saved yet</p>
                <p className="text-text-muted text-xs mt-1">
                    Click "Save New Version" to create a snapshot
                </p>
            </div>
        );
    }

    // Group versions by year
    const versionsByYear = versions.reduce((acc, version) => {
        const year = new Date(version.created_at).getFullYear();
        if (!acc[year]) acc[year] = [];
        acc[year].push(version);
        return acc;
    }, {} as Record<number, ProposalVersion[]>);

    const years = Object.keys(versionsByYear).map(Number).sort((a, b) => b - a);

    return (
        <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent"></div>

            {years.map((year) => (
                <div key={year} className="mb-6">
                    {/* Year Label */}
                    <div className="flex items-center gap-3 mb-4 pl-2">
                        <div className="w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center z-10">
                            {String(year).slice(2)}
                        </div>
                        <span className="text-sm font-semibold text-text-secondary">{year}</span>
                    </div>

                    {/* Versions in this year */}
                    <div className="space-y-3 ml-12">
                        {versionsByYear[year].map((version, index) => {
                            const dateInfo = formatDate(version.created_at);
                            const isSelected = selectedVersion?.id === version.id;
                            const isHovered = hoveredId === version.id;
                            const isLatest = index === 0 && year === years[0];

                            // Get tag from description (simple parsing - could be enhanced)
                            const tag: VersionTag = version.description?.toLowerCase().includes('[final]') ? 'final' :
                                version.description?.toLowerCase().includes('[review]') ? 'review' :
                                    version.description?.toLowerCase().includes('[draft]') ? 'draft' :
                                        version.description?.toLowerCase().includes('[archived]') ? 'archived' : null;

                            return (
                                <div
                                    key={version.id}
                                    className="relative"
                                    onMouseEnter={() => setHoveredId(version.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                >
                                    {/* Timeline Node */}
                                    <div
                                        className={clsx(
                                            'absolute -left-9 w-4 h-4 rounded-full border-2 transition-all',
                                            isSelected
                                                ? 'bg-primary border-primary scale-125'
                                                : isLatest
                                                    ? 'bg-green-500 border-green-500'
                                                    : 'bg-white border-gray-300'
                                        )}
                                        style={{ top: '12px' }}
                                    ></div>

                                    {/* Version Card */}
                                    <div
                                        onClick={() => onSelect(version)}
                                        className={clsx(
                                            'p-4 rounded-lg cursor-pointer transition-all border',
                                            isSelected
                                                ? 'bg-primary-light border-primary shadow-md'
                                                : 'bg-white border-border hover:border-primary/50 hover:shadow-sm'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                {/* Header */}
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className={clsx(
                                                        'px-2 py-0.5 text-xs font-bold rounded-full',
                                                        isLatest ? 'bg-green-500 text-white' : 'bg-primary text-white'
                                                    )}>
                                                        v{version.version_number}
                                                    </span>
                                                    {isLatest && (
                                                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                            <CheckCircleIcon className="h-3 w-3" />
                                                            Latest
                                                        </span>
                                                    )}
                                                    {tag && (
                                                        <span className={clsx(
                                                            'text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1',
                                                            TAG_CONFIG[tag].bg,
                                                            TAG_CONFIG[tag].text
                                                        )}>
                                                            <TagIcon className="h-3 w-3" />
                                                            {TAG_CONFIG[tag].label}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Title */}
                                                <h3 className="font-medium text-text-primary text-sm mb-1">
                                                    {version.title}
                                                </h3>

                                                {/* Description */}
                                                {version.description && (
                                                    <p className="text-xs text-text-muted line-clamp-2 mb-2">
                                                        {version.description.replace(/\[(draft|review|final|archived)\]/gi, '').trim()}
                                                    </p>
                                                )}

                                                {/* Metadata */}
                                                <div className="flex items-center gap-3 text-xs text-text-muted">
                                                    <span>{dateInfo.date} at {dateInfo.time}</span>
                                                    <span>•</span>
                                                    <span>{formatFileSize(version.file_size)}</span>
                                                    {version.creator_name && (
                                                        <>
                                                            <span>•</span>
                                                            <span>by {version.creator_name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons (visible on hover/select) */}
                                        {(isHovered || isSelected) && (
                                            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                                                {version.can_restore && onRestore && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRestore(version);
                                                        }}
                                                        className="flex-1 px-2 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <ArrowPathIcon className="h-3.5 w-3.5" />
                                                        Restore
                                                    </button>
                                                )}
                                                {version.can_restore && onBranch && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onBranch(version);
                                                        }}
                                                        className="flex-1 px-2 py-1.5 text-xs font-medium text-primary bg-primary-light rounded hover:bg-primary/20 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <PencilSquareIcon className="h-3.5 w-3.5" />
                                                        Edit as Draft
                                                    </button>
                                                )}
                                                {onDownload && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDownload(version);
                                                        }}
                                                        className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-light rounded transition-colors"
                                                        title="Download"
                                                    >
                                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDelete(version);
                                                        }}
                                                        className="p-1.5 text-text-muted hover:text-error hover:bg-error-light rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default VersionTimeline;
