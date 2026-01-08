import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { vendorProfileApi, VendorCapability } from '@/api/vendorProfile';

interface CapabilityModalProps {
    capability: VendorCapability | null;
    onClose: () => void;
    onSave: () => void;
}

export default function CapabilityModal({ capability, onClose, onSave }: CapabilityModalProps) {
    const [formData, setFormData] = useState<Partial<VendorCapability>>({
        capability_name: '',
        description: '',
        years_of_experience: 0,
        expertise_level: 'intermediate',
        ...capability,
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (capability?.id) {
                await vendorProfileApi.updateCapability(capability.id, formData);
                toast.success('Capability updated');
            } else {
                await vendorProfileApi.addCapability(formData as VendorCapability);
                toast.success('Capability added');
            }
            onSave();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save capability');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{capability ? 'Edit Capability' : 'Add Capability'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Capability Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.capability_name}
                            onChange={(e) => setFormData({ ...formData, capability_name: e.target.value })}
                            className="input w-full"
                            placeholder="e.g., Cloud Infrastructure Management"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input w-full"
                            rows={3}
                            placeholder="Describe this capability and your expertise"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Years of Experience</label>
                            <input
                                type="number"
                                value={formData.years_of_experience}
                                onChange={(e) => setFormData({ ...formData, years_of_experience: parseInt(e.target.value) })}
                                className="input w-full"
                                min="0"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Expertise Level</label>
                            <select
                                value={formData.expertise_level}
                                onChange={(e) => setFormData({ ...formData, expertise_level: e.target.value })}
                                className="input w-full"
                            >
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="expert">Expert</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1">
                            {saving ? 'Saving...' : capability ? 'Update Capability' : 'Add Capability'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
