/**
 * Accessibility utilities and components.
 * 
 * Provides:
 * - Skip links for keyboard navigation
 * - Screen reader announcements
 * - Focus management
 * - ARIA utilities
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Skip link component for keyboard navigation.
 * Allows users to skip repetitive content.
 */
export function SkipLink({
    targetId,
    children = 'Skip to main content'
}: {
    targetId: string;
    children?: React.ReactNode;
}) {
    return (
        <a
            href={`#${targetId}`}
            className="
        sr-only focus:not-sr-only
        focus:absolute focus:top-2 focus:left-2 focus:z-50
        focus:px-4 focus:py-2 focus:bg-primary focus:text-white
        focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2
      "
        >
            {children}
        </a>
    );
}

/**
 * Screen reader only text.
 * Visually hidden but accessible to screen readers.
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
    return (
        <span className="sr-only">{children}</span>
    );
}

/**
 * Live region for dynamic announcements.
 * Screen readers will announce content changes.
 */
export function LiveRegion({
    children,
    politeness = 'polite',
    atomic = true,
}: {
    children: React.ReactNode;
    politeness?: 'polite' | 'assertive' | 'off';
    atomic?: boolean;
}) {
    return (
        <div
            role="status"
            aria-live={politeness}
            aria-atomic={atomic}
            className="sr-only"
        >
            {children}
        </div>
    );
}

/**
 * Hook for announcing messages to screen readers.
 */
export function useAnnounce() {
    const [message, setMessage] = useState('');

    const announce = useCallback((text: string, delay = 100) => {
        // Clear first to ensure re-announcement of same message
        setMessage('');
        setTimeout(() => setMessage(text), delay);
    }, []);

    const Announcer = useCallback(() => (
        <LiveRegion politeness="polite">
            {message}
        </LiveRegion>
    ), [message]);

    return { announce, Announcer };
}

/**
 * Hook for managing focus.
 * Useful for modals, dialogs, and other focus traps.
 */
export function useFocusTrap(isActive: boolean = true) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isActive) return;

        // Store previous focus
        previousFocusRef.current = document.activeElement as HTMLElement;

        // Get focusable elements
        const container = containerRef.current;
        if (!container) return;

        const focusableElements = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Focus first element
        firstElement?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                // Shift+Tab: wrap to last element
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                // Tab: wrap to first element
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Restore previous focus
            previousFocusRef.current?.focus();
        };
    }, [isActive]);

    return containerRef;
}

/**
 * Hook for handling keyboard interaction patterns.
 */
export function useArrowKeyNavigation(
    itemCount: number,
    onSelect?: (index: number) => void
) {
    const [focusIndex, setFocusIndex] = useState(0);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                case 'ArrowRight':
                    e.preventDefault();
                    setFocusIndex((prev) => (prev + 1) % itemCount);
                    break;
                case 'ArrowUp':
                case 'ArrowLeft':
                    e.preventDefault();
                    setFocusIndex((prev) => (prev - 1 + itemCount) % itemCount);
                    break;
                case 'Home':
                    e.preventDefault();
                    setFocusIndex(0);
                    break;
                case 'End':
                    e.preventDefault();
                    setFocusIndex(itemCount - 1);
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    onSelect?.(focusIndex);
                    break;
            }
        },
        [itemCount, focusIndex, onSelect]
    );

    return { focusIndex, setFocusIndex, handleKeyDown };
}

/**
 * Accessible tooltip component.
 */
export function Tooltip({
    children,
    content,
    id,
}: {
    children: React.ReactElement;
    content: string;
    id: string;
}) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="relative inline-block">
            <div
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
                aria-describedby={id}
            >
                {children}
            </div>
            {isVisible && (
                <div
                    id={id}
                    role="tooltip"
                    className="
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            px-2 py-1 text-sm text-white bg-gray-900 rounded
            whitespace-nowrap z-50
          "
                >
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
            )}
        </div>
    );
}

/**
 * Visually hidden heading for screen readers.
 * Provides context without visual display.
 */
export function VisuallyHiddenHeading({
    level = 2,
    children,
}: {
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    children: React.ReactNode;
}) {
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag className="sr-only">{children}</Tag>;
}

/**
 * Focus visible indicator styles.
 * Add to components that need visible focus indication.
 */
export const focusVisibleClasses = `
  focus:outline-none 
  focus-visible:ring-2 
  focus-visible:ring-primary 
  focus-visible:ring-offset-2
`;

export default {
    SkipLink,
    ScreenReaderOnly,
    LiveRegion,
    Tooltip,
    VisuallyHiddenHeading,
    focusVisibleClasses,
};
