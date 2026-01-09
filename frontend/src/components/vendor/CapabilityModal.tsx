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
        technologies_used: [],
        use_cases: '',
        time_saved: '',
        demo_link: '',
        ...capability,
    });
    const [saving, setSaving] = useState(false);
    const [techInput, setTechInput] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (capability?.id) {
                await vendorProfileApi.updateCapability(capability.id, formData);
                toast.success('Accelerator updated');
            } else {
                await vendorProfileApi.addCapability(formData as VendorCapability);
                toast.success('Accelerator added');
            }
            onSave();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save accelerator');
        } finally {
            setSaving(false);
        }
    };

    const addTechnology = () => {
        if (techInput.trim() && !formData.technologies_used?.includes(techInput.trim())) {
            setFormData({
                ...formData,
                technologies_used: [...(formData.technologies_used || []), techInput.trim()]
            });
            setTechInput('');
        }
    };

    const removeTechnology = (tech: string) => {
        setFormData({
            ...formData,
            technologies_used: formData.technologies_used?.filter(t => t !== tech)
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{capability ? 'Edit Accelerator' : 'Add Accelerator'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Accelerator Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.capability_name}
                            onChange={(e) => setFormData({ ...formData, capability_name: e.target.value })}
                            className="input w-full"
                            placeholder="e.g., E-commerce Checkout POC, AI Chatbot Template"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input w-full"
                            rows={3}
                            placeholder="Describe this accelerator/POC and what it does"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Technologies Used</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={techInput}
                                onChange={(e) => setTechInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnology())}
                                className="input flex-1"
                                placeholder="e.g., React, Node.js, AWS"
                            />
                            <button type="button" onClick={addTechnology} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {formData.technologies_used?.map((tech) => (
                                <span key={tech} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm flex items-center gap-2">
                                    {tech}
                                    <button type="button" onClick={() => removeTechnology(tech)} className="hover:text-indigo-900">×</button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Use Cases</label>
                        <textarea
                            value={formData.use_cases}
                            onChange={(e) => setFormData({ ...formData, use_cases: e.target.value })}
                            className="input w-full"
                            rows={2}
                            placeholder="Where can this accelerator be used?"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Time Saved / Benefits</label>
                        <input
                            type="text"
                            value={formData.time_saved}
                            onChange={(e) => setFormData({ ...formData, time_saved: e.target.value })}
                            className="input w-full"
                            placeholder="e.g., Reduces development time by 40%, Saves 2 weeks"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Demo / Documentation Link</label>
                        <input
                            type="url"
                            value={formData.demo_link}
                            onChange={(e) => setFormData({ ...formData, demo_link: e.target.value })}
                            className="input w-full"
                            placeholder="https://demo.example.com or https://docs.example.com"
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1">
                            {saving ? 'Saving...' : capability ? 'Update Accelerator' : 'Add Accelerator'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
