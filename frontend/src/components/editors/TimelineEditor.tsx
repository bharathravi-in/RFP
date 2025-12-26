import React, { useState } from 'react';
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, CheckIcon, XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface Milestone {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    status: 'pending' | 'in_progress' | 'completed' | 'delayed';
    dependencies?: string[];
}

interface TimelineEditorProps {
    milestones: Milestone[];
    style: 'gantt' | 'list' | 'vertical';
    onSave: (data: { milestones: Milestone[]; style: string }) => Promise<void>;
    onCancel: () => void;
    isSaving?: boolean;
    color?: string;
    readOnly?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pending' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'In Progress' },
    completed: { bg: 'bg-green-100', text: 'text-green-600', label: 'Completed' },
    delayed: { bg: 'bg-red-100', text: 'text-red-600', label: 'Delayed' },
};

const generateId = () => Math.random().toString(36).substring(2, 11);

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
    milestones: initialMilestones,
    style: initialStyle,
    onSave,
    onCancel,
    isSaving = false,
    color = '#14B8A6',
    readOnly = false,
}) => {
    const [milestones, setMilestones] = useState<Milestone[]>(
        initialMilestones.length > 0
            ? initialMilestones
            : [
                {
                    id: generateId(),
                    title: 'Project Kickoff',
                    description: 'Initial planning and team alignment',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    status: 'pending',
                },
            ]
    );
    const [style, setStyle] = useState<'gantt' | 'list' | 'vertical'>(initialStyle || 'list');
    const [error, setError] = useState<string | null>(null);

    const handleAddMilestone = () => {
        const lastMilestone = milestones[milestones.length - 1];
        const startDate = lastMilestone
            ? new Date(new Date(lastMilestone.endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        const endDate = new Date(new Date(startDate).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        setMilestones([
            ...milestones,
            {
                id: generateId(),
                title: `Phase ${milestones.length + 1}`,
                description: '',
                startDate,
                endDate,
                status: 'pending',
            },
        ]);
    };

    const handleDeleteMilestone = (id: string) => {
        setMilestones(milestones.filter((m) => m.id !== id));
    };

    const handleUpdateMilestone = (id: string, updates: Partial<Milestone>) => {
        setMilestones(milestones.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    };

    const handleMoveMilestone = (id: string, direction: 'up' | 'down') => {
        const index = milestones.findIndex((m) => m.id === id);
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === milestones.length - 1) return;

        const newMilestones = [...milestones];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newMilestones[index], newMilestones[targetIndex]] = [newMilestones[targetIndex], newMilestones[index]];
        setMilestones(newMilestones);
    };

    const handleSaveClick = async () => {
        try {
            setError(null);
            await onSave({ milestones, style });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        }
    };

    // Calculate total project duration
    const projectStart = milestones.length > 0 ? new Date(Math.min(...milestones.map((m) => new Date(m.startDate).getTime()))) : new Date();
    const projectEnd = milestones.length > 0 ? new Date(Math.max(...milestones.map((m) => new Date(m.endDate).getTime()))) : new Date();
    const totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) || 1;

    return (
        <div className="w-full bg-background rounded-lg shadow border border-border h-full flex flex-col">
            {/* Header */}
            <div className="border-b border-border px-6 py-4" style={{ borderLeftWidth: '4px', borderLeftColor: color }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <CalendarDaysIcon className="w-5 h-5" style={{ color }} />
                            Timeline Editor
                        </h2>
                        <p className="text-sm text-text-muted mt-1">
                            Create project milestones and implementation timeline
                        </p>
                    </div>
                    <div className="text-right text-sm text-text-muted">
                        <p>Total Duration: <span className="font-semibold text-text-primary">{totalDays} days</span></p>
                        <p>{milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="border-b border-border px-6 py-3 bg-surface flex items-center gap-3 flex-wrap">
                <button
                    onClick={handleAddMilestone}
                    disabled={readOnly || isSaving}
                    className="btn-secondary text-sm flex items-center gap-2"
                >
                    <PlusIcon className="w-4 h-4" />
                    Add Milestone
                </button>
                <div className="border-l border-border h-6 mx-2"></div>
                <label className="text-sm text-text-primary flex items-center gap-2">
                    View:
                    <select
                        value={style}
                        onChange={(e) => setStyle(e.target.value as 'gantt' | 'list' | 'vertical')}
                        disabled={readOnly}
                        className="px-2 py-1 border border-border rounded text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="list">List View</option>
                        <option value="gantt">Gantt Chart</option>
                        <option value="vertical">Vertical Timeline</option>
                    </select>
                </label>
            </div>

            {/* Timeline Content */}
            <div className="flex-1 p-6 overflow-auto">
                {style === 'gantt' ? (
                    /* Gantt Chart View */
                    <div className="space-y-2">
                        {/* Date header */}
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-48 text-sm font-semibold text-text-primary">Milestone</div>
                            <div className="flex-1 relative h-8 bg-gray-100 rounded">
                                <div className="absolute left-0 text-xs text-text-muted">
                                    {projectStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                                <div className="absolute right-0 text-xs text-text-muted">
                                    {projectEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                            </div>
                        </div>

                        {milestones.map((milestone) => {
                            const startOffset = ((new Date(milestone.startDate).getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100;
                            const width = ((new Date(milestone.endDate).getTime() - new Date(milestone.startDate).getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100;
                            const statusColor = STATUS_COLORS[milestone.status];

                            return (
                                <div key={milestone.id} className="flex items-center gap-4">
                                    <div className="w-48 text-sm font-medium text-text-primary truncate" title={milestone.title}>
                                        {milestone.title}
                                    </div>
                                    <div className="flex-1 relative h-8 bg-gray-50 rounded border border-gray-200">
                                        <div
                                            className={clsx('absolute h-6 top-1 rounded', statusColor.bg)}
                                            style={{
                                                left: `${Math.max(0, startOffset)}%`,
                                                width: `${Math.min(100 - startOffset, width)}%`,
                                            }}
                                        >
                                            <span className={clsx('text-xs px-2 truncate', statusColor.text)}>
                                                {milestone.title}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : style === 'vertical' ? (
                    /* Vertical Timeline View */
                    <div className="relative pl-8">
                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                        {milestones.map((milestone, index) => {
                            const statusColor = STATUS_COLORS[milestone.status];
                            return (
                                <div key={milestone.id} className="relative pb-8 last:pb-0">
                                    <div
                                        className={clsx('absolute left-[-17px] w-6 h-6 rounded-full border-2 border-white', statusColor.bg)}
                                        style={{ top: '4px' }}
                                    >
                                        <span className="text-xs font-bold flex items-center justify-center h-full" style={{ color }}>
                                            {index + 1}
                                        </span>
                                    </div>
                                    <div className="bg-white rounded-lg border border-border p-4 shadow-sm ml-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-text-primary">{milestone.title}</h3>
                                                <p className="text-sm text-text-muted mt-1">{milestone.description || 'No description'}</p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                                                    <span>{new Date(milestone.startDate).toLocaleDateString()} - {new Date(milestone.endDate).toLocaleDateString()}</span>
                                                    <span className={clsx('px-2 py-0.5 rounded-full', statusColor.bg, statusColor.text)}>
                                                        {statusColor.label}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* List View (Default) */
                    <div className="space-y-4">
                        {milestones.map((milestone, index) => {
                            const statusColor = STATUS_COLORS[milestone.status];
                            return (
                                <div
                                    key={milestone.id}
                                    className="bg-white rounded-lg border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Phase number */}
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                                            style={{ backgroundColor: color }}
                                        >
                                            {index + 1}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <input
                                                    type="text"
                                                    value={milestone.title}
                                                    onChange={(e) => handleUpdateMilestone(milestone.id, { title: e.target.value })}
                                                    disabled={readOnly}
                                                    placeholder="Milestone title"
                                                    className="flex-1 font-semibold text-text-primary bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                                                />
                                                <select
                                                    value={milestone.status}
                                                    onChange={(e) => handleUpdateMilestone(milestone.id, { status: e.target.value as Milestone['status'] })}
                                                    disabled={readOnly}
                                                    className={clsx('text-xs px-2 py-1 rounded-full border-none', statusColor.bg, statusColor.text)}
                                                >
                                                    <option value="pending">Pending</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="completed">Completed</option>
                                                    <option value="delayed">Delayed</option>
                                                </select>
                                            </div>

                                            <textarea
                                                value={milestone.description}
                                                onChange={(e) => handleUpdateMilestone(milestone.id, { description: e.target.value })}
                                                disabled={readOnly}
                                                placeholder="Description..."
                                                rows={2}
                                                className="w-full text-sm text-text-secondary bg-gray-50 border border-border rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary mb-3"
                                            />

                                            <div className="flex items-center gap-4 flex-wrap">
                                                <label className="flex items-center gap-2 text-sm text-text-muted">
                                                    Start:
                                                    <input
                                                        type="date"
                                                        value={milestone.startDate}
                                                        onChange={(e) => handleUpdateMilestone(milestone.id, { startDate: e.target.value })}
                                                        disabled={readOnly}
                                                        className="px-2 py-1 border border-border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                                    />
                                                </label>
                                                <label className="flex items-center gap-2 text-sm text-text-muted">
                                                    End:
                                                    <input
                                                        type="date"
                                                        value={milestone.endDate}
                                                        onChange={(e) => handleUpdateMilestone(milestone.id, { endDate: e.target.value })}
                                                        disabled={readOnly}
                                                        className="px-2 py-1 border border-border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                                    />
                                                </label>
                                                <span className="text-xs text-text-muted">
                                                    {Math.ceil((new Date(milestone.endDate).getTime() - new Date(milestone.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        {!readOnly && (
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => handleMoveMilestone(milestone.id, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                                                >
                                                    <ArrowUpIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveMilestone(milestone.id, 'down')}
                                                    disabled={index === milestones.length - 1}
                                                    className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                                                >
                                                    <ArrowDownIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteMilestone(milestone.id)}
                                                    className="p-1 text-error hover:text-error-dark"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-error-light border border-error rounded text-sm text-error">
                        {error}
                    </div>
                )}

                {!readOnly && (
                    <div className="flex gap-2 mt-6 justify-end">
                        <button
                            onClick={() => {
                                setError(null);
                                onCancel();
                            }}
                            disabled={isSaving}
                            className="btn-secondary text-sm flex items-center gap-2"
                        >
                            <XMarkIcon className="w-4 h-4" />
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveClick}
                            disabled={isSaving}
                            className="btn-primary text-sm flex items-center gap-2"
                        >
                            {isSaving && <span className="w-4 h-4 animate-spin">⟳</span>}
                            <CheckIcon className="w-4 h-4" />
                            Save Timeline
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimelineEditor;
