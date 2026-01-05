import { useState, useEffect } from 'react';
import {
    SwatchIcon,
    PhotoIcon,
    CheckIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface BrandingSettings {
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    company_name: string;
}

const defaultBranding: BrandingSettings = {
    logo_url: '',
    primary_color: '#6366f1',
    secondary_color: '#8b5cf6',
    accent_color: '#06b6d4',
    company_name: '',
};

function ColorPicker({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">{label}</label>
            <div className="flex items-center gap-3">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-border"
                />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#6366f1"
                    className="flex-1 px-3 py-2 border border-border rounded-lg bg-white text-sm font-mono"
                />
            </div>
        </div>
    );
}

export default function BrandingSettings() {
    const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFeature, setHasFeature] = useState(true);

    useEffect(() => {
        loadBranding();
    }, []);

    const loadBranding = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/organizations/branding', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) throw new Error('Failed to load branding');

            const data = await response.json();
            if (data.branding) {
                setBranding({ ...defaultBranding, ...data.branding });
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveBranding = async () => {
        try {
            setSaving(true);
            setError(null);

            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/organizations/branding', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(branding),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.error?.includes('not available')) {
                    setHasFeature(false);
                }
                throw new Error(data.error || 'Failed to save');
            }

            toast.success('Branding saved successfully');

            // Apply branding to document
            applyBranding(branding);
        } catch (err: any) {
            toast.error(err.message);
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const applyBranding = (b: BrandingSettings) => {
        document.documentElement.style.setProperty('--color-primary-600', b.primary_color);
        document.documentElement.style.setProperty('--color-secondary-600', b.secondary_color);
        document.documentElement.style.setProperty('--color-accent-600', b.accent_color);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary">Branding Settings</h2>
                <p className="text-text-muted">Customize your organization's look and feel</p>
            </div>

            {!hasFeature && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                        <p className="font-medium text-yellow-800">Custom Branding Not Available</p>
                        <p className="text-sm text-yellow-700">
                            Upgrade to Professional or Enterprise to customize your branding.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-border p-6 space-y-6">
                {/* Logo URL */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-text-primary">
                        <PhotoIcon className="h-4 w-4 inline mr-2" />
                        Logo URL
                    </label>
                    <input
                        type="url"
                        value={branding.logo_url}
                        onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                        placeholder="https://example.com/logo.png"
                        className="w-full px-3 py-2 border border-border rounded-lg"
                        disabled={!hasFeature}
                    />
                    {branding.logo_url && (
                        <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                            <p className="text-xs text-text-muted mb-2">Preview:</p>
                            <img
                                src={branding.logo_url}
                                alt="Logo preview"
                                className="h-10 object-contain"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        </div>
                    )}
                </div>

                {/* Company Name */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-text-primary">Company Name</label>
                    <input
                        type="text"
                        value={branding.company_name}
                        onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
                        placeholder="Your Company"
                        className="w-full px-3 py-2 border border-border rounded-lg"
                        disabled={!hasFeature}
                    />
                </div>

                {/* Colors */}
                <div className="pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <SwatchIcon className="h-4 w-4" />
                        Brand Colors
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ColorPicker
                            label="Primary"
                            value={branding.primary_color}
                            onChange={(v) => setBranding({ ...branding, primary_color: v })}
                        />
                        <ColorPicker
                            label="Secondary"
                            value={branding.secondary_color}
                            onChange={(v) => setBranding({ ...branding, secondary_color: v })}
                        />
                        <ColorPicker
                            label="Accent"
                            value={branding.accent_color}
                            onChange={(v) => setBranding({ ...branding, accent_color: v })}
                        />
                    </div>
                </div>

                {/* Preview */}
                <div className="pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold text-text-primary mb-4">Preview</h3>
                    <div className="flex items-center gap-3">
                        <button
                            style={{ backgroundColor: branding.primary_color }}
                            className="px-4 py-2 text-white rounded-lg font-medium"
                        >
                            Primary Button
                        </button>
                        <button
                            style={{ backgroundColor: branding.secondary_color }}
                            className="px-4 py-2 text-white rounded-lg font-medium"
                        >
                            Secondary
                        </button>
                        <button
                            style={{ backgroundColor: branding.accent_color }}
                            className="px-4 py-2 text-white rounded-lg font-medium"
                        >
                            Accent
                        </button>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={saveBranding}
                    disabled={saving || !hasFeature}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-medium hover:from-primary-700 hover:to-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                        <CheckIcon className="h-4 w-4" />
                    )}
                    Save Branding
                </button>
            </div>

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
        </div>
    );
}
