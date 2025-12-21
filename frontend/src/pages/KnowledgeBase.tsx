import { useState, useEffect, useCallback } from 'react';
import {
    PlusIcon,
    MagnifyingGlassIcon,
    FolderIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import FolderTree, { KnowledgeItemList } from '../components/knowledge/FolderTree';
import CreateFolderModal from '../components/knowledge/CreateFolderModal';
import FileUploadModal from '../components/knowledge/FileUploadModal';
import KnowledgePreviewModal from '../components/knowledge/KnowledgePreviewModal';
import api from '../api/client';
import toast from 'react-hot-toast';

interface Folder {
    id: number;
    name: string;
    description?: string;
    icon: string;
    color?: string;
    item_count: number;
    children?: Folder[];
    items?: KnowledgeItem[];
}

interface KnowledgeItem {
    id: number;
    title: string;
    content: string;
    source_type: string;
    file_type?: string;
    folder_id?: number;
    created_at: string;
}

export default function KnowledgeBasePage() {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Modal state
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [createFolderParentId, setCreateFolderParentId] = useState<number | null>(null);
    const [uploadFolderId, setUploadFolderId] = useState<number | null>(null);

    // Preview modal state
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<KnowledgeItem | null>(null);

    // Reindex and count state
    const [isReindexing, setIsReindexing] = useState(false);
    const [totalItemCount, setTotalItemCount] = useState(0);

    // Load folders
    const loadFolders = useCallback(async () => {
        try {
            const response = await api.get('/folders');
            setFolders(response.data.folders || []);
        } catch (error) {
            console.error('Failed to load folders:', error);
        }
    }, []);

    // Load items for selected folder
    const loadItems = useCallback(async () => {
        try {
            if (selectedFolder) {
                const response = await api.get(`/folders/${selectedFolder.id}`);
                const folderItems = response.data.folder?.items || [];
                setItems(folderItems);
                setTotalItemCount(folderItems.length);
            } else {
                const response = await api.get('/knowledge', {
                    params: { search: searchQuery || undefined },
                });
                const allItems = response.data.items || [];
                setItems(allItems);
                setTotalItemCount(response.data.total || allItems.length);
            }
        } catch (error) {
            console.error('Failed to load items:', error);
        }
    }, [selectedFolder, searchQuery]);

    useEffect(() => {
        setIsLoading(true);
        Promise.all([loadFolders(), loadItems()]).finally(() => setIsLoading(false));
    }, [loadFolders, loadItems]);

    // Handlers
    const handleCreateFolder = (parentId: number | null) => {
        setCreateFolderParentId(parentId);
        setIsCreateFolderOpen(true);
    };

    // Reindex all knowledge items with dimensions
    const handleReindex = async () => {
        setIsReindexing(true);
        try {
            const response = await api.post('/knowledge/reindex');
            toast.success(`Reindexed ${response.data.count} items with dimension data`);
            // Refresh items after reindex
            await loadItems();
        } catch {
            toast.error('Failed to reindex. Please try again.');
        } finally {
            setIsReindexing(false);
        }
    };

    const handleCreateFolderSubmit = async (data: { name: string; description?: string; color?: string }) => {
        await api.post('/folders', {
            ...data,
            parent_id: createFolderParentId,
        });
        await loadFolders();
    };

    const handleUploadFiles = (folderId: number) => {
        setUploadFolderId(folderId);
        setIsUploadOpen(true);
    };

    const handleUpload = async (file: File, dimensions?: { geography?: string; client_type?: string; industry?: string; knowledge_profile_id?: number }) => {
        if (!uploadFolderId) return;

        const formData = new FormData();
        formData.append('files', file);

        // Append dimension tags if provided
        if (dimensions?.geography) formData.append('geography', dimensions.geography);
        if (dimensions?.client_type) formData.append('client_type', dimensions.client_type);
        if (dimensions?.industry) formData.append('industry', dimensions.industry);
        if (dimensions?.knowledge_profile_id) formData.append('knowledge_profile_id', dimensions.knowledge_profile_id.toString());

        await api.post(`/folders/${uploadFolderId}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        await loadItems();
    };

    // Open preview modal
    const handleSelectItem = (item: KnowledgeItem) => {
        setPreviewItem(item);
        setIsPreviewOpen(true);
    };

    // Close preview modal
    const handleClosePreview = () => {
        setIsPreviewOpen(false);
        setPreviewItem(null);
    };

    // Download item
    const handleDownload = async (item?: KnowledgeItem) => {
        const targetItem = item || previewItem;
        if (!targetItem) return;
        try {
            const response = await api.get(`/preview/${targetItem.id}/download`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', targetItem.title);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Download started');
        } catch (error) {
            console.error('Failed to download:', error);
            toast.error('Failed to download file');
        }
    };

    // Delete item
    const handleDeleteItem = async (item?: KnowledgeItem) => {
        const targetItem = item || previewItem;
        if (!targetItem) return;

        // Confirm deletion (skip if coming from modal which has its own confirm)
        if (item && !window.confirm('Are you sure you want to delete this item?')) {
            return;
        }

        try {
            await api.delete(`/knowledge/${targetItem.id}`);
            // Close preview if the deleted item was being previewed
            if (previewItem?.id === targetItem.id) {
                handleClosePreview();
            }
            await loadItems();
            toast.success('Item deleted successfully');
        } catch (error) {
            console.error('Failed to delete:', error);
            toast.error('Failed to delete item');
        }
    };

    return (
        <div className="h-screen flex bg-background">
            {/* Sidebar - Folder Tree */}
            <div className="w-64 bg-surface border-r border-border flex-shrink-0">
                <FolderTree
                    folders={folders}
                    selectedFolderId={selectedFolder?.id || null}
                    onSelectFolder={setSelectedFolder}
                    onCreateFolder={handleCreateFolder}
                    onUploadFiles={handleUploadFiles}
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
                    <div className="flex items-center gap-3">
                        <FolderIcon className="h-6 w-6 text-primary" />
                        <h1 className="text-xl font-semibold text-text-primary">
                            {selectedFolder ? selectedFolder.name : 'All Knowledge Items'}
                        </h1>
                        {/* Item Count Badge */}
                        <span className="text-xs px-2.5 py-1 bg-primary-light text-primary rounded-full font-medium">
                            {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Reindex Button */}
                        <button
                            onClick={handleReindex}
                            disabled={isReindexing}
                            className="btn-secondary flex items-center gap-2"
                            title="Re-index all knowledge items with dimensions"
                        >
                            {isReindexing ? (
                                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <ArrowPathIcon className="h-4 w-4" />
                            )}
                            {isReindexing ? 'Reindexing...' : 'Reindex All'}
                        </button>

                        {/* Search */}
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search knowledge..."
                                className="input pl-9 w-64"
                            />
                        </div>

                        {/* Add Item */}
                        {selectedFolder && (
                            <button
                                onClick={() => handleUploadFiles(selectedFolder.id)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Upload Files
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area with Sidebar */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Items List */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-text-muted">Loading...</div>
                            </div>
                        ) : (
                            <KnowledgeItemList
                                items={items}
                                onSelect={handleSelectItem}
                                onPreview={handleSelectItem}
                                onDownload={handleDownload}
                                onDelete={handleDeleteItem}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <CreateFolderModal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                parentFolderName={
                    createFolderParentId
                        ? folders.find((f) => f.id === createFolderParentId)?.name
                        : undefined
                }
                onSubmit={handleCreateFolderSubmit}
            />

            <FileUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                folderId={uploadFolderId || 0}
                folderName={selectedFolder?.name || 'Knowledge Base'}
                onUpload={handleUpload}
            />

            {/* Preview Modal */}
            {previewItem && (
                <KnowledgePreviewModal
                    isOpen={isPreviewOpen}
                    onClose={handleClosePreview}
                    itemId={previewItem.id}
                    itemTitle={previewItem.title}
                    fileType={previewItem.file_type}
                    onDownload={() => toast.success('Download started')}
                    onDelete={() => handleDeleteItem(previewItem)}
                />
            )}
        </div>
    );
}
