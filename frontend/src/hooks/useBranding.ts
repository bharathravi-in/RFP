import { useEffect, useState } from 'react';

interface Branding {
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    company_name: string;
}

/**
 * Hook to load and apply organization branding.
 * Fetches branding from API and applies as CSS custom properties.
 */
export function useBranding() {
    const [branding, setBranding] = useState<Branding | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBranding();
    }, []);

    const loadBranding = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/organizations/branding', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.branding) {
                    setBranding(data.branding);
                    applyBranding(data.branding);
                }
            }
        } catch (error) {
            console.error('Failed to load branding:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyBranding = (b: Branding) => {
        if (!b) return;

        const root = document.documentElement;

        // Apply primary color and its variations
        if (b.primary_color) {
            root.style.setProperty('--brand-primary', b.primary_color);
            // Override Tailwind primary colors
            root.style.setProperty('--color-primary', b.primary_color);
        }

        // Apply secondary color
        if (b.secondary_color) {
            root.style.setProperty('--brand-secondary', b.secondary_color);
        }

        // Apply accent color
        if (b.accent_color) {
            root.style.setProperty('--brand-accent', b.accent_color);
        }

        console.log('Branding applied:', b);
    };

    return { branding, loading, reload: loadBranding };
}
