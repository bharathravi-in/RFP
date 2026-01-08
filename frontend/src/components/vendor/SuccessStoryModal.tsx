import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { vendorProfileApi, VendorSuccessStory } from '@/api/vendorProfile';

interface SuccessStoryModalProps {
    story: VendorSuccessStory | null;
    onClose: () => void;
    onSave: () => void;
}

export default function SuccessStoryModal({ story, onClose, onSave }: SuccessStoryModalProps) {
    const [formData, setFormData] = useState<Partial<VendorSuccessStory>>({
        title: '',
        client_name: '',
        industry: '',
        challenge: '',
        solution: '',
        impact: '',
        ...story,
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (story?.id) {
                await vendorProfileApi.updateSuccessStory(story.id, formData);
                toast.success('Success story updated');
            } else {
                await vendorProfileApi.addSuccessStory(formData as VendorSuccessStory);
                toast.success('Success story added');
            }
            onSave();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save story');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{story ? 'Edit Success Story' : 'Add Success Story'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Story Title *</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="input w-full"
                            placeholder="e.g., Ad Platform Optimization for Facebook"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Client Name</label>
                            <input
                                type="text"
                                value={formData.client_name}
                                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                                className="input w-full"
                                placeholder="e.g., Facebook"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Industry</label>
                            <input
                                type="text"
                                value={formData.industry}
                                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                className="input w-full"
                                placeholder="e.g., Social Media"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Challenge</label>
                        <textarea
                            value={formData.challenge}
                            onChange={(e) => setFormData({ ...formData, challenge: e.target.value })}
                            className="input w-full"
                            rows={3}
                            placeholder="What problem did the client face?"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Solution</label>
                        <textarea
                            value={formData.solution}
                            onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                            className="input w-full"
                            rows={3}
                            placeholder="What solution did you implement?"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Impact & Results</label>
                        <textarea
                            value={formData.impact}
                            onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                            className="input w-full"
                            rows={3}
                            placeholder="What were the measurable outcomes?"
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1">
                            {saving ? 'Saving...' : story ? 'Update Story' : 'Add Story'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
