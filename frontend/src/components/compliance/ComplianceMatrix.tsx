import { useState, useEffect } from 'react';
import {
    PlusIcon,
    TrashIcon,
    PencilIcon,
    ArrowDownTrayIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    MinusCircleIcon,
    ClockIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';
import { complianceApi } from '@/api/client';
import { ComplianceItem, ComplianceStats, ComplianceStatus, RFPSection } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ComplianceMatrixProps {
    projectId: number;
    sections: RFPSection[];
}

const STATUS_CONFIG: Record<ComplianceStatus, {
    label: string;
    color: string;
    bgColor: string;
    icon: typeof CheckCircleIcon;
}> = {
    compliant: {
        label: 'Compliant',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50 border-emerald-200',
        icon: CheckCircleIcon,
    },
    partial: {
        label: 'Partial',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50 border-amber-200',
        icon: ExclamationTriangleIcon,
    },
    non_compliant: {
        label: 'Non-Compliant',
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200',
        icon: XCircleIcon,
    },
    not_applicable: {
        label: 'N/A',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50 border-gray-200',
        icon: MinusCircleIcon,
    },
    pending: {
        label: 'Pending',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 border-blue-200',
        icon: ClockIcon,
    },
};

const CATEGORIES = [
    'Technical',
    'Legal',
    'Security',
    'Pricing',
    'Operational',
    'Compliance',
    'Experience',
    'Support',
];

export default function ComplianceMatrix({ projectId, sections }: ComplianceMatrixProps) {
    const [items, setItems] = useState<ComplianceItem[]>([]);
    const [stats, setStats] = useState<ComplianceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<string>('');

    // Form state
    const [formData, setFormData] = useState({
        requirement_id: '',
        requirement_text: '',
        source: '',
        category: '',
        compliance_status: 'pending' as ComplianceStatus,
        section_id: null as number | null,
        response_summary: '',
        notes: '',
        priority: 'normal',
    });

    useEffect(() => {
        loadItems();
    }, [projectId, filterStatus, filterCategory]);

    const loadItems = async () => {
        try {
            const params: { category?: string; status?: string } = {};
            if (filterCategory) params.category = filterCategory;
            if (filterStatus) params.status = filterStatus;

            const response = await complianceApi.list(projectId, params);
            setItems(response.data.items || []);
            setStats(response.data.stats || null);
        } catch {
            toast.error('Failed to load compliance items');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.requirement_text.trim()) {
            toast.error('Requirement text is required');
            return;
        }

        try {
            await complianceApi.create(projectId, formData);
            toast.success('Compliance item added');
            setShowAddForm(false);
            resetForm();
            loadItems();
        } catch {
            toast.error('Failed to create item');
        }
    };

    const handleUpdate = async () => {
        if (!editingId) return;

        try {
            await complianceApi.update(editingId, formData);
            toast.success('Compliance item updated');
            setEditingId(null);
            resetForm();
            loadItems();
        } catch {
            toast.error('Failed to update item');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this compliance item?')) return;

        try {
            await complianceApi.delete(id);
            toast.success('Item deleted');
            loadItems();
        } catch {
            toast.error('Failed to delete item');
        }
    };

    const handleStatusChange = async (id: number, status: ComplianceStatus) => {
        try {
            await complianceApi.update(id, { compliance_status: status });
            loadItems();
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleExport = async () => {
        const url = complianceApi.getExportUrl(projectId);
        const token = localStorage.getItem('access_token');

        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'Compliance_Matrix.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            toast.success('Export downloaded');
        } catch {
            toast.error('Export failed');
        }
    };

    const startEdit = (item: ComplianceItem) => {
        setFormData({
            requirement_id: item.requirement_id || '',
            requirement_text: item.requirement_text,
            source: item.source || '',
            category: item.category || '',
            compliance_status: item.compliance_status,
            section_id: item.section_id,
            response_summary: item.response_summary || '',
            notes: item.notes || '',
            priority: item.priority,
        });
        setEditingId(item.id);
        setShowAddForm(false);
    };

    const resetForm = () => {
        setFormData({
            requirement_id: '',
            requirement_text: '',
            source: '',
            category: '',
            compliance_status: 'pending',
            section_id: null,
            response_summary: '',
            notes: '',
            priority: 'normal',
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setShowAddForm(false);
        resetForm();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Stats */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-text-primary">Compliance Matrix</h2>
                    <p className="text-sm text-text-secondary mt-1">
                        Track RFP requirements and compliance status
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="btn-secondary flex items-center gap-2"
                        disabled={items.length === 0}
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export
                    </button>
                    <button
                        onClick={() => {
                            setShowAddForm(true);
                            setEditingId(null);
                            resetForm();
                        }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add Requirement
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            {stats && stats.total > 0 && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm text-gray-600">
                        <strong>{stats.total}</strong> total
                    </span>
                    <span className="text-sm text-emerald-600">
                        <strong>{stats.compliant}</strong> compliant
                    </span>
                    <span className="text-sm text-amber-600">
                        <strong>{stats.partial}</strong> partial
                    </span>
                    <span className="text-sm text-red-600">
                        <strong>{stats.non_compliant}</strong> non-compliant
                    </span>
                    <span className="text-sm text-gray-500">
                        <strong>{stats.not_applicable}</strong> N/A
                    </span>
                    <span className="text-sm text-blue-600">
                        <strong>{stats.pending}</strong> pending
                    </span>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FunnelIcon className="h-4 w-4" />
                    Filter:
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="input py-1.5 text-sm"
                >
                    <option value="">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </select>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="input py-1.5 text-sm"
                >
                    <option value="">All Categories</option>
                    {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                    ))}
                </select>
            </div>

            {/* Add/Edit Form */}
            {(showAddForm || editingId) && (
                <div className="card p-4 border-2 border-primary/30">
                    <h3 className="font-medium mb-4">
                        {editingId ? 'Edit Requirement' : 'Add New Requirement'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Requirement Text *</label>
                            <textarea
                                value={formData.requirement_text}
                                onChange={(e) => setFormData({ ...formData, requirement_text: e.target.value })}
                                className="input w-full h-20 resize-none"
                                placeholder="Enter the requirement..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Requirement ID</label>
                            <input
                                type="text"
                                value={formData.requirement_id}
                                onChange={(e) => setFormData({ ...formData, requirement_id: e.target.value })}
                                className="input w-full"
                                placeholder="e.g., REQ-001"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Source</label>
                            <input
                                type="text"
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                className="input w-full"
                                placeholder="e.g., RFP Section 3.2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Category</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="input w-full"
                            >
                                <option value="">Select category...</option>
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Compliance Status</label>
                            <select
                                value={formData.compliance_status}
                                onChange={(e) => setFormData({ ...formData, compliance_status: e.target.value as ComplianceStatus })}
                                className="input w-full"
                            >
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>{config.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Link to Section</label>
                            <select
                                value={formData.section_id || ''}
                                onChange={(e) => setFormData({ ...formData, section_id: e.target.value ? Number(e.target.value) : null })}
                                className="input w-full"
                            >
                                <option value="">No section linked</option>
                                {sections.map((section) => (
                                    <option key={section.id} value={section.id}>{section.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Priority</label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="input w-full"
                            >
                                <option value="high">High</option>
                                <option value="normal">Normal</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Response Summary</label>
                            <textarea
                                value={formData.response_summary}
                                onChange={(e) => setFormData({ ...formData, response_summary: e.target.value })}
                                className="input w-full h-16 resize-none"
                                placeholder="Brief description of how this requirement is addressed..."
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Notes</label>
                            <input
                                type="text"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="input w-full"
                                placeholder="Internal notes..."
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={cancelEdit} className="btn-secondary">Cancel</button>
                        <button
                            onClick={editingId ? handleUpdate : handleCreate}
                            className="btn-primary"
                        >
                            {editingId ? 'Save Changes' : 'Add Requirement'}
                        </button>
                    </div>
                </div>
            )}

            {/* Items Table */}
            {items.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-text-secondary">No compliance items yet</p>
                    <p className="text-sm text-text-muted mt-1">
                        Add requirements to track RFP compliance
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left p-3 text-sm font-medium text-gray-600">ID</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600 w-1/3">Requirement</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Category</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Status</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Section</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => {
                                const statusConfig = STATUS_CONFIG[item.compliance_status];
                                const StatusIcon = statusConfig.icon;

                                return (
                                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="p-3">
                                            <span className="text-sm font-mono text-gray-600">
                                                {item.requirement_id || '-'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm text-gray-900 line-clamp-2">
                                                {item.requirement_text}
                                            </p>
                                            {item.source && (
                                                <p className="text-xs text-gray-500 mt-1">{item.source}</p>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <span className="text-sm capitalize text-gray-600">
                                                {item.category || '-'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <select
                                                value={item.compliance_status}
                                                onChange={(e) => handleStatusChange(item.id, e.target.value as ComplianceStatus)}
                                                className={clsx(
                                                    'text-xs px-2 py-1 rounded-lg border font-medium cursor-pointer',
                                                    statusConfig.bgColor,
                                                    statusConfig.color
                                                )}
                                            >
                                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                                    <option key={key} value={key}>{config.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-3">
                                            <span className="text-sm text-gray-600">
                                                {item.section?.title || '-'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => startEdit(item)}
                                                    className="p-1.5 rounded hover:bg-gray-100"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="h-4 w-4 text-gray-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 rounded hover:bg-red-50"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-4 w-4 text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
