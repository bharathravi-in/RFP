import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useThemeStore, Theme } from '@/store/themeStore';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface ThemeSelectorProps {
    variant?: 'dropdown' | 'buttons' | 'icons';
    className?: string;
}

const themes: { value: Theme; icon: typeof SunIcon; labelKey: string }[] = [
    { value: 'light', icon: SunIcon, labelKey: 'Light' },
    { value: 'dark', icon: MoonIcon, labelKey: 'Dark' },
    { value: 'system', icon: ComputerDesktopIcon, labelKey: 'System' },
];

export default function ThemeSelector({ variant = 'icons', className = '' }: ThemeSelectorProps) {
    const { theme, setTheme } = useThemeStore();

    if (variant === 'buttons') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                {themes.map((t) => (
                    <button
                        key={t.value}
                        onClick={() => setTheme(t.value)}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all',
                            theme === t.value
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        )}
                    >
                        <t.icon className="h-4 w-4" />
                        {t.labelKey}
                    </button>
                ))}
            </div>
        );
    }

    // Icons variant - compact for header
    return (
        <div className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 ${className}`}>
            {themes.map((t) => (
                <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={clsx(
                        'p-1.5 rounded-md transition-all',
                        theme === t.value
                            ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                    title={t.labelKey}
                >
                    <t.icon className="h-4 w-4" />
                </button>
            ))}
        </div>
    );
}
