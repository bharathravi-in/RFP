import React from 'react';
import {
    ShieldCheckIcon,
    DocumentCheckIcon,
    CodeBracketIcon,
    CurrencyDollarIcon,
    ScaleIcon,
    CubeIcon,
    QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';

export type QuestionCategory =
    | 'security'
    | 'compliance'
    | 'technical'
    | 'pricing'
    | 'legal'
    | 'product'
    | 'general';

interface QuestionCategoryBadgeProps {
    category: QuestionCategory | string;
    subCategory?: string | null;
    showSubCategory?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

interface CategoryConfig {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
    security: {
        icon: ShieldCheckIcon,
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        label: 'Security'
    },
    compliance: {
        icon: DocumentCheckIcon,
        color: 'text-purple-700',
        bgColor: 'bg-purple-100',
        label: 'Compliance'
    },
    technical: {
        icon: CodeBracketIcon,
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        label: 'Technical'
    },
    pricing: {
        icon: CurrencyDollarIcon,
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        label: 'Pricing'
    },
    legal: {
        icon: ScaleIcon,
        color: 'text-orange-700',
        bgColor: 'bg-orange-100',
        label: 'Legal'
    },
    product: {
        icon: CubeIcon,
        color: 'text-cyan-700',
        bgColor: 'bg-cyan-100',
        label: 'Product'
    },
    general: {
        icon: QuestionMarkCircleIcon,
        color: 'text-gray-700',
        bgColor: 'bg-gray-100',
        label: 'General'
    },
};

/**
 * Badge component displaying question category with icon.
 */
export const QuestionCategoryBadge: React.FC<QuestionCategoryBadgeProps> = ({
    category,
    subCategory,
    showSubCategory = true,
    size = 'md',
    className = ''
}) => {
    const config = CATEGORY_CONFIG[category.toLowerCase()] || CATEGORY_CONFIG.general;
    const Icon = config.icon;

    const sizeClasses = {
        sm: { badge: 'px-1.5 py-0.5 text-xs', icon: 'w-3 h-3', gap: 'gap-0.5' },
        md: { badge: 'px-2 py-1 text-xs', icon: 'w-3.5 h-3.5', gap: 'gap-1' },
        lg: { badge: 'px-3 py-1.5 text-sm', icon: 'w-4 h-4', gap: 'gap-1.5' }
    };

    const sizes = sizeClasses[size];

    // Format sub-category for display
    const formatSubCategory = (sub: string): string => {
        return sub
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    };

    return (
        <div className={`flex items-center ${sizes.gap} ${className}`}>
            <span
                className={`inline-flex items-center ${sizes.gap} ${sizes.badge} rounded-full font-medium ${config.bgColor} ${config.color}`}
            >
                <Icon className={sizes.icon} />
                {config.label}
            </span>
            {showSubCategory && subCategory && (
                <span className="text-xs text-gray-500">
                    / {formatSubCategory(subCategory)}
                </span>
            )}
        </div>
    );
};

export default QuestionCategoryBadge;
