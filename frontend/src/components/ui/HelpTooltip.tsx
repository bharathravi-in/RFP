import React, { useState, useRef, useEffect } from 'react';
import { QuestionMarkCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface HelpTooltipProps {
    /** The help text to display */
    content: string;
    /** Optional title for the tooltip */
    title?: string;
    /** Icon type - question mark or info */
    icon?: 'question' | 'info';
    /** Size of the icon */
    size?: 'sm' | 'md' | 'lg';
    /** Position of the tooltip */
    position?: 'top' | 'bottom' | 'left' | 'right';
    /** Additional class names */
    className?: string;
    /** Children to wrap (alternative to icon) */
    children?: React.ReactNode;
}

/**
 * HelpTooltip - A reusable tooltip component for contextual help
 * 
 * Usage:
 * <HelpTooltip content="This is AI-generated content based on your knowledge base." />
 * <HelpTooltip title="Confidence Score" content="Shows how reliable the AI answer is." icon="info" />
 */
export default function HelpTooltip({
    content,
    title,
    icon = 'question',
    size = 'sm',
    position = 'top',
    className,
    children,
}: HelpTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const iconSizes = {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6',
    };

    const IconComponent = icon === 'info' ? InformationCircleIcon : QuestionMarkCircleIcon;

    // Calculate tooltip position
    useEffect(() => {
        if (isVisible && triggerRef.current && tooltipRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            const padding = 8;

            let top = 0;
            let left = 0;

            switch (position) {
                case 'top':
                    top = triggerRect.top - tooltipRect.height - padding;
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'bottom':
                    top = triggerRect.bottom + padding;
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'left':
                    top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
                    left = triggerRect.left - tooltipRect.width - padding;
                    break;
                case 'right':
                    top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
                    left = triggerRect.right + padding;
                    break;
            }

            // Keep tooltip within viewport
            left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
            top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

            setTooltipPosition({ top, left });
        }
    }, [isVisible, position]);

    return (
        <div className={clsx('inline-flex items-center', className)}>
            <button
                ref={triggerRef}
                type="button"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-full"
                aria-label={title || 'Help'}
            >
                {children || <IconComponent className={iconSizes[size]} />}
            </button>

            {/* Tooltip Portal */}
            {isVisible && (
                <div
                    ref={tooltipRef}
                    className="fixed z-50 pointer-events-none"
                    style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
                    role="tooltip"
                >
                    <div className="bg-gray-900 text-white text-sm rounded-lg shadow-lg px-3 py-2 max-w-xs">
                        {title && (
                            <div className="font-semibold text-white mb-1">{title}</div>
                        )}
                        <div className="text-gray-200 leading-relaxed">{content}</div>

                        {/* Arrow based on position */}
                        <div
                            className={clsx(
                                'absolute w-2 h-2 bg-gray-900 transform rotate-45',
                                position === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
                                position === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
                                position === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
                                position === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2'
                            )}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Convenience exports for common help tooltips
export const AIConfidenceHelp = () => (
    <HelpTooltip
        title="AI Confidence Score"
        content="This score indicates how confident the AI is in this answer. Higher scores mean better source coverage and more relevant knowledge was found."
        icon="info"
    />
);

export const KnowledgeSourceHelp = () => (
    <HelpTooltip
        title="Knowledge Sources"
        content="These are the documents and content from your knowledge base that were used to generate this answer."
        icon="info"
    />
);

export const ComplianceCheckHelp = () => (
    <HelpTooltip
        title="Compliance Check"
        content="Our AI automatically checks your answers against common compliance frameworks like SOC2, GDPR, and HIPAA."
        icon="info"
    />
);
