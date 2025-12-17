import { useState, useCallback } from 'react';
import { projectsApi } from '@/api/client';
import { Project } from '@/types';
import toast from 'react-hot-toast';
import {
    XMarkIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface EditProjectModalProps {
    project: Project;
    onClose: () => void;
    onUpdated: (project: Project) => void;
}

const clientTypes = [
    { code: 'government', name: 'Government' },
    { code: 'private', name: 'Private Sector' },
    { code: 'enterprise', name: 'Enterprise' },
    { code: 'public_sector', name: 'Public Sector' },
    { code: 'ngo', name: 'NGO' },
    { code: 'smb', name: 'SMB' },
];

const geographies = [
    { code: 'GLOBAL', name: 'Global' },
    { code: 'US', name: 'United States' },
    { code: 'EU', name: 'European Union' },
    { code: 'UK', name: 'United Kingdom' },
    { code: 'APAC', name: 'Asia Pacific' },
    { code: 'IN', name: 'India' },
    { code: 'MEA', name: 'Middle East & Africa' },
    { code: 'LATAM', name: 'Latin America' },
];

const currencies = [
    { code: 'USD', name: 'US Dollar ($)' },
    { code: 'EUR', name: 'Euro (€)' },
    { code: 'GBP', name: 'British Pound (£)' },
    { code: 'INR', name: 'Indian Rupee (₹)' },
    { code: 'JPY', name: 'Japanese Yen (¥)' },
    { code: 'AUD', name: 'Australian Dollar (A$)' },
];

const industries = [
    { code: 'healthcare', name: 'Healthcare & Life Sciences' },
    { code: 'finance', name: 'Financial Services' },
    { code: 'technology', name: 'Technology & Software' },
    { code: 'defense', name: 'Defense & Aerospace' },
    { code: 'manufacturing', name: 'Manufacturing' },
    { code: 'energy', name: 'Energy & Utilities' },
    { code: 'retail', name: 'Retail & Consumer Goods' },
    { code: 'telecom', name: 'Telecommunications' },
];

const complianceOptions = [
    { code: 'SOC2', name: 'SOC2' },
    { code: 'ISO27001', name: 'ISO 27001' },
    { code: 'GDPR', name: 'GDPR' },
    { code: 'HIPAA', name: 'HIPAA' },
    { code: 'PCI_DSS', name: 'PCI DSS' },
    { code: 'FISMA', name: 'FISMA' },
    { code: 'FedRAMP', name: 'FedRAMP' },
    { code: 'NIST', name: 'NIST' },
];

export default function EditProjectModal({
    project,
    onClose,
    onUpdated,
}: EditProjectModalProps) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || '');
    const [clientName, setClientName] = useState(project.client_name || '');
    const [clientType, setClientType] = useState(project.client_type || '');
    const [geography, setGeography] = useState(project.geography || '');
    const [currency, setCurrency] = useState(project.currency || '');
    const [industry, setIndustry] = useState(project.industry || '');
    const [dueDate, setDueDate] = useState(
        project.due_date ? project.due_date.split('T')[0] : ''
    );
    const [status, setStatus] = useState(project.status || 'draft');
    const [complianceRequirements, setComplianceRequirements] = useState(
        project.compliance_requirements || []
    );
    const [isLoading, setIsLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleComplianceToggle = useCallback((code: string) => {
        setComplianceRequirements((prev) =>
            prev.includes(code)
                ? prev.filter((c) => c !== code)
                : [...prev, code]
        );
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Project name is required');
            return;
        }

        setIsLoading(true);
        try {
            const response = await projectsApi.update(project.id, {
                name,
                description,
                status,
                due_date: dueDate || null,
                client_name: clientName || undefined,
                client_type: clientType || undefined,
                geography: geography || undefined,
                currency: currency || undefined,
                industry: industry || undefined,
                compliance_requirements: complianceRequirements,
            });
            toast.success('Project updated!');
            onUpdated(response.data.project);
            onClose();
        } catch {
            toast.error('Failed to update project');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-modal w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-text-primary">Edit Project</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-background rounded-lg transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <span className="text-lg">📋</span>
                            Basic Information
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Project Name *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="input"
                                    placeholder="e.g., Enterprise Security RFP"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="input"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="review">In Review</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="input resize-none"
                                placeholder="Project description and goals..."
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* Client Information */}
                    <div className="space-y-4 border-t border-border pt-4">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <span className="text-lg">🏢</span>
                            Client Information
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Client Name
                                </label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="input"
                                    placeholder="Name of the client/buyer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Client Type
                                </label>
                                <select
                                    value={clientType}
                                    onChange={(e) => setClientType(e.target.value)}
                                    className="input"
                                >
                                    <option value="">Select client type</option>
                                    {clientTypes.map((type) => (
                                        <option key={type.code} value={type.code}>
                                            {type.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Project Context */}
                    <div className="space-y-4 border-t border-border pt-4">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <span className="text-lg">🌍</span>
                            Project Context
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Geography
                                </label>
                                <select
                                    value={geography}
                                    onChange={(e) => setGeography(e.target.value)}
                                    className="input"
                                >
                                    <option value="">Select geography</option>
                                    {geographies.map((geo) => (
                                        <option key={geo.code} value={geo.code}>
                                            {geo.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Industry
                                </label>
                                <select
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                    className="input"
                                >
                                    <option value="">Select industry</option>
                                    {industries.map((ind) => (
                                        <option key={ind.code} value={ind.code}>
                                            {ind.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Currency
                                </label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="input"
                                >
                                    <option value="">Select currency</option>
                                    {currencies.map((curr) => (
                                        <option key={curr.code} value={curr.code}>
                                            {curr.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-2">
                                    Due Date
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Compliance Requirements */}
                    <div className="space-y-4 border-t border-border pt-4">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <span className="text-lg">🔒</span>
                            Compliance Requirements
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                            {complianceOptions.map((compliance) => (
                                <label
                                    key={compliance.code}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-background cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={complianceRequirements.includes(compliance.code)}
                                        onChange={() => handleComplianceToggle(compliance.code)}
                                        className="checkbox"
                                    />
                                    <span className="text-sm text-text-primary">{compliance.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-6 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 btn-primary"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
