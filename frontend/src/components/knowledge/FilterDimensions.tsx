import { useState, useEffect, useCallback } from 'react';
import {
    PlusIcon,
    TrashIcon,
    TagIcon,
    GlobeAltIcon,
    BuildingOffice2Icon,
    CurrencyDollarIcon,
    BriefcaseIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import api from '../../api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface FilterDimension {
    id: number;
    dimension_type: string;
    code: string;
    name: string;
    description?: string;
    icon?: string;
    is_system: boolean;
    sort_order: number;
}

interface DimensionsByType {
    [key: string]: FilterDimension[];
}

const DIMENSION_TYPES = [
    { type: 'geography', label: 'Geographies', icon: GlobeAltIcon, color: 'text-blue-500' },
    { type: 'client_type', label: 'Client Types', icon: BuildingOffice2Icon, color: 'text-green-500' },
    { type: 'currency', label: 'Currencies', icon: CurrencyDollarIcon, color: 'text-yellow-500' },
    { type: 'industry', label: 'Industries', icon: BriefcaseIcon, color: 'text-purple-500' },
    { type: 'compliance', label: 'Compliance', icon: ShieldCheckIcon, color: 'text-orange-500' },
];

export default function FilterDimensions() {
    const [dimensions, setDimensions] = useState<DimensionsByType>({});
    const [isLoading, setIsLoading] = useState(true);
    const [activeType, setActiveType] = useState('geography');
    const [showAddModal, setShowAddModal] = useState(false);

    const loadDimensions = useCallback(async () => {
        try {
            const response = await api.get('/knowledge/dimensions');
            setDimensions(response.data || {});
        } catch {
            toast.error('Failed to load dimensions');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDimensions();
    }, [loadDimensions]);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this dimension?')) return;
        try {
            await api.delete(`/knowledge/dimensions/${id}`);
            toast.success('Dimension deleted');
            loadDimensions();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete dimension');
        }
    };

    const currentDimensions = dimensions[activeType] || [];
    const activeTypeConfig = DIMENSION_TYPES.find(t => t.type === activeType);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-text-primary">Filter Dimensions</h2>
                    <p className="text-text-secondary text-sm mt-1">
                        Manage dimension values used to categorize knowledge and projects
                    </p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="btn-primary">
                    <PlusIcon className="h-5 w-5" />
                    Add Dimension
                </button>
            </div>

            {/* Type Tabs */}
            <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
                {DIMENSION_TYPES.map((dt) => (
                    <button
                        key={dt.type}
                        onClick={() => setActiveType(dt.type)}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                            activeType === dt.type
                                ? 'bg-primary text-white'
                                : 'text-text-secondary hover:text-text-primary hover:bg-background'
                        )}
                    >
                        <dt.icon className="h-4 w-4" />
                        {dt.label}
                        <span className="text-xs opacity-70">
                            ({(dimensions[dt.type] || []).length})
                        </span>
                    </button>
                ))}
            </div>

            {/* Dimensions List */}
            {isLoading ? (
                <div className="text-text-muted text-center py-12">Loading dimensions...</div>
            ) : currentDimensions.length === 0 ? (
                <div className="card text-center py-12">
                    {activeTypeConfig && <activeTypeConfig.icon className={`h-12 w-12 mx-auto mb-4 ${activeTypeConfig.color}`} />}
                    <h3 className="text-lg font-medium text-text-primary mb-2">No {activeTypeConfig?.label} yet</h3>
                    <p className="text-text-secondary mb-4">
                        Add custom {activeTypeConfig?.label.toLowerCase()} to categorize your knowledge
                    </p>
                    <button onClick={() => setShowAddModal(true)} className="btn-primary">
                        <PlusIcon className="h-5 w-5" />
                        Add {activeTypeConfig?.label.slice(0, -1) || 'Dimension'}
                    </button>
                </div>
            ) : (
                <div className="card">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider pb-3">Icon</th>
                                <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider pb-3">Code</th>
                                <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider pb-3">Name</th>
                                <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider pb-3">Type</th>
                                <th className="text-right text-xs font-medium text-text-muted uppercase tracking-wider pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {currentDimensions.map((dim) => (
                                <tr key={dim.id} className="hover:bg-background/50">
                                    <td className="py-3 text-xl">{dim.icon || '📌'}</td>
                                    <td className="py-3">
                                        <code className="text-xs bg-background px-2 py-1 rounded">{dim.code}</code>
                                    </td>
                                    <td className="py-3 font-medium text-text-primary">{dim.name}</td>
                                    <td className="py-3">
                                        <span className={clsx(
                                            'text-xs px-2 py-1 rounded-full',
                                            dim.is_system ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                        )}>
                                            {dim.is_system ? 'System' : 'Custom'}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right">
                                        {!dim.is_system && (
                                            <button
                                                onClick={() => handleDelete(dim.id)}
                                                className="p-1.5 hover:bg-background rounded-lg text-text-muted hover:text-red-500"
                                                title="Delete"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <AddDimensionModal
                    activeType={activeType}
                    onClose={() => setShowAddModal(false)}
                    onCreated={() => {
                        setShowAddModal(false);
                        loadDimensions();
                    }}
                />
            )}
        </div>
    );
}

// Add Dimension Modal
function AddDimensionModal({
    activeType,
    onClose,
    onCreated,
}: {
    activeType: string;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('');
    const [dimensionType, setDimensionType] = useState(activeType);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim() || !name.trim()) {
            toast.error('Code and Name are required');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/knowledge/dimensions', {
                dimension_type: dimensionType,
                code: code.toUpperCase().replace(/\s+/g, '_'),
                name,
                description: description || undefined,
                icon: icon || undefined,
            });
            toast.success('Dimension created');
            onCreated();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create dimension');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-modal w-full max-w-md p-6 animate-scale-in">
                <h2 className="text-xl font-semibold text-text-primary mb-6">Add Dimension</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Dimension Type *
                        </label>
                        <select
                            value={dimensionType}
                            onChange={(e) => setDimensionType(e.target.value)}
                            className="input"
                        >
                            {DIMENSION_TYPES.map((dt) => (
                                <option key={dt.type} value={dt.type}>{dt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">
                                Code *
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="input"
                                placeholder="e.g., CANADA"
                            />
                            <p className="text-xs text-text-muted mt-1">Uppercase, no spaces</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">
                                Icon (emoji)
                            </label>
                            <input
                                type="text"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                className="input"
                                placeholder="🇨🇦"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Display Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input"
                            placeholder="e.g., Canada"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                            Description <span className="text-text-muted">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input min-h-[60px] resize-none"
                            placeholder="Optional description..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                            {isLoading ? 'Creating...' : 'Create Dimension'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
