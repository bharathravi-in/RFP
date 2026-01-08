import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { vendorProfileApi, VendorClient } from '@/api/vendorProfile';

interface ClientModalProps {
    client: VendorClient | null;
    onClose: () => void;
    onSave: () => void;
}

export default function ClientModal({ client, onClose, onSave }: ClientModalProps) {
    const [formData, setFormData] = useState<Partial<VendorClient>>({
        client_name: '',
        client_industry: '',
        client_size: 'medium',
        client_location: '',
        client_type: 'private',
        relationship_status: 'ongoing',
        project_count: 1,
        services_provided: [],
        technologies_used: [],
        is_reference_available: false,
        is_public: true,
        ...client,
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (client?.id) {
                await vendorProfileApi.updateClient(client.id, formData);
                toast.success('Client updated successfully');
            } else {
                await vendorProfileApi.addClient(formData as VendorClient);
                toast.success('Client added successfully');
            }
            onSave();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save client');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{client ? 'Edit Client' : 'Add Client'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Client Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.client_name}
                            onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                            className="input w-full"
                            placeholder="e.g., Facebook, Microsoft"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Industry</label>
                            <input
                                type="text"
                                value={formData.client_industry}
                                onChange={(e) => setFormData({ ...formData, client_industry: e.target.value })}
                                className="input w-full"
                                placeholder="e.g., Technology"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Client Size</label>
                            <select
                                value={formData.client_size}
                                onChange={(e) => setFormData({ ...formData, client_size: e.target.value })}
                                className="input w-full"
                            >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="enterprise">Enterprise</option>
                                <option value="fortune500">Fortune 500</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Location</label>
                            <input
                                type="text"
                                value={formData.client_location}
                                onChange={(e) => setFormData({ ...formData, client_location: e.target.value })}
                                className="input w-full"
                                placeholder="e.g., San Francisco, CA"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Relationship Status</label>
                            <select
                                value={formData.relationship_status}
                                onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value })}
                                className="input w-full"
                            >
                                <option value="ongoing">Ongoing</option>
                                <option value="completed">Completed</option>
                                <option value="paused">Paused</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input w-full"
                            rows={3}
                            placeholder="Brief description of your work with this client"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.is_reference_available}
                                onChange={(e) => setFormData({ ...formData, is_reference_available: e.target.checked })}
                                className="rounded"
                            />
                            <span className="text-sm">Reference Available</span>
                        </label>

                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.is_public}
                                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                                className="rounded"
                            />
                            <span className="text-sm">Public (show in proposals)</span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1">
                            {saving ? 'Saving...' : client ? 'Update Client' : 'Add Client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
