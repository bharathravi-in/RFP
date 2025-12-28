import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MagnifyingGlassIcon,
    FolderIcon,
    ArrowPathIcon,
    CloudArrowUpIcon,
    Squares2X2Icon,
    ListBulletIcon,
    EyeIcon,
    ArrowDownTrayIcon,
    TrashIcon,
    DocumentIcon,
    ClockIcon,
    ChevronRightIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import FolderTree from '../components/knowledge/FolderTree';
import CreateFolderModal from '../components/knowledge/CreateFolderModal';
import FileUploadModal from '../components/knowledge/FileUploadModal';
import KnowledgePreviewModal from '../components/knowledge/KnowledgePreviewModal';
import api from '../api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';

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
    knowledge_profile_id?: number;
    knowledge_profile_name?: string;
}

// File type configuration with document-style icons
const FILE_TYPES: Record<string, { color: string; bgLight: string; bgDark: string }> = {
    pdf: { color: '#DC2626', bgLight: '#FEE2E2', bgDark: '#DC2626' },
    docx: { color: '#2563EB', bgLight: '#DBEAFE', bgDark: '#2563EB' },
    doc: { color: '#2563EB', bgLight: '#DBEAFE', bgDark: '#2563EB' },
    xlsx: { color: '#16A34A', bgLight: '#DCFCE7', bgDark: '#16A34A' },
    xls: { color: '#16A34A', bgLight: '#DCFCE7', bgDark: '#16A34A' },
    pptx: { color: '#EA580C', bgLight: '#FFEDD5', bgDark: '#EA580C' },
    ppt: { color: '#EA580C', bgLight: '#FFEDD5', bgDark: '#EA580C' },
    txt: { color: '#6B7280', bgLight: '#F3F4F6', bgDark: '#6B7280' },
    default: { color: '#6366F1', bgLight: '#EEF2FF', bgDark: '#6366F1' },
};

function getFileType(fileType?: string, fileName?: string): { ext: string; config: typeof FILE_TYPES.default } {
    const fileExt = fileName?.split('.').pop()?.toLowerCase() || '';

    if (fileExt && FILE_TYPES[fileExt]) {
        return { ext: fileExt.toUpperCase(), config: FILE_TYPES[fileExt] };
    }

    if (fileType) {
        const mime = fileType.toLowerCase();
        if (mime.includes('pdf')) return { ext: 'PDF', config: FILE_TYPES.pdf };
        if (mime.includes('word') || mime.includes('document')) return { ext: 'DOCX', config: FILE_TYPES.docx };
        if (mime.includes('excel') || mime.includes('sheet')) return { ext: 'XLSX', config: FILE_TYPES.xlsx };
        if (mime.includes('powerpoint') || mime.includes('presentation')) return { ext: 'PPTX', config: FILE_TYPES.pptx };
    }

    return { ext: 'FILE', config: FILE_TYPES.default };
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Document Icon Component (Google Drive style)
function FileIcon({ ext, config, size = 'md' }: { ext: string; config: typeof FILE_TYPES.default; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        sm: { wrapper: 'w-10 h-12', text: 'text-[8px]', corner: 'w-3 h-3' },
        md: { wrapper: 'w-14 h-16', text: 'text-[10px]', corner: 'w-4 h-4' },
        lg: { wrapper: 'w-20 h-24', text: 'text-xs', corner: 'w-5 h-5' },
    };
    const s = sizeClasses[size];

    return (
        <div className={clsx('relative', s.wrapper)}>
            {/* Document body */}
            <div
                className="absolute inset-0 rounded-sm shadow-sm border"
                style={{
                    backgroundColor: config.bgLight,
                    borderColor: config.color + '40'
                }}
            >
                {/* Folded corner */}
                <div
                    className={clsx('absolute top-0 right-0', s.corner)}
                    style={{
                        background: `linear-gradient(135deg, white 50%, ${config.color}20 50%)`,
                        borderBottomLeftRadius: '2px'
                    }}
                />

                {/* File type label */}
                <div
                    className={clsx(
                        'absolute bottom-1 left-1 right-1 py-0.5 rounded-sm text-center font-bold text-white',
                        s.text
                    )}
                    style={{ backgroundColor: config.bgDark }}
                >
                    {ext}
                </div>
            </div>
        </div>
    );
}

export default function KnowledgeBasePage() {
    const navigate = useNavigate();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [createFolderParentId, setCreateFolderParentId] = useState<number | null>(null);
    const [uploadFolderId, setUploadFolderId] = useState<number | null>(null);

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<KnowledgeItem | null>(null);

    const [isReindexing, setIsReindexing] = useState(false);
    const [totalItemCount, setTotalItemCount] = useState(0);

    const loadFolders = useCallback(async () => {
        try {
            const response = await api.get('/folders');
            setFolders(response.data.folders || []);
        } catch (error) {
            console.error('Failed to load folders:', error);
        }
    }, []);

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

    const handleCreateFolder = (parentId: number | null) => {
        setCreateFolderParentId(parentId);
        setIsCreateFolderOpen(true);
    };

    const handleReindex = async () => {
        setIsReindexing(true);
        try {
            const response = await api.post('/knowledge/reindex');
            toast.success(`Reindexed ${response.data.count} items`);
            await loadItems();
        } catch {
            toast.error('Failed to reindex');
        } finally {
            setIsReindexing(false);
        }
    };

    const handleCreateFolderSubmit = async (data: { name: string; description?: string; color?: string }) => {
        await api.post('/folders', { ...data, parent_id: createFolderParentId });
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
        if (dimensions?.geography) formData.append('geography', dimensions.geography);
        if (dimensions?.client_type) formData.append('client_type', dimensions.client_type);
        if (dimensions?.industry) formData.append('industry', dimensions.industry);
        if (dimensions?.knowledge_profile_id) formData.append('knowledge_profile_id', dimensions.knowledge_profile_id.toString());
        await api.post(`/folders/${uploadFolderId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        await loadItems();
    };

    const handleSelectItem = (item: KnowledgeItem) => {
        setPreviewItem(item);
        setIsPreviewOpen(true);
    };

    const handleClosePreview = () => {
        setIsPreviewOpen(false);
        setPreviewItem(null);
    };

    const handleDownload = async (item: KnowledgeItem) => {
        try {
            const response = await api.get(`/preview/${item.id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', item.title);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Download started');
        } catch {
            toast.error('Failed to download');
        }
    };

    const handleDeleteItem = async (item: KnowledgeItem) => {
        if (!window.confirm('Delete this file?')) return;
        try {
            await api.delete(`/knowledge/${item.id}`);
            if (previewItem?.id === item.id) handleClosePreview();
            await loadItems();
            toast.success('File deleted');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const filteredItems = items.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get recent items (last 5)
    const recentItems = [...items]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

    return (
        <div className="h-[calc(100vh-64px)] flex bg-gray-50">
            {/* Sidebar */}
            <div className="w-60 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
                {/* Upload Button */}
                {selectedFolder && (
                    <div className="p-4">
                        <button
                            onClick={() => handleUploadFiles(selectedFolder.id)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-700 font-medium hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                        >
                            <CloudArrowUpIcon className="h-5 w-5" />
                            Upload
                        </button>
                    </div>
                )}

                <FolderTree
                    folders={folders}
                    selectedFolderId={selectedFolder?.id || null}
                    onSelectFolder={setSelectedFolder}
                    onCreateFolder={handleCreateFolder}
                    onUploadFiles={handleUploadFiles}
                />

                {/* Storage Info */}
                <div className="mt-auto p-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <DocumentIcon className="h-4 w-4" />
                        <span>{totalItemCount} files</span>
                    </div>
                    <button
                        onClick={handleReindex}
                        disabled={isReindexing}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors"
                    >
                        <ArrowPathIcon className={clsx('h-4 w-4', isReindexing && 'animate-spin')} />
                        {isReindexing ? 'Reindexing...' : 'Reindex files'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={() => setSelectedFolder(null)}
                            className="text-gray-600 hover:text-primary transition-colors"
                        >
                            My Files
                        </button>
                        {selectedFolder && (
                            <>
                                <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-900 font-medium">{selectedFolder.name}</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search files..."
                                className="w-64 pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
                            />
                        </div>

                        {/* View Toggle */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={clsx(
                                    'p-2 rounded-md transition-all',
                                    viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'
                                )}
                            >
                                <Squares2X2Icon className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={clsx(
                                    'p-2 rounded-md transition-all',
                                    viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'
                                )}
                            >
                                <ListBulletIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                                    <div className="w-14 h-16 bg-gray-200 rounded mb-3 mx-auto" />
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
                                </div>
                            ))}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                                <FolderIcon className="h-12 w-12 text-gray-400" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-900 mb-2">
                                {searchQuery ? 'No files found' : 'Drop files here'}
                            </h3>
                            <p className="text-gray-500 mb-6 max-w-sm">
                                {searchQuery
                                    ? 'Try a different search term'
                                    : 'Upload files to your knowledge base to get started'}
                            </p>
                            {selectedFolder && !searchQuery && (
                                <button
                                    onClick={() => handleUploadFiles(selectedFolder.id)}
                                    className="btn-primary"
                                >
                                    <CloudArrowUpIcon className="h-5 w-5" />
                                    Upload Files
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Recent Section (only on main view) */}
                            {!selectedFolder && !searchQuery && recentItems.length > 0 && (
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <ClockIcon className="h-5 w-5 text-gray-500" />
                                        <h2 className="text-sm font-medium text-gray-700">Recent</h2>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto pb-2">
                                        {recentItems.map((item) => {
                                            const { ext, config } = getFileType(item.file_type, item.title);
                                            return (
                                                <div
                                                    key={`recent-${item.id}`}
                                                    onClick={() => handleSelectItem(item)}
                                                    className="flex-shrink-0 w-36 bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md hover:border-primary/30 cursor-pointer transition-all"
                                                >
                                                    <div className="flex justify-center mb-2">
                                                        <FileIcon ext={ext} config={config} size="sm" />
                                                    </div>
                                                    <p className="text-xs text-gray-900 text-center truncate">{item.title}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Files Grid/List */}
                            <div className="mb-4">
                                <h2 className="text-sm font-medium text-gray-700">
                                    {selectedFolder ? selectedFolder.name : 'All Files'}
                                    <span className="text-gray-400 font-normal ml-2">({filteredItems.length})</span>
                                </h2>
                            </div>

                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {filteredItems.map((item) => {
                                        const { ext, config } = getFileType(item.file_type, item.title);
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelectItem(item)}
                                                className="group relative bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-primary/30 cursor-pointer transition-all"
                                            >
                                                {/* File Icon */}
                                                <div className="flex justify-center mb-3">
                                                    <FileIcon ext={ext} config={config} size="md" />
                                                </div>

                                                {/* File Name */}
                                                <p className="text-sm text-gray-900 text-center truncate font-medium mb-1">
                                                    {item.title.replace(/\.[^/.]+$/, '')}
                                                </p>
                                                <p className="text-xs text-gray-500 text-center">
                                                    {formatDate(item.created_at)}
                                                </p>

                                                {/* Hover Actions */}
                                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/knowledge/${item.id}/chat`); }}
                                                        className="p-1.5 bg-white rounded-full shadow-md hover:bg-primary/10"
                                                        title="Chat with document"
                                                    >
                                                        <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-primary" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                                        className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50"
                                                    >
                                                        <ArrowDownTrayIcon className="h-3.5 w-3.5 text-gray-600" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
                                                        className="p-1.5 bg-white rounded-full shadow-md hover:bg-red-50"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* List View */
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    {/* Header */}
                                    <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                                        <div className="col-span-6">Name</div>
                                        <div className="col-span-2">Type</div>
                                        <div className="col-span-3">Modified</div>
                                        <div className="col-span-1"></div>
                                    </div>

                                    {filteredItems.map((item) => {
                                        const { ext, config } = getFileType(item.file_type, item.title);
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelectItem(item)}
                                                className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-50 cursor-pointer group border-b border-gray-100 last:border-0"
                                            >
                                                <div className="col-span-6 flex items-center gap-3">
                                                    <FileIcon ext={ext} config={config} size="sm" />
                                                    <span className="text-sm text-gray-900 truncate">{item.title}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span
                                                        className="text-xs font-medium px-2 py-1 rounded"
                                                        style={{
                                                            backgroundColor: config.bgLight,
                                                            color: config.color
                                                        }}
                                                    >
                                                        {ext}
                                                    </span>
                                                </div>
                                                <div className="col-span-3 text-sm text-gray-500">
                                                    {formatDate(item.created_at)}
                                                </div>
                                                <div className="col-span-1 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/knowledge/${item.id}/chat`); }}
                                                        className="p-1.5 rounded hover:bg-primary/10"
                                                        title="Chat with document"
                                                    >
                                                        <ChatBubbleLeftRightIcon className="h-4 w-4 text-primary" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleSelectItem(item); }}
                                                        className="p-1.5 rounded hover:bg-gray-200"
                                                    >
                                                        <EyeIcon className="h-4 w-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                                        className="p-1.5 rounded hover:bg-gray-200"
                                                    >
                                                        <ArrowDownTrayIcon className="h-4 w-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
                                                        className="p-1.5 rounded hover:bg-red-100"
                                                    >
                                                        <TrashIcon className="h-4 w-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            <CreateFolderModal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                parentFolderName={createFolderParentId ? folders.find((f) => f.id === createFolderParentId)?.name : undefined}
                onSubmit={handleCreateFolderSubmit}
            />

            <FileUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                folderId={uploadFolderId || 0}
                folderName={selectedFolder?.name || 'Knowledge Base'}
                onUpload={handleUpload}
            />

            {previewItem && (
                <KnowledgePreviewModal
                    isOpen={isPreviewOpen}
                    onClose={handleClosePreview}
                    itemId={previewItem.id}
                    itemTitle={previewItem.title}
                    fileType={previewItem.file_type}
                    onDownload={() => handleDownload(previewItem)}
                    onDelete={() => handleDeleteItem(previewItem)}
                />
            )}
        </div>
    );
}
