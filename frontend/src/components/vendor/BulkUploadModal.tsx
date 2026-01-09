import { useState } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface BulkUploadModalProps {
    type: 'clients' | 'stories' | 'capabilities' | 'testimonials';
    onClose: () => void;
    onUpload: (file: File) => Promise<void>;
}

const TEMPLATES = {
    clients: {
        title: 'Clients',
        columns: [
            { name: 'client_name', required: true, description: 'Name of the client' },
            { name: 'client_industry', required: false, description: 'Industry sector' },
            { name: 'client_size', required: false, description: 'small/medium/large/enterprise' },
            { name: 'client_location', required: false, description: 'Geographic location' },
            { name: 'client_type', required: false, description: 'private/public/government/nonprofit' },
            { name: 'relationship_status', required: false, description: 'ongoing/completed/paused' },
            { name: 'project_count', required: false, description: 'Number of projects (default: 1)' },
            { name: 'services_provided', required: false, description: 'Comma-separated services' },
            { name: 'technologies_used', required: false, description: 'Comma-separated technologies' },
            { name: 'is_reference_available', required: false, description: 'true/false (default: false)' },
            { name: 'is_public', required: false, description: 'true/false (default: true)' },
        ],
        example: 'Acme Corp,Technology,enterprise,San Francisco,private,ongoing,5,"Web Development,Cloud Migration","React,AWS,Python",true,true'
    },
    stories: {
        title: 'Success Stories',
        columns: [
            { name: 'title', required: true, description: 'Story title' },
            { name: 'client_name', required: false, description: 'Client name (can be anonymized)' },
            { name: 'industry', required: false, description: 'Client industry' },
            { name: 'challenge', required: false, description: 'Problem statement' },
            { name: 'solution', required: false, description: 'How you solved it' },
            { name: 'impact', required: false, description: 'Results achieved' },
        ],
        example: 'Digital Transformation Project,Global Retail Inc,Retail,Legacy systems causing delays,Implemented cloud-native architecture,50% faster processing and reduced costs by 40%'
    },
    capabilities: {
        title: 'Accelerators',
        columns: [
            { name: 'capability_name', required: true, description: 'Name of the accelerator/POC' },
            { name: 'description', required: false, description: 'What this accelerator does' },
            { name: 'technologies_used', required: false, description: 'Comma-separated technologies (e.g., React,Node.js,AWS)' },
            { name: 'use_cases', required: false, description: 'Where this can be applied' },
            { name: 'time_saved', required: false, description: 'Benefits (e.g., "Reduces dev time by 40%")' },
            { name: 'demo_link', required: false, description: 'Demo or documentation URL' },
        ],
        example: 'E-commerce Checkout POC,Complete payment integration with Stripe and PayPal,"React,Node.js,Stripe,PayPal",E-commerce websites requiring fast checkout,Reduces checkout implementation by 2 weeks,https://demo.example.com'
    },
    testimonials: {
        title: 'Testimonials',
        columns: [
            { name: 'testimonial_text', required: true, description: 'Testimonial content' },
            { name: 'client_name', required: false, description: 'Client name' },
            { name: 'client_designation', required: false, description: 'Job title' },
            { name: 'client_company', required: false, description: 'Company name' },
            { name: 'rating', required: false, description: 'Rating 1-5 (default: 5)' },
        ],
        example: '"Exceptional team that delivered beyond our expectations. Their expertise in cloud migration saved us months of work.",John Smith,CTO,Acme Corp,5'
    }
};

export default function BulkUploadModal({ type, onClose, onUpload }: BulkUploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const template = TEMPLATES[type];

    const handleDownloadTemplate = () => {
        // Create CSV content with headers and example
        const headers = template.columns.map(col => col.name).join(',');
        const csvContent = `${headers}\n${template.example}`;

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_template.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success('Template downloaded');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const extension = selectedFile.name.split('.').pop()?.toLowerCase();
            if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
                setFile(selectedFile);
            } else {
                toast.error('Please upload a CSV or Excel file');
            }
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            const extension = droppedFile.name.split('.').pop()?.toLowerCase();
            if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
                setFile(droppedFile);
            } else {
                toast.error('Please upload a CSV or Excel file');
            }
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Please select a file');
            return;
        }

        setUploading(true);
        try {
            await onUpload(file);
            toast.success('Upload completed successfully');
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Bulk Upload {template.title}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 mb-2">📋 Upload Instructions</h3>
                        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                            <li>Download the template CSV file below</li>
                            <li>Fill in your data following the column structure</li>
                            <li>Save as CSV or Excel (.xlsx, .xls)</li>
                            <li>Upload your completed file</li>
                            <li>Required fields are marked with * in the table below</li>
                        </ul>
                    </div>

                    {/* Download Template */}
                    <div>
                        <button
                            onClick={handleDownloadTemplate}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                            Download Template CSV
                        </button>
                    </div>

                    {/* Column Structure */}
                    <div>
                        <h3 className="font-semibold mb-3">Required Column Structure:</h3>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Column Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {template.columns.map((col, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-sm font-mono text-gray-900">
                                                {col.name}
                                                {col.required && <span className="text-red-500 ml-1">*</span>}
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                                {col.required ? (
                                                    <span className="text-red-600 font-semibold">Yes</span>
                                                ) : (
                                                    <span className="text-gray-500">No</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-600">{col.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* File Upload Area */}
                    <div>
                        <h3 className="font-semibold mb-3">Upload File:</h3>
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
                                }`}
                        >
                            <DocumentArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            {file ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="text-sm text-red-600 hover:text-red-700"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Drag and drop your CSV or Excel file here, or
                                    </p>
                                    <label className="inline-block cursor-pointer">
                                        <span className="text-indigo-600 hover:text-indigo-700 font-medium">
                                            browse files
                                        </span>
                                        <input
                                            type="file"
                                            accept=".csv,.xlsx,.xls"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                    <p className="text-xs text-gray-500 mt-2">Supported: CSV, XLSX, XLS</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {uploading ? 'Uploading...' : 'Upload & Import'}
                    </button>
                </div>
            </div>
        </div>
    );
}
