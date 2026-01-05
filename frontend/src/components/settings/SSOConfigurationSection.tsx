/**
 * SSO Configuration Settings Component
 * 
 * Allows admins to configure SAML/OIDC single sign-on.
 */
import { useState, useEffect } from 'react';
import {
    ShieldCheckIcon,
    KeyIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ClipboardDocumentIcon,
    CloudIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface SSOConfig {
    id?: number;
    sso_type: 'saml' | 'oidc' | 'azure_ad' | 'okta' | 'google';
    is_enabled: boolean;
    enforce_sso: boolean;
    auto_provision_users: boolean;
    default_role: string;
    allowed_domains: string[];
    attribute_mapping: Record<string, string>;
    role_mapping: Record<string, string>;
    // SAML
    saml_entity_id?: string;
    saml_sso_url?: string;
    saml_certificate_configured?: boolean;
    // OIDC
    oidc_client_id?: string;
    oidc_issuer_url?: string;
    oidc_client_secret_configured?: boolean;
    // SP Metadata
    sp_entity_id?: string;
    sp_acs_url?: string;
    sp_metadata_url?: string;
    // Stats
    total_sso_logins?: number;
    last_login_at?: string;
}

const SSO_PROVIDERS = [
    { value: 'saml', label: 'SAML 2.0', description: 'Generic SAML identity provider', icon: '🔐' },
    { value: 'azure_ad', label: 'Microsoft Azure AD', description: 'Azure Active Directory / Entra ID', icon: '🔷' },
    { value: 'okta', label: 'Okta', description: 'Okta identity management', icon: '🅾️' },
    { value: 'google', label: 'Google Workspace', description: 'Google Cloud Identity', icon: '🔴' },
    { value: 'oidc', label: 'OpenID Connect', description: 'Generic OIDC provider', icon: '🔓' },
];

export default function SSOConfigurationSection() {
    const [config, setConfig] = useState<SSOConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Form state
    const [formData, setFormData] = useState<Partial<SSOConfig>>({
        sso_type: 'saml',
        is_enabled: false,
        enforce_sso: false,
        auto_provision_users: true,
        default_role: 'member',
        allowed_domains: [],
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/sso/config', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.config) {
                    setConfig(data.config);
                    setFormData(data.config);
                }
            }
        } catch (error) {
            console.error('Failed to fetch SSO config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/sso/config', {
                method: config ? 'PUT' : 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                const data = await response.json();
                setConfig(data.config);
                toast.success('SSO configuration saved');
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving SSO config:', error);
            toast.error('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/sso/config/test', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setTestResult(data);
                if (data.valid) {
                    toast.success('SSO configuration is valid');
                } else {
                    toast.error('Configuration has errors');
                }
            }
        } catch (error) {
            console.error('Error testing SSO config:', error);
            toast.error('Failed to test configuration');
        } finally {
            setTesting(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const selectedProvider = SSO_PROVIDERS.find(p => p.value === formData.sso_type);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-text-primary">Single Sign-On (SSO)</h2>
                    <p className="text-sm text-text-secondary">
                        Configure enterprise authentication with SAML or OIDC
                    </p>
                </div>
                {config?.is_enabled && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <CheckCircleIcon className="h-4 w-4" />
                        SSO Active
                    </div>
                )}
            </div>

            {/* Provider Selection */}
            <div className="bg-surface rounded-xl border border-border p-6">
                <h3 className="font-semibold text-text-primary mb-4">Identity Provider</h3>
                <div className="grid grid-cols-5 gap-3">
                    {SSO_PROVIDERS.map(provider => (
                        <button
                            key={provider.value}
                            onClick={() => setFormData({ ...formData, sso_type: provider.value as any })}
                            className={clsx(
                                'p-4 rounded-lg border-2 transition-all text-center',
                                formData.sso_type === provider.value
                                    ? 'border-primary bg-primary/5'
                                    : 'border-gray-200 hover:border-gray-300'
                            )}
                        >
                            <div className="text-2xl mb-2">{provider.icon}</div>
                            <div className="text-sm font-medium text-text-primary">{provider.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* SAML Configuration */}
            {formData.sso_type === 'saml' && (
                <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-text-primary">SAML Configuration</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                IdP Entity ID
                            </label>
                            <input
                                type="text"
                                value={formData.saml_entity_id || ''}
                                onChange={(e) => setFormData({ ...formData, saml_entity_id: e.target.value })}
                                className="input w-full"
                                placeholder="https://idp.example.com/entity"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                IdP SSO URL
                            </label>
                            <input
                                type="text"
                                value={formData.saml_sso_url || ''}
                                onChange={(e) => setFormData({ ...formData, saml_sso_url: e.target.value })}
                                className="input w-full"
                                placeholder="https://idp.example.com/sso"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            IdP X.509 Certificate
                        </label>
                        <textarea
                            value={(formData as any).saml_certificate || ''}
                            onChange={(e) => setFormData({ ...formData, saml_certificate: e.target.value } as any)}
                            className="input w-full font-mono text-xs"
                            rows={4}
                            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                        />
                    </div>
                </div>
            )}

            {/* OIDC Configuration */}
            {['oidc', 'azure_ad', 'okta', 'google'].includes(formData.sso_type || '') && (
                <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-text-primary">
                        {selectedProvider?.label} Configuration
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Client ID
                            </label>
                            <input
                                type="text"
                                value={formData.oidc_client_id || ''}
                                onChange={(e) => setFormData({ ...formData, oidc_client_id: e.target.value })}
                                className="input w-full"
                                placeholder="your-client-id"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Client Secret
                            </label>
                            <input
                                type="password"
                                value={(formData as any).oidc_client_secret || ''}
                                onChange={(e) => setFormData({ ...formData, oidc_client_secret: e.target.value } as any)}
                                className="input w-full"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {formData.sso_type === 'oidc' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Issuer URL
                            </label>
                            <input
                                type="text"
                                value={formData.oidc_issuer_url || ''}
                                onChange={(e) => setFormData({ ...formData, oidc_issuer_url: e.target.value })}
                                className="input w-full"
                                placeholder="https://your-idp.example.com"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* SP Metadata (for SAML) */}
            {formData.sso_type === 'saml' && config?.sp_entity_id && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 space-y-3">
                    <h3 className="font-semibold text-blue-900">Service Provider (SP) Metadata</h3>
                    <p className="text-sm text-blue-700">
                        Configure your Identity Provider with these values:
                    </p>
                    
                    <div className="space-y-2">
                        {[
                            { label: 'Entity ID', value: config.sp_entity_id },
                            { label: 'ACS URL', value: config.sp_acs_url },
                            { label: 'Metadata URL', value: config.sp_metadata_url },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-2">
                                <span className="text-sm font-medium text-blue-900 w-28">{item.label}:</span>
                                <code className="flex-1 text-sm bg-white px-2 py-1 rounded border border-blue-200 overflow-x-auto">
                                    {item.value}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(item.value || '', item.label)}
                                    className="p-1 text-blue-600 hover:text-blue-800"
                                >
                                    <ClipboardDocumentIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Settings */}
            <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
                <h3 className="font-semibold text-text-primary">Settings</h3>
                
                <div className="space-y-3">
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={formData.is_enabled || false}
                            onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                            className="rounded"
                        />
                        <div>
                            <span className="font-medium text-text-primary">Enable SSO</span>
                            <p className="text-sm text-text-secondary">Allow users to sign in with SSO</p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={formData.enforce_sso || false}
                            onChange={(e) => setFormData({ ...formData, enforce_sso: e.target.checked })}
                            className="rounded"
                        />
                        <div>
                            <span className="font-medium text-text-primary">Enforce SSO</span>
                            <p className="text-sm text-text-secondary">Require SSO, disable password login</p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={formData.auto_provision_users || false}
                            onChange={(e) => setFormData({ ...formData, auto_provision_users: e.target.checked })}
                            className="rounded"
                        />
                        <div>
                            <span className="font-medium text-text-primary">Auto-provision users</span>
                            <p className="text-sm text-text-secondary">Automatically create accounts for new SSO users</p>
                        </div>
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Default Role for New Users
                        </label>
                        <select
                            value={formData.default_role || 'member'}
                            onChange={(e) => setFormData({ ...formData, default_role: e.target.value })}
                            className="input w-full"
                        >
                            <option value="member">Member</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Allowed Email Domains (optional)
                        </label>
                        <input
                            type="text"
                            value={formData.allowed_domains?.join(', ') || ''}
                            onChange={(e) => setFormData({ 
                                ...formData, 
                                allowed_domains: e.target.value.split(',').map(d => d.trim()).filter(Boolean) 
                            })}
                            className="input w-full"
                            placeholder="@company.com, @subsidiary.com"
                        />
                    </div>
                </div>
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={clsx(
                    'rounded-xl border p-4',
                    testResult.valid
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                )}>
                    <div className="flex items-center gap-2 mb-2">
                        {testResult.valid ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        ) : (
                            <XCircleIcon className="h-5 w-5 text-red-600" />
                        )}
                        <span className={clsx(
                            'font-medium',
                            testResult.valid ? 'text-green-700' : 'text-red-700'
                        )}>
                            {testResult.valid ? 'Configuration Valid' : 'Configuration Invalid'}
                        </span>
                    </div>
                    
                    {testResult.errors.length > 0 && (
                        <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                            {testResult.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    )}
                    
                    {testResult.warnings.length > 0 && (
                        <ul className="list-disc list-inside text-sm text-amber-600 space-y-1 mt-2">
                            {testResult.warnings.map((warn, i) => (
                                <li key={i}>{warn}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                    onClick={handleTest}
                    disabled={testing || !config}
                    className="btn-secondary flex items-center gap-2"
                >
                    {testing ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                        <ShieldCheckIcon className="h-4 w-4" />
                    )}
                    Test Configuration
                </button>
                
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                >
                    {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                    Save Configuration
                </button>
            </div>

            {/* Stats */}
            {config?.total_sso_logins !== undefined && config.total_sso_logins > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">
                        Total SSO logins: <strong>{config.total_sso_logins}</strong>
                    </span>
                    {config.last_login_at && (
                        <span className="text-text-secondary">
                            Last login: {new Date(config.last_login_at).toLocaleDateString()}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
