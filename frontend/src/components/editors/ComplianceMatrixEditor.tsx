import React, { useState } from 'react';
import {
    PlusIcon,
    TrashIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    CheckIcon,
    XMarkIcon,
    ShieldCheckIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

type ComplianceStatus = 'compliant' | 'partial' | 'non_compliant' | 'not_applicable' | 'pending';

interface Requirement {
    id: string;
    requirementId: string; // e.g., "REQ-001"
    category: string;
    description: string;
    status: ComplianceStatus;
    response: string;
    evidence?: string;
    notes?: string;
}

interface ComplianceMatrixEditorProps {
    requirements: Requirement[];
    style: 'table' | 'cards' | 'grouped';
    onSave: (data: { requirements: Requirement[]; style: string }) => Promise<void>;
    onCancel: () => void;
    isSaving?: boolean;
    color?: string;
    readOnly?: boolean;
}

const STATUS_CONFIG: Record<ComplianceStatus, { bg: string; text: string; label: string; icon: string }> = {
    compliant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Compliant', icon: '✓' },
    partial: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial', icon: '◐' },
    non_compliant: { bg: 'bg-red-100', text: 'text-red-700', label: 'Non-Compliant', icon: '✗' },
    not_applicable: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'N/A', icon: '—' },
    pending: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending', icon: '?' },
};

const CATEGORIES = [
    'General',
    'Security',
    'Technical',
    'Compliance',
    'Experience',
    'Financial',
    'Legal',
];

const generateId = () => Math.random().toString(36).substring(2, 11);

export const ComplianceMatrixEditor: React.FC<ComplianceMatrixEditorProps> = ({
    requirements: initialRequirements,
    style: initialStyle,
    onSave,
    onCancel,
    isSaving = false,
    color = '#8B5CF6',
    readOnly = false,
}) => {
    const [requirements, setRequirements] = useState<Requirement[]>(
        initialRequirements.length > 0
            ? initialRequirements
            : [
                {
                    id: generateId(),
                    requirementId: 'REQ-001',
                    category: 'General',
                    description: 'Sample requirement',
                    status: 'pending',
                    response: '',
                },
            ]
    );
    const [style, setStyle] = useState<'table' | 'cards' | 'grouped'>(initialStyle || 'table');
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<ComplianceStatus | 'all'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleAddRequirement = () => {
        const nextNum = requirements.length + 1;
        setRequirements([
            ...requirements,
            {
                id: generateId(),
                requirementId: `REQ-${String(nextNum).padStart(3, '0')}`,
                category: 'General',
                description: '',
                status: 'pending',
                response: '',
            },
        ]);
    };

    const handleDeleteRequirement = (id: string) => {
        setRequirements(requirements.filter((r) => r.id !== id));
    };

    const handleUpdateRequirement = (id: string, updates: Partial<Requirement>) => {
        setRequirements(requirements.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    };

    const handleMoveRequirement = (id: string, direction: 'up' | 'down') => {
        const index = requirements.findIndex((r) => r.id === id);
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === requirements.length - 1) return;

        const newRequirements = [...requirements];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newRequirements[index], newRequirements[targetIndex]] = [newRequirements[targetIndex], newRequirements[index]];
        setRequirements(newRequirements);
    };

    const handleSaveClick = async () => {
        try {
            setError(null);
            await onSave({ requirements, style });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        }
    };

    // Filter requirements
    const filteredRequirements = requirements.filter((req) => {
        const matchesSearch = search === '' ||
            req.description.toLowerCase().includes(search.toLowerCase()) ||
            req.requirementId.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    // Group by category for grouped view
    const groupedRequirements = CATEGORIES.reduce((acc, category) => {
        const items = filteredRequirements.filter((r) => r.category === category);
        if (items.length > 0) {
            acc[category] = items;
        }
        return acc;
    }, {} as Record<string, Requirement[]>);

    // Stats
    const stats = {
        total: requirements.length,
        compliant: requirements.filter((r) => r.status === 'compliant').length,
        partial: requirements.filter((r) => r.status === 'partial').length,
        nonCompliant: requirements.filter((r) => r.status === 'non_compliant').length,
        pending: requirements.filter((r) => r.status === 'pending').length,
    };
    const compliancePercent = stats.total > 0
        ? Math.round(((stats.compliant + stats.partial * 0.5) / (stats.total - requirements.filter(r => r.status === 'not_applicable').length)) * 100)
        : 0;

    return (
        <div className="w-full bg-background rounded-lg shadow border border-border h-full flex flex-col">
            {/* Header */}
            <div className="border-b border-border px-6 py-4" style={{ borderLeftWidth: '4px', borderLeftColor: color }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <ShieldCheckIcon className="w-5 h-5" style={{ color }} />
                            Compliance Matrix Editor
                        </h2>
                        <p className="text-sm text-text-muted mt-1">
                            Track requirements compliance status
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold" style={{ color }}>
                            {isNaN(compliancePercent) ? 0 : compliancePercent}%
                        </div>
                        <p className="text-xs text-text-muted">Compliance Score</p>
                    </div>
                </div>

                {/* Stats bar */}
                <div className="flex items-center gap-4 mt-4">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                        <div className="bg-green-500 h-full" style={{ width: `${(stats.compliant / stats.total) * 100}%` }}></div>
                        <div className="bg-amber-400 h-full" style={{ width: `${(stats.partial / stats.total) * 100}%` }}></div>
                        <div className="bg-red-500 h-full" style={{ width: `${(stats.nonCompliant / stats.total) * 100}%` }}></div>
                        <div className="bg-blue-400 h-full" style={{ width: `${(stats.pending / stats.total) * 100}%` }}></div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {stats.compliant}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                            {stats.partial}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            {stats.nonCompliant}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                            {stats.pending}
                        </span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="border-b border-border px-6 py-3 bg-surface flex items-center gap-3 flex-wrap">
                <button
                    onClick={handleAddRequirement}
                    disabled={readOnly || isSaving}
                    className="btn-secondary text-sm flex items-center gap-2"
                >
                    <PlusIcon className="w-4 h-4" />
                    Add Requirement
                </button>
                <div className="border-l border-border h-6 mx-2"></div>

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search requirements..."
                        className="w-full pl-9 pr-3 py-1.5 border border-border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                {/* Status filter */}
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as ComplianceStatus | 'all')}
                    className="px-2 py-1.5 border border-border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="all">All Status</option>
                    <option value="compliant">Compliant</option>
                    <option value="partial">Partial</option>
                    <option value="non_compliant">Non-Compliant</option>
                    <option value="pending">Pending</option>
                    <option value="not_applicable">N/A</option>
                </select>

                {/* View selector */}
                <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value as 'table' | 'cards' | 'grouped')}
                    disabled={readOnly}
                    className="px-2 py-1.5 border border-border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="table">Table View</option>
                    <option value="cards">Card View</option>
                    <option value="grouped">Grouped View</option>
                </select>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-auto">
                {style === 'table' ? (
                    /* Table View */
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-surface border-b border-border text-left">
                                    <th className="px-3 py-2 font-semibold text-text-primary w-24">ID</th>
                                    <th className="px-3 py-2 font-semibold text-text-primary w-32">Category</th>
                                    <th className="px-3 py-2 font-semibold text-text-primary">Requirement</th>
                                    <th className="px-3 py-2 font-semibold text-text-primary w-28">Status</th>
                                    <th className="px-3 py-2 font-semibold text-text-primary">Response</th>
                                    {!readOnly && <th className="px-3 py-2 font-semibold text-text-primary w-20">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRequirements.map((req, index) => {
                                    const statusConfig = STATUS_CONFIG[req.status];
                                    return (
                                        <tr key={req.id} className="border-b border-border hover:bg-gray-50">
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={req.requirementId}
                                                    onChange={(e) => handleUpdateRequirement(req.id, { requirementId: e.target.value })}
                                                    disabled={readOnly}
                                                    className="w-full bg-transparent border-none p-0 font-mono text-primary focus:outline-none"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={req.category}
                                                    onChange={(e) => handleUpdateRequirement(req.id, { category: e.target.value })}
                                                    disabled={readOnly}
                                                    className="w-full bg-transparent border-none p-0 text-text-secondary focus:outline-none"
                                                >
                                                    {CATEGORIES.map((cat) => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={req.description}
                                                    onChange={(e) => handleUpdateRequirement(req.id, { description: e.target.value })}
                                                    disabled={readOnly}
                                                    placeholder="Requirement description..."
                                                    className="w-full bg-transparent border-none p-0 text-text-primary focus:outline-none"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={req.status}
                                                    onChange={(e) => handleUpdateRequirement(req.id, { status: e.target.value as ComplianceStatus })}
                                                    disabled={readOnly}
                                                    className={clsx('text-xs px-2 py-1 rounded-full border-none font-medium', statusConfig.bg, statusConfig.text)}
                                                >
                                                    <option value="compliant">✓ Compliant</option>
                                                    <option value="partial">◐ Partial</option>
                                                    <option value="non_compliant">✗ Non-Compliant</option>
                                                    <option value="pending">? Pending</option>
                                                    <option value="not_applicable">— N/A</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={req.response}
                                                    onChange={(e) => handleUpdateRequirement(req.id, { response: e.target.value })}
                                                    disabled={readOnly}
                                                    placeholder="Our approach..."
                                                    className="w-full bg-transparent border-none p-0 text-text-secondary focus:outline-none"
                                                />
                                            </td>
                                            {!readOnly && (
                                                <td className="px-3 py-2">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleMoveRequirement(req.id, 'up')}
                                                            disabled={index === 0}
                                                            className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                                                        >
                                                            <ArrowUpIcon className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleMoveRequirement(req.id, 'down')}
                                                            disabled={index === filteredRequirements.length - 1}
                                                            className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                                                        >
                                                            <ArrowDownIcon className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRequirement(req.id)}
                                                            className="p-1 text-error hover:text-error-dark"
                                                        >
                                                            <TrashIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : style === 'grouped' ? (
                    /* Grouped View */
                    <div className="space-y-6">
                        {Object.entries(groupedRequirements).map(([category, items]) => (
                            <div key={category} className="border border-border rounded-lg overflow-hidden">
                                <div className="bg-surface px-4 py-2 font-semibold text-text-primary border-b border-border flex items-center justify-between">
                                    <span>{category}</span>
                                    <span className="text-xs text-text-muted">
                                        {items.filter(r => r.status === 'compliant').length}/{items.length} compliant
                                    </span>
                                </div>
                                <div className="divide-y divide-border">
                                    {items.map((req) => {
                                        const statusConfig = STATUS_CONFIG[req.status];
                                        return (
                                            <div key={req.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
                                                <span className="font-mono text-xs text-primary">{req.requirementId}</span>
                                                <span className="flex-1 text-text-primary">{req.description}</span>
                                                <span className={clsx('text-xs px-2 py-1 rounded-full', statusConfig.bg, statusConfig.text)}>
                                                    {statusConfig.icon} {statusConfig.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Card View */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredRequirements.map((req, index) => {
                            const statusConfig = STATUS_CONFIG[req.status];
                            const isExpanded = expandedId === req.id;
                            return (
                                <div
                                    key={req.id}
                                    className={clsx(
                                        'bg-white rounded-lg border-2 p-4 transition-all cursor-pointer hover:shadow-md',
                                        req.status === 'compliant' ? 'border-green-200' :
                                            req.status === 'partial' ? 'border-amber-200' :
                                                req.status === 'non_compliant' ? 'border-red-200' : 'border-gray-200'
                                    )}
                                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 rounded text-primary">
                                                    {req.requirementId}
                                                </span>
                                                <span className="text-xs text-text-muted">{req.category}</span>
                                            </div>
                                            <p className="text-text-primary font-medium">{req.description || 'No description'}</p>
                                            {isExpanded && (
                                                <div className="mt-3 pt-3 border-t border-border space-y-2">
                                                    <div>
                                                        <label className="text-xs text-text-muted">Response:</label>
                                                        <p className="text-sm text-text-secondary">{req.response || 'No response yet'}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <span className={clsx('text-lg', statusConfig.text)}>
                                            {statusConfig.icon}
                                        </span>
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
                            Save Matrix
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplianceMatrixEditor;
