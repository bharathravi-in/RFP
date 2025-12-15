import { DocumentTextIcon, BookOpenIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface Source {
    id?: string;
    title: string;
    type?: 'knowledge' | 'document' | 'web';
    relevance: number;
    snippet?: string;
    url?: string;
}

interface SourcePanelProps {
    sources: Source[];
    onSourceClick?: (source: Source) => void;
    isLoading?: boolean;
}

export default function SourcePanel({
    sources,
    onSourceClick,
    isLoading = false,
}: SourcePanelProps) {
    if (isLoading) {
        return (
            <div className="space-y-3 p-4">
                <h3 className="text-sm font-medium text-text-secondary">Sources & References</h3>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-lg" />
                    </div>
                ))}
            </div>
        );
    }

    if (sources.length === 0) {
        return (
            <div className="p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-4">Sources & References</h3>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <DocumentTextIcon className="h-10 w-10 text-text-muted mb-3" />
                    <p className="text-sm text-text-muted">
                        Sources will appear here after generating an answer
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h3 className="text-sm font-medium text-text-secondary mb-4">
                Sources & References ({sources.length})
            </h3>

            <div className="space-y-3">
                {sources.map((source, index) => (
                    <SourceCard
                        key={source.id || index}
                        source={source}
                        onClick={onSourceClick}
                    />
                ))}
            </div>
        </div>
    );
}

interface SourceCardProps {
    source: Source;
    onClick?: (source: Source) => void;
}

function SourceCard({ source, onClick }: SourceCardProps) {
    const getIcon = () => {
        switch (source.type) {
            case 'knowledge':
                return BookOpenIcon;
            case 'web':
                return GlobeAltIcon;
            default:
                return DocumentTextIcon;
        }
    };

    const Icon = getIcon();
    const relevancePercent = Math.round(source.relevance * 100);

    return (
        <button
            onClick={() => onClick?.(source)}
            className={clsx(
                'w-full text-left p-3 rounded-lg bg-background hover:bg-primary-50 transition-colors',
                'border border-transparent hover:border-primary-100',
                'group'
            )}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 rounded-lg bg-primary-light group-hover:bg-primary-100 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-primary transition-colors">
                        {source.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={clsx(
                            'text-xs font-medium',
                            relevancePercent >= 80 ? 'text-success' :
                                relevancePercent >= 60 ? 'text-warning' : 'text-error'
                        )}>
                            {relevancePercent}% match
                        </span>
                        {source.type && (
                            <>
                                <span className="text-text-muted">•</span>
                                <span className="text-xs text-text-muted capitalize">{source.type}</span>
                            </>
                        )}
                    </div>
                    {source.snippet && (
                        <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                            "{source.snippet}"
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
}

// Compact inline citation for use in answers
export function InlineCitation({
    index,
    title,
    onClick
}: {
    index: number;
    title: string;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-primary bg-primary-light rounded hover:bg-primary-100 transition-colors"
            title={title}
        >
            [{index}]
        </button>
    );
}
