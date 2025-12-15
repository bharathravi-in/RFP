interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-gray-200 rounded ${className}`}
        />
    );
}

// Card skeleton for project cards
export function ProjectCardSkeleton() {
    return (
        <div className="card p-6 space-y-4">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
            </div>
        </div>
    );
}

// Question list skeleton
export function QuestionListSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                    <Skeleton className="h-6 w-6 rounded-md flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// Answer editor skeleton
export function AnswerEditorSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-lg" /> {/* Toolbar */}
            <Skeleton className="h-48 w-full rounded-lg" /> {/* Editor */}
            <div className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
        </div>
    );
}

// Source panel skeleton
export function SourcePanelSkeleton() {
    return (
        <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-32" />
            {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 space-y-2">
                    <div className="flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Knowledge item skeleton
export function KnowledgeItemSkeleton() {
    return (
        <div className="card p-4 space-y-3">
            <div className="flex items-start justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
            </div>
        </div>
    );
}

// Dashboard stats skeleton
export function DashboardStatsSkeleton() {
    return (
        <div className="grid grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card p-6 space-y-3">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-20" />
                </div>
            ))}
        </div>
    );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
    return (
        <tr>
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                </td>
            ))}
        </tr>
    );
}
