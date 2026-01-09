/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // New Premium Brand Colors
                background: {
                    DEFAULT: '#F8FAFC',
                    dark: '#0F172A',
                },
                surface: {
                    DEFAULT: '#FFFFFF',
                    elevated: '#F1F5F9',
                },

                // Primary Brand - Corporate Blue
                primary: {
                    DEFAULT: '#1f3c85',
                    hover: '#162d66',
                    light: '#e8ecf5',
                    50: '#e8ecf5',
                    100: '#d1d9eb',
                    200: '#a3b3d7',
                    300: '#758dc3',
                    400: '#4767af',
                    500: '#2a4d99',
                    600: '#1f3c85',
                    700: '#162d66',
                    800: '#0e1e47',
                    900: '#070f28',
                },

                // Accent - Teal/Cyan for highlights
                accent: {
                    DEFAULT: '#06B6D4',
                    light: '#ECFEFF',
                    dark: '#0891B2',
                },

                // Status colors
                success: {
                    DEFAULT: '#10B981',
                    light: '#D1FAE5',
                    dark: '#059669',
                },
                warning: {
                    DEFAULT: '#F59E0B',
                    light: '#FEF3C7',
                    dark: '#D97706',
                },
                error: {
                    DEFAULT: '#EF4444',
                    light: '#FEE2E2',
                    dark: '#DC2626',
                },

                // Text colors
                text: {
                    primary: '#0F172A',
                    secondary: '#475569',
                    muted: '#94A3B8',
                    inverse: '#FFFFFF',
                },

                // Border colors
                border: {
                    DEFAULT: '#E2E8F0',
                    light: '#F1F5F9',
                    focus: '#1f3c85',
                },
            },

            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
            },

            fontSize: {
                'xs': ['0.75rem', { lineHeight: '1rem' }],
                'sm': ['0.875rem', { lineHeight: '1.25rem' }],
                'base': ['0.9375rem', { lineHeight: '1.5rem' }],
                'lg': ['1.0625rem', { lineHeight: '1.75rem' }],
                'xl': ['1.25rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.5rem', { lineHeight: '2rem' }],
                '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
                '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
            },

            spacing: {
                'sidebar': '260px',
                'sidebar-collapsed': '72px',
                'content': '1.5rem',
                'section': '2rem',
            },

            borderRadius: {
                'card': '16px',
                'button': '10px',
                'input': '10px',
                'badge': '6px',
            },

            boxShadow: {
                'card': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
                'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
                'modal': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
                'button': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                'glow': '0 0 20px rgb(31 60 133 / 0.2)',
            },

            backgroundImage: {
                'gradient-brand': 'linear-gradient(135deg, #1f3c85 0%, #3b5998 50%, #5d7ab5 100%)',
                'gradient-brand-subtle': 'linear-gradient(135deg, #e8ecf5 0%, #f0f3f9 50%, #f5f7fc 100%)',
                'gradient-card': 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)',
                'gradient-dark': 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            },

            screens: {
                'xs': '475px',
                'sm': '640px',
                'md': '768px',
                'lg': '1024px',
                'xl': '1280px',
                '2xl': '1536px',
            },

            transitionDuration: {
                'fast': '150ms',
                'normal': '200ms',
                'slow': '300ms',
            },

            animation: {
                'fade-in': 'fadeIn 0.2s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-in-right': 'slideInRight 0.3s ease-out',
                'scale-in': 'scaleIn 0.15s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },

            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(16px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
        },
    },
    plugins: [],
}
