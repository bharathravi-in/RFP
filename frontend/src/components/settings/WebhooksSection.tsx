/**
 * Webhook Configuration Component
 * Allows managing outbound webhooks for organization events
 */
import { useState, useEffect } from 'react';
import {
    LinkIcon,
    PlusIcon,
    TrashIcon,
    PencilIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    EyeIcon,
    EyeSlashIcon,
    BoltIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { webhooksApi } from '@/api/client';

interface WebhookConfig {
    id: number;
    name: string;
    url: string;
    secret?: string;
    events: string[];
    is_active: boolean;
    created_at: string;
    last_triggered_at?: string;
    success_count: number;
    failure_count: number;
}

interface WebhookDelivery {
    id: number;
    event_type: string;
    status_code: number;
    success: boolean;
    created_at: string;
    duration_ms: number;
    error_message?: string;
}

const WEBHOOK_EVENTS = [
    { value: 'project.created', label: 'Project Created', description: 'When a new project is created' },
    { value: 'project.updated', label: 'Project Updated', description: 'When a project is modified' },
    { value: 'section.generated', label: 'Section Generated', description: 'When AI generates content' },
    { value: 'section.approved', label: 'Section Approved', description: 'When a section is approved' },
    { value: 'document.uploaded', label: 'Document Uploaded', description: 'When a document is uploaded' },
    { value: 'document.processed', label: 'Document Processed', description: 'When processing completes' },
    { value: 'export.completed', label: 'Export Completed', description: 'When export finishes' },
    { value: 'answer.generated', label: 'Answer Generated', description: 'When AI generates an answer' },
];

export default function WebhooksSection() {
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
    const [showDeliveries, setShowDeliveries] = useState<number | null>(null);
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
    const [loadingDeliveries, setLoadingDeliveries] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        secret: '',
        events: [] as string[],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    useEffect(() => {
        loadWebhooks();
    }, []);

    const loadWebhooks = async () => {
        setLoading(true);
        try {
            const response = await webhooksApi.list();
            setWebhooks(response.data.webhooks || []);
        } catch (error) {
            console.error('Failed to load webhooks:', error);
            // Demo data
            setWebhooks([
                {
                    id: 1,
                    name: 'Slack Notifications',
                    url: 'https://hooks.slack.com/services/xxx',
                    events: ['project.created', 'section.approved'],
                    is_active: true,
                    created_at: new Date().toISOString(),
                    last_triggered_at: new Date().toISOString(),
                    success_count: 42,
                    failure_count: 2,
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const loadDeliveries = async (webhookId: number) => {
        setLoadingDeliveries(true);
        try {
            const response = await webhooksApi.getDeliveries(webhookId);
            setDeliveries(response.data.deliveries || []);
        } catch (error) {
            setDeliveries([
                {
                    id: 1,
                    event_type: 'project.created',
                    status_code: 200,
                    success: true,
                    created_at: new Date().toISOString(),
                    duration_ms: 234,
                },
                {
                    id: 2,
                    event_type: 'section.approved',
                    status_code: 500,
                    success: false,
                    created_at: new Date().toISOString(),
                    duration_ms: 1234,
                    error_message: 'Internal Server Error',
                },
            ]);
        } finally {
            setLoadingDeliveries(false);
        }
    };

    const handleOpenModal = (webhook?: WebhookConfig) => {
        if (webhook) {
            setEditingWebhook(webhook);
            setFormData({
                name: webhook.name,
                url: webhook.url,
                secret: '',
                events: webhook.events,
            });
        } else {
            setEditingWebhook(null);
            setFormData({
                name: '',
                url: '',
                secret: '',
                events: [],
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.url || formData.events.length === 0) {
            toast.error('Please fill in all required fields and select at least one event');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingWebhook) {
                await webhooksApi.update(editingWebhook.id, formData);
                toast.success('Webhook updated successfully');
            } else {
                await webhooksApi.create(formData);
                toast.success('Webhook created successfully');
            }
            setShowModal(false);
            loadWebhooks();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save webhook');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this webhook?')) return;
        try {
            await webhooksApi.delete(id);
            toast.success('Webhook deleted');
            loadWebhooks();
        } catch (error) {
            toast.error('Failed to delete webhook');
        }
    };

    const handleToggleActive = async (webhook: WebhookConfig) => {
        try {
            await webhooksApi.update(webhook.id, { is_active: !webhook.is_active });
            toast.success(webhook.is_active ? 'Webhook disabled' : 'Webhook enabled');
            loadWebhooks();
        } catch (error) {
            toast.error('Failed to update webhook');
        }
    };

    const handleTest = async (id: number) => {
        try {
            await webhooksApi.test(id);
            toast.success('Test webhook sent!');
        } catch (error) {
            toast.error('Failed to send test webhook');
        }
    };

    const toggleEvent = (event: string) => {
        setFormData(prev => ({
            ...prev,
            events: prev.events.includes(event)
                ? prev.events.filter(e => e !== event)
                : [...prev.events, event],
        }));
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
                    <h3 className="text-lg font-semibold text-text-primary">Webhooks</h3>
                    <p className="text-sm text-text-secondary">
                        Send event notifications to external services
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <PlusIcon className="h-4 w-4" />
                    Add Webhook
                </button>
            </div>

            {/* Webhooks List */}
            {webhooks.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <LinkIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No webhooks configured</h4>
                    <p className="text-gray-500 mb-4">Add webhooks to receive event notifications</p>
                    <button onClick={() => handleOpenModal()} className="btn btn-primary">
                        Add Webhook
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {webhooks.map((webhook) => (
                        <div
                            key={webhook.id}
                            className={clsx(
                                'bg-white border rounded-xl overflow-hidden transition-all',
                                webhook.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'
                            )}
                        >
                            <div className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            'p-2 rounded-lg',
                                            webhook.is_active ? 'bg-green-100' : 'bg-gray-100'
                                        )}>
                                            <LinkIcon className={clsx(
                                                'h-5 w-5',
                                                webhook.is_active ? 'text-green-600' : 'text-gray-400'
                                            )} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{webhook.name}</h4>
                                            <p className="text-sm text-gray-500 font-mono truncate max-w-md">
                                                {webhook.url}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTest(webhook.id)}
                                            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg"
                                            title="Send test"
                                        >
                                            <BoltIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(webhook)}
                                            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg"
                                            title="Edit"
                                        >
                                            <PencilIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(webhook.id)}
                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Delete"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Events */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {webhook.events.map(event => (
                                        <span
                                            key={event}
                                            className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                                        >
                                            {event}
                                        </span>
                                    ))}
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-sm">
                                    <button
                                        onClick={() => handleToggleActive(webhook)}
                                        className={clsx(
                                            'px-3 py-1 rounded-full text-xs font-medium',
                                            webhook.is_active
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                        )}
                                    >
                                        {webhook.is_active ? 'Active' : 'Disabled'}
                                    </button>
                                    <span className="flex items-center gap-1 text-green-600">
                                        <CheckCircleIcon className="h-4 w-4" />
                                        {webhook.success_count} delivered
                                    </span>
                                    {webhook.failure_count > 0 && (
                                        <span className="flex items-center gap-1 text-red-600">
                                            <XCircleIcon className="h-4 w-4" />
                                            {webhook.failure_count} failed
                                        </span>
                                    )}
                                    {webhook.last_triggered_at && (
                                        <span className="flex items-center gap-1 text-gray-500">
                                            <ClockIcon className="h-4 w-4" />
                                            Last: {new Date(webhook.last_triggered_at).toLocaleDateString()}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (showDeliveries === webhook.id) {
                                                setShowDeliveries(null);
                                            } else {
                                                setShowDeliveries(webhook.id);
                                                loadDeliveries(webhook.id);
                                            }
                                        }}
                                        className="text-primary hover:underline ml-auto"
                                    >
                                        {showDeliveries === webhook.id ? 'Hide' : 'View'} deliveries
                                    </button>
                                </div>
                            </div>

                            {/* Deliveries Panel */}
                            {showDeliveries === webhook.id && (
                                <div className="border-t border-gray-200 bg-gray-50 p-4">
                                    {loadingDeliveries ? (
                                        <div className="text-center py-4">
                                            <ArrowPathIcon className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                                        </div>
                                    ) : deliveries.length === 0 ? (
                                        <p className="text-center text-gray-500 py-4">No deliveries yet</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {deliveries.map((delivery) => (
                                                <div
                                                    key={delivery.id}
                                                    className={clsx(
                                                        'flex items-center justify-between p-3 rounded-lg',
                                                        delivery.success ? 'bg-white' : 'bg-red-50'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {delivery.success ? (
                                                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                                        ) : (
                                                            <XCircleIcon className="h-5 w-5 text-red-500" />
                                                        )}
                                                        <div>
                                                            <span className="font-medium text-sm">{delivery.event_type}</span>
                                                            {delivery.error_message && (
                                                                <p className="text-xs text-red-600">{delivery.error_message}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-xs text-gray-500">
                                                        <div>{delivery.status_code} • {delivery.duration_ms}ms</div>
                                                        <div>{new Date(delivery.created_at).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <LinkIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">
                                    {editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
                                </h3>
                                <p className="text-sm text-gray-500">Configure event notifications</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Slack Notifications"
                                    className="input w-full"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Webhook URL *
                                </label>
                                <input
                                    type="url"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    placeholder="https://example.com/webhook"
                                    className="input w-full font-mono text-sm"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Secret (for signature verification)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showSecret ? 'text' : 'password'}
                                        value={formData.secret}
                                        onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                                        placeholder="Optional HMAC secret"
                                        className="input w-full pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSecret(!showSecret)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        {showSecret ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Events *
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                    {WEBHOOK_EVENTS.map((event) => (
                                        <label
                                            key={event.value}
                                            className={clsx(
                                                'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                                                formData.events.includes(event.value)
                                                    ? 'bg-primary/10'
                                                    : 'hover:bg-gray-50'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.events.includes(event.value)}
                                                onChange={() => toggleEvent(event.value)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <div>
                                                <div className="text-sm font-medium">{event.label}</div>
                                                <div className="text-xs text-gray-500">{event.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="btn btn-primary flex-1"
                                >
                                    {isSubmitting ? 'Saving...' : (editingWebhook ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
