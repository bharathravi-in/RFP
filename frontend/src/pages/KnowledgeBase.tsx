import { useState, useEffect, useCallback } from 'react';
import {
    PlusIcon,
    MagnifyingGlassIcon,
    FolderIcon,
} from '@heroicons/react/24/outline';
import FolderTree, { KnowledgeItemList } from '../components/knowledge/FolderTree';
import CreateFolderModal from '../components/knowledge/CreateFolderModal';
import FileUploadModal from '../components/knowledge/FileUploadModal';
import DocumentPreviewSidebar from '../components/knowledge/DocumentPreviewSidebar';
import api from '../api/client';

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

interface PreviewData {
    type: 'text' | 'document';
    title: string;
    content: string;
    file_type?: string;
    file_name?: string;
    can_download?: boolean;
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

    // Sidebar preview state
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [previewItemId, setPreviewItemId] = useState<number | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

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
                setItems(response.data.folder?.items || []);
            } else {
                const response = await api.get('/knowledge', {
                    params: { search: searchQuery || undefined },
                });
                setItems(response.data.items || []);
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

    const handleUpload = async (file: File) => {
        if (!uploadFolderId) return;

        const formData = new FormData();
        formData.append('files', file);

        await api.post(`/folders/${uploadFolderId}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        await loadItems();
    };

    const handleSelectItem = async (item: KnowledgeItem) => {
        try {
            setPreviewItemId(item.id);

            // Get preview metadata
            const response = await api.get(`/preview/${item.id}`);
            setPreviewData(response.data);

            // If it's a PDF, fetch the file as blob for iframe
            if (response.data.file_type?.includes('pdf') && response.data.can_download !== false) {
                const fileResponse = await api.get(`/preview/${item.id}/file`, {
                    responseType: 'blob',
                });
                const blobUrl = window.URL.createObjectURL(fileResponse.data);
                setPdfUrl(blobUrl);
            } else {
                setPdfUrl(null);
            }

            setIsSidebarOpen(true);
        } catch (error) {
            console.error('Failed to load preview:', error);
        }
    };

    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
        setPreviewData(null);
        setPreviewItemId(null);
        // Cleanup blob URL
        if (pdfUrl) {
            window.URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
        }
    };

    const handleDownload = async () => {
        if (!previewItemId) return;
        try {
            const response = await api.get(`/preview/${previewItemId}/download`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', previewData?.file_name || previewData?.title || 'download');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download:', error);
        }
    };

    const handleDeleteItem = async () => {
        if (!previewItemId) return;
        try {
            await api.delete(`/knowledge/${previewItemId}`);
            handleCloseSidebar();
            await loadItems();
        } catch (error) {
            console.error('Failed to delete:', error);
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
                    </div>

                    <div className="flex items-center gap-3">
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
                            <KnowledgeItemList items={items} onSelect={handleSelectItem} />
                        )}
                    </div>

                    {/* Document Preview Sidebar */}
                    <DocumentPreviewSidebar
                        isOpen={isSidebarOpen}
                        preview={previewData}
                        pdfUrl={pdfUrl}
                        onClose={handleCloseSidebar}
                        onDownload={handleDownload}
                        onDelete={handleDeleteItem}
                    />
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
        </div>
    );
}
