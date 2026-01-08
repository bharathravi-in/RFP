import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { vendorProfileApi, VendorTestimonial } from '@/api/vendorProfile';

interface TestimonialModalProps {
    testimonial: VendorTestimonial | null;
    onClose: () => void;
    onSave: () => void;
}

export default function TestimonialModal({ testimonial, onClose, onSave }: TestimonialModalProps) {
    const [formData, setFormData] = useState<Partial<VendorTestimonial>>({
        testimonial_text: '',
        client_name: '',
        client_designation: '',
        client_company: '',
        rating: 5,
        ...testimonial,
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (testimonial?.id) {
                await vendorProfileApi.updateTestimonial(testimonial.id, formData);
                toast.success('Testimonial updated');
            } else {
                await vendorProfileApi.addTestimonial(formData as VendorTestimonial);
                toast.success('Testimonial added');
            }
            onSave();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save testimonial');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{testimonial ? 'Edit Testimonial' : 'Add Testimonial'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Testimonial Text *</label>
                        <textarea
                            required
                            value={formData.testimonial_text}
                            onChange={(e) => setFormData({ ...formData, testimonial_text: e.target.value })}
                            className="input w-full"
                            rows={4}
                            placeholder="Enter the testimonial from your client..."
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
                                placeholder="e.g., John Smith"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Designation</label>
                            <input
                                type="text"
                                value={formData.client_designation}
                                onChange={(e) => setFormData({ ...formData, client_designation: e.target.value })}
                                className="input w-full"
                                placeholder="e.g., CTO"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Company</label>
                        <input
                            type="text"
                            value={formData.client_company}
                            onChange={(e) => setFormData({ ...formData, client_company: e.target.value })}
                            className="input w-full"
                            placeholder="e.g., Acme Corporation"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Rating</label>
                        <select
                            value={formData.rating}
                            onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                            className="input w-full"
                        >
                            <option value={5}>5 Stars</option>
                            <option value={4}>4 Stars</option>
                            <option value={3}>3 Stars</option>
                            <option value={2}>2 Stars</option>
                            <option value={1}>1 Star</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1">
                            {saving ? 'Saving...' : testimonial ? 'Update Testimonial' : 'Add Testimonial'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
