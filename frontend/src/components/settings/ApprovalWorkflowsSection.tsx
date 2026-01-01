/**
 * Approval Workflows Settings Component
 * 
 * Allows admins to configure multi-stage approval workflows for proposals.
 */
import { useState, useEffect } from 'react';
import {
    CheckBadgeIcon,
    PlusIcon,
    TrashIcon,
    PencilIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    UserIcon,
    UserGroupIcon,
    ArrowPathIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ApprovalStage {
    id?: number;
    name: string;
    description?: string;
    order: number;
    approver_type: 'role' | 'user' | 'manager';
    approver_role?: string;
    approver_user_id?: number;
    required_approvals: number;
    notify_on_pending: boolean;
    reminder_hours: number;
}

interface ApprovalWorkflow {
    id: number;
    name: string;
    description?: string;
    trigger_type: 'manual' | 'auto_on_complete' | 'value_threshold';
    trigger_conditions: Record<string, any>;
    is_active: boolean;
    is_default: boolean;
    allow_parallel: boolean;
    require_all: boolean;
    auto_escalate: boolean;
    escalation_hours: number;
    stages: ApprovalStage[];
    created_at: string;
}

const APPROVER_ROLES = [
    { value: 'manager', label: 'Manager' },
    { value: 'admin', label: 'Administrator' },
    { value: 'legal', label: 'Legal Team' },
    { value: 'finance', label: 'Finance Team' },
    { value: 'executive', label: 'Executive' },
];

export default function ApprovalWorkflowsSection() {
    const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null);
    const [expandedWorkflow, setExpandedWorkflow] = useState<number | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        trigger_type: 'manual' as const,
        is_default: false,
        auto_escalate: false,
        escalation_hours: 48,
        stages: [] as ApprovalStage[],
    });

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/approvals/workflows', {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            if (response.ok) {
                const data = await response.json();
                setWorkflows(data.workflows || []);
            } else {
                console.error('Failed to fetch workflows:', response.status);
                toast.error('Failed to load approval workflows');
                setWorkflows([]);
            }
        } catch (error) {
            console.error('Failed to fetch workflows:', error);
            toast.error('Failed to connect to server');
            setWorkflows([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkflow = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/approvals/workflows', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                const data = await response.json();
                setWorkflows([data.workflow, ...workflows]);
                toast.success('Workflow created');
                setShowCreateModal(false);
                resetForm();
            } else {
                toast.error('Failed to create workflow');
            }
        } catch (error) {
            console.error('Error creating workflow:', error);
            toast.error('Failed to create workflow');
        }
    };

    const handleDeleteWorkflow = async (workflowId: number) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/approvals/workflows/${workflowId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setWorkflows(workflows.filter(w => w.id !== workflowId));
                toast.success('Workflow deleted');
            } else {
                toast.error('Failed to delete workflow');
            }
        } catch (error) {
            console.error('Error deleting workflow:', error);
            toast.error('Failed to delete workflow');
        }
    };

    const handleToggleActive = async (workflow: ApprovalWorkflow) => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/approvals/workflows/${workflow.id}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_active: !workflow.is_active }),
            });

            if (response.ok) {
                setWorkflows(workflows.map(w => 
                    w.id === workflow.id ? { ...w, is_active: !w.is_active } : w
                ));
                toast.success(`Workflow ${workflow.is_active ? 'disabled' : 'enabled'}`);
            }
        } catch (error) {
            console.error('Error toggling workflow:', error);
        }
    };

    const addStage = () => {
        setFormData({
            ...formData,
            stages: [
                ...formData.stages,
                {
                    name: `Stage ${formData.stages.length + 1}`,
                    order: formData.stages.length,
                    approver_type: 'role',
                    approver_role: 'manager',
                    required_approvals: 1,
                    notify_on_pending: true,
                    reminder_hours: 24,
                },
            ],
        });
    };

    const removeStage = (index: number) => {
        setFormData({
            ...formData,
            stages: formData.stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })),
        });
    };

    const updateStage = (index: number, updates: Partial<ApprovalStage>) => {
        setFormData({
            ...formData,
            stages: formData.stages.map((s, i) => i === index ? { ...s, ...updates } : s),
        });
    };

    const moveStage = (index: number, direction: 'up' | 'down') => {
        const newStages = [...formData.stages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newStages.length) return;
        
        [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
        setFormData({
            ...formData,
            stages: newStages.map((s, i) => ({ ...s, order: i })),
        });
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            trigger_type: 'manual',
            is_default: false,
            auto_escalate: false,
            escalation_hours: 48,
            stages: [],
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-text-primary">Approval Workflows</h2>
                    <p className="text-sm text-text-secondary">
                        Configure multi-stage approval processes for proposals
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <PlusIcon className="h-4 w-4" />
                    Create Workflow
                </button>
            </div>

            {/* Workflows List */}
            <div className="space-y-4">
                {workflows.length === 0 ? (
                    <div className="text-center py-12 bg-surface rounded-xl border border-border">
                        <CheckBadgeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-text-primary">No Workflows</h3>
                        <p className="text-text-secondary mt-1">
                            Create your first approval workflow to get started
                        </p>
                    </div>
                ) : (
                    workflows.map(workflow => (
                        <div
                            key={workflow.id}
                            className="bg-surface rounded-xl border border-border overflow-hidden"
                        >
                            {/* Workflow Header */}
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                                onClick={() => setExpandedWorkflow(
                                    expandedWorkflow === workflow.id ? null : workflow.id
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        'p-2 rounded-lg',
                                        workflow.is_active ? 'bg-green-100' : 'bg-gray-100'
                                    )}>
                                        <CheckBadgeIcon className={clsx(
                                            'h-6 w-6',
                                            workflow.is_active ? 'text-green-600' : 'text-gray-400'
                                        )} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-text-primary">
                                                {workflow.name}
                                            </h3>
                                            {workflow.is_default && (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-text-secondary">
                                            {workflow.stages.length} stages • {workflow.trigger_type.replace('_', ' ')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleActive(workflow);
                                        }}
                                        className={clsx(
                                            'px-3 py-1 text-xs font-medium rounded-full',
                                            workflow.is_active
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                        )}
                                    >
                                        {workflow.is_active ? 'Active' : 'Disabled'}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteWorkflow(workflow.id);
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-500"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Stages */}
                            {expandedWorkflow === workflow.id && (
                                <div className="border-t border-border p-4 bg-gray-50">
                                    <h4 className="text-sm font-medium text-text-primary mb-3">
                                        Approval Stages
                                    </h4>
                                    <div className="space-y-2">
                                        {workflow.stages.map((stage, index) => (
                                            <div
                                                key={stage.id || index}
                                                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
                                            >
                                                <div className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded-full text-sm font-medium">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium text-text-primary">
                                                        {stage.name}
                                                    </div>
                                                    <div className="text-xs text-text-secondary flex items-center gap-2">
                                                        {stage.approver_type === 'role' && (
                                                            <>
                                                                <UserGroupIcon className="h-3 w-3" />
                                                                {APPROVER_ROLES.find(r => r.value === stage.approver_role)?.label || stage.approver_role}
                                                            </>
                                                        )}
                                                        {stage.approver_type === 'user' && (
                                                            <>
                                                                <UserIcon className="h-3 w-3" />
                                                                Specific User
                                                            </>
                                                        )}
                                                        <span className="text-gray-300">•</span>
                                                        <ClockIcon className="h-3 w-3" />
                                                        {stage.reminder_hours}h reminder
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {workflow.auto_escalate && (
                                        <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                                            <ClockIcon className="h-4 w-4" />
                                            Auto-escalates after {workflow.escalation_hours} hours
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-semibold">Create Approval Workflow</h3>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Workflow Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input w-full"
                                        placeholder="e.g., Standard Approval"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="input w-full"
                                        rows={2}
                                        placeholder="Describe when this workflow should be used"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Trigger
                                        </label>
                                        <select
                                            value={formData.trigger_type}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                trigger_type: e.target.value as any 
                                            })}
                                            className="input w-full"
                                        >
                                            <option value="manual">Manual</option>
                                            <option value="auto_on_complete">Auto on Completion</option>
                                            <option value="value_threshold">Value Threshold</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end gap-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_default}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    is_default: e.target.checked 
                                                })}
                                                className="rounded"
                                            />
                                            <span className="text-sm">Set as default</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Stages */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Approval Stages
                                    </label>
                                    <button
                                        onClick={addStage}
                                        className="text-sm text-primary hover:underline flex items-center gap-1"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Add Stage
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {formData.stages.map((stage, index) => (
                                        <div
                                            key={index}
                                            className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="flex flex-col">
                                                    <button
                                                        onClick={() => moveStage(index, 'up')}
                                                        disabled={index === 0}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        <ChevronUpIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => moveStage(index, 'down')}
                                                        disabled={index === formData.stages.length - 1}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        <ChevronDownIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <span className="text-sm font-medium text-gray-500">
                                                    Stage {index + 1}
                                                </span>
                                                <div className="flex-1" />
                                                <button
                                                    onClick={() => removeStage(index)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <input
                                                    type="text"
                                                    value={stage.name}
                                                    onChange={(e) => updateStage(index, { name: e.target.value })}
                                                    className="input"
                                                    placeholder="Stage name"
                                                />
                                                <select
                                                    value={stage.approver_role}
                                                    onChange={(e) => updateStage(index, { approver_role: e.target.value })}
                                                    className="input"
                                                >
                                                    {APPROVER_ROLES.map(role => (
                                                        <option key={role.value} value={role.value}>
                                                            {role.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {formData.stages.length === 0 && (
                                        <div className="text-center py-6 text-gray-500 text-sm">
                                            Add at least one approval stage
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Escalation */}
                            <div className="border-t pt-4">
                                <label className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        checked={formData.auto_escalate}
                                        onChange={(e) => setFormData({ 
                                            ...formData, 
                                            auto_escalate: e.target.checked 
                                        })}
                                        className="rounded"
                                    />
                                    <span className="text-sm font-medium">
                                        Auto-escalate if not approved
                                    </span>
                                </label>
                                {formData.auto_escalate && (
                                    <div className="ml-6">
                                        <label className="text-sm text-gray-600">
                                            Escalate after
                                        </label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                type="number"
                                                value={formData.escalation_hours}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    escalation_hours: parseInt(e.target.value) || 48 
                                                })}
                                                className="input w-20"
                                                min={1}
                                            />
                                            <span className="text-sm text-gray-600">hours</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateWorkflow}
                                disabled={!formData.name || formData.stages.length === 0}
                                className="btn-primary"
                            >
                                Create Workflow
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
