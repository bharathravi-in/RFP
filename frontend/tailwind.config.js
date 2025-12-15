/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Background colors
                background: '#F8FAFC',
                surface: '#FFFFFF',

                // Primary brand color
                primary: {
                    DEFAULT: '#2563EB',
                    hover: '#1D4ED8',
                    light: '#DBEAFE',
                    50: '#EFF6FF',
                    100: '#DBEAFE',
                    200: '#BFDBFE',
                    300: '#93C5FD',
                    400: '#60A5FA',
                    500: '#3B82F6',
                    600: '#2563EB',
                    700: '#1D4ED8',
                    800: '#1E40AF',
                    900: '#1E3A8A',
                },

                // Status colors
                success: {
                    DEFAULT: '#16A34A',
                    light: '#DCFCE7',
                },
                warning: {
                    DEFAULT: '#D97706',
                    light: '#FEF3C7',
                },
                error: {
                    DEFAULT: '#DC2626',
                    light: '#FEE2E2',
                },

                // Text colors
                text: {
                    primary: '#1E293B',
                    secondary: '#64748B',
                    muted: '#94A3B8',
                },

                // Border colors
                border: {
                    DEFAULT: '#E2E8F0',
                    light: '#F1F5F9',
                },
            },

            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },

            fontSize: {
                'xs': ['12px', { lineHeight: '16px' }],
                'sm': ['14px', { lineHeight: '20px' }],
                'base': ['14px', { lineHeight: '24px' }],
                'lg': ['16px', { lineHeight: '24px' }],
                'xl': ['20px', { lineHeight: '28px', fontWeight: '600' }],
                '2xl': ['24px', { lineHeight: '32px', fontWeight: '600' }],
                '3xl': ['28px', { lineHeight: '36px', fontWeight: '600' }],
            },

            spacing: {
                'sidebar': '240px',
                'content': '24px',
            },

            borderRadius: {
                'card': '12px',
                'button': '8px',
                'input': '8px',
            },

            boxShadow: {
                'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                'modal': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
            },

            transitionDuration: {
                'fast': '150ms',
                'normal': '200ms',
            },

            animation: {
                'fade-in': 'fadeIn 0.2s ease-out',
                'slide-up': 'slideUp 0.2s ease-out',
                'scale-in': 'scaleIn 0.15s ease-out',
            },

            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
}
