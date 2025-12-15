import { useState, useCallback } from 'react';
import {
    FolderIcon,
    FolderOpenIcon,
    DocumentIcon,
    ChevronRightIcon,
    PlusIcon,
    TrashIcon,
    CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface Folder {
    id: number;
    name: string;
    description?: string;
    icon: string;
    color?: string;
    item_count: number;
    children?: Folder[];
}

interface KnowledgeItem {
    id: number;
    title: string;
    source_type: string;
    file_type?: string;
    created_at: string;
}

interface FolderTreeProps {
    folders: Folder[];
    selectedFolderId?: number | null;
    onSelectFolder: (folder: Folder | null) => void;
    onCreateFolder: (parentId: number | null) => void;
    onUploadFiles: (folderId: number) => void;
}

export default function FolderTree({
    folders,
    selectedFolderId,
    onSelectFolder,
    onCreateFolder,
    onUploadFiles,
}: FolderTreeProps) {
    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-medium text-text-primary">Knowledge Base</h3>
                <button
                    onClick={() => onCreateFolder(null)}
                    className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-light rounded-lg transition-colors"
                    title="Create folder"
                >
                    <PlusIcon className="h-4 w-4" />
                </button>
            </div>

            {/* Root level */}
            <div
                className={clsx(
                    'flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-background transition-colors',
                    selectedFolderId === null && 'bg-primary-light text-primary'
                )}
                onClick={() => onSelectFolder(null)}
            >
                <FolderIcon className="h-4 w-4" />
                <span className="text-sm">All Items</span>
            </div>

            {/* Folder tree */}
            <div className="flex-1 overflow-y-auto">
                {folders.map((folder) => (
                    <FolderNode
                        key={folder.id}
                        folder={folder}
                        depth={0}
                        selectedId={selectedFolderId}
                        onSelect={onSelectFolder}
                        onCreateSubfolder={onCreateFolder}
                        onUpload={onUploadFiles}
                    />
                ))}
            </div>
        </div>
    );
}

interface FolderNodeProps {
    folder: Folder;
    depth: number;
    selectedId?: number | null;
    onSelect: (folder: Folder) => void;
    onCreateSubfolder: (parentId: number) => void;
    onUpload: (folderId: number) => void;
}

function FolderNode({
    folder,
    depth,
    selectedId,
    onSelect,
    onCreateSubfolder,
    onUpload,
}: FolderNodeProps) {
    const [isExpanded, setIsExpanded] = useState(depth < 1);
    const hasChildren = folder.children && folder.children.length > 0;
    const isSelected = selectedId === folder.id;

    return (
        <div>
            <div
                className={clsx(
                    'flex items-center gap-1 py-1.5 pr-2 cursor-pointer hover:bg-background transition-colors group',
                    isSelected && 'bg-primary-light'
                )}
                style={{ paddingLeft: `${16 + depth * 16}px` }}
            >
                {/* Expand toggle */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className={clsx(
                        'p-0.5 rounded hover:bg-gray-200 transition-transform',
                        !hasChildren && 'invisible'
                    )}
                >
                    <ChevronRightIcon
                        className={clsx('h-3 w-3 transition-transform', isExpanded && 'rotate-90')}
                    />
                </button>

                {/* Folder icon */}
                <div onClick={() => onSelect(folder)} className="flex items-center gap-2 flex-1 min-w-0">
                    {isExpanded ? (
                        <FolderOpenIcon className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                        <FolderIcon
                            className="h-4 w-4 flex-shrink-0"
                            style={{ color: folder.color || '#6366f1' }}
                        />
                    )}
                    <span
                        className={clsx(
                            'text-sm truncate',
                            isSelected ? 'text-primary font-medium' : 'text-text-primary'
                        )}
                    >
                        {folder.name}
                    </span>
                    {folder.item_count > 0 && (
                        <span className="text-xs text-text-muted">({folder.item_count})</span>
                    )}
                </div>

                {/* Actions (visible on hover) */}
                <div className="hidden group-hover:flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onUpload(folder.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Upload files"
                    >
                        <CloudArrowUpIcon className="h-3.5 w-3.5 text-text-muted" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateSubfolder(folder.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Create subfolder"
                    >
                        <PlusIcon className="h-3.5 w-3.5 text-text-muted" />
                    </button>
                </div>
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
                    {folder.children!.map((child) => (
                        <FolderNode
                            key={child.id}
                            folder={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onCreateSubfolder={onCreateSubfolder}
                            onUpload={onUpload}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Knowledge item list component
interface KnowledgeItemListProps {
    items: KnowledgeItem[];
    onSelect: (item: KnowledgeItem) => void;
    onDelete?: (item: KnowledgeItem) => void;
}

export function KnowledgeItemList({ items, onSelect, onDelete }: KnowledgeItemListProps) {
    const getFileIcon = (type?: string) => {
        if (!type) return DocumentIcon;
        if (type.includes('pdf')) return DocumentIcon;
        return DocumentIcon;
    };

    return (
        <div className="divide-y divide-border">
            {items.length === 0 ? (
                <div className="py-12 text-center text-text-muted">
                    <FolderIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No items in this folder</p>
                    <p className="text-xs mt-1">Upload files or create knowledge items</p>
                </div>
            ) : (
                items.map((item) => {
                    const Icon = getFileIcon(item.file_type);
                    return (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-background cursor-pointer group"
                            onClick={() => onSelect(item)}
                        >
                            <Icon className="h-5 w-5 text-text-muted flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">
                                    {item.title}
                                </p>
                                <p className="text-xs text-text-muted">
                                    {item.source_type} • {new Date(item.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            {onDelete && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(item);
                                    }}
                                    className="hidden group-hover:block p-1 text-text-muted hover:text-error"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}
