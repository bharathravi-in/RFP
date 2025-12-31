import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    effectiveTheme: 'light' | 'dark';
}

// Get the effective theme based on user preference and system settings
const getEffectiveTheme = (theme: Theme): 'light' | 'dark' => {
    if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }
    return theme;
};

// Apply theme to document
const applyTheme = (effectiveTheme: 'light' | 'dark') => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'light',
            effectiveTheme: 'light',
            setTheme: (theme: Theme) => {
                const effectiveTheme = getEffectiveTheme(theme);
                applyTheme(effectiveTheme);
                set({ theme, effectiveTheme });
            },
        }),
        {
            name: 'rfp-theme-storage',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    const effectiveTheme = getEffectiveTheme(state.theme);
                    applyTheme(effectiveTheme);
                    state.effectiveTheme = effectiveTheme;
                }
            },
        }
    )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const state = useThemeStore.getState();
        if (state.theme === 'system') {
            const effectiveTheme = e.matches ? 'dark' : 'light';
            applyTheme(effectiveTheme);
            useThemeStore.setState({ effectiveTheme });
        }
    });
}
