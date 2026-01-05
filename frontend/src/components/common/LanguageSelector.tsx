import { useTranslation } from 'react-i18next';
import { GlobeAltIcon } from '@heroicons/react/24/outline';

const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
];

interface LanguageSelectorProps {
    variant?: 'dropdown' | 'buttons';
    className?: string;
}

export default function LanguageSelector({ variant = 'dropdown', className = '' }: LanguageSelectorProps) {
    const { i18n, t } = useTranslation();
    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code);
    };

    if (variant === 'buttons') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-all ${i18n.language === lang.code
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {lang.nativeName}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
                {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                        {lang.nativeName}
                    </option>
                ))}
            </select>
            <GlobeAltIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    );
}
