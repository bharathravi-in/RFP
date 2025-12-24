import { useState, useRef, useEffect } from 'react';
import api from '@/api/client';
import { RFPSection } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import SimpleMarkdown from '@/components/common/SimpleMarkdown';
import {
    PaperAirplaneIcon,
    SparklesIcon,
    XMarkIcon,
    CheckIcon,
    FolderOpenIcon,
    ArrowUpTrayIcon,
    DocumentIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon,
    BookOpenIcon,
    CloudArrowUpIcon,
} from '@heroicons/react/24/outline';

interface MessageSource {
    title: string;
    snippet?: string;
    relevance?: number;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isLoading?: boolean;
    sources?: MessageSource[];
}

interface KnowledgeItem {
    id: number;
    title: string;
    content_type?: string;
    source_type?: string;
    knowledge_profile_id?: number;
}

interface KnowledgeProfile {
    id: number;
    name: string;
}

type TabType = 'profile' | 'all' | 'upload';

interface SectionAIChatSidebarProps {
    section: RFPSection;
    projectId: number;
    isOpen: boolean;
    onClose: () => void;
    onContentGenerated: (content: string) => void;
}

export default function SectionAIChatSidebar({
    section,
    projectId,
    isOpen,
    onClose,
    onContentGenerated,
}: SectionAIChatSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('profile');

    // Project data for knowledge profiles
    const [projectData, setProjectData] = useState<any>(null);

    // Knowledge context
    const [allKnowledgeItems, setAllKnowledgeItems] = useState<KnowledgeItem[]>([]);
    const [profileKnowledgeItems, setProfileKnowledgeItems] = useState<KnowledgeItem[]>([]);
    const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // File upload
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load project data first
    useEffect(() => {
        const loadProject = async () => {
            try {
                const response = await api.get(`/projects/${projectId}`);
                setProjectData(response.data);
            } catch {
                // Silent fail
            }
        };
        if (isOpen && projectId) loadProject();
    }, [isOpen, projectId]);

    // Load knowledge items and auto-select profile items
    useEffect(() => {
        const loadKnowledge = async () => {
            try {
                // Fetch all knowledge items for "All" tab
                const allResponse = await api.get('/knowledge', { params: { limit: 100 } });
                const allItems: KnowledgeItem[] = allResponse.data.items || [];
                setAllKnowledgeItems(allItems);

                // Get profile IDs from project
                const profileIds = projectData?.knowledge_profiles?.map((p: any) => p.id) || [];

                if (profileIds.length > 0) {
                    // Fetch items for each profile and combine
                    const profileItemPromises = profileIds.map((profileId: number) =>
                        api.get('/knowledge', { params: { knowledge_profile_id: profileId, limit: 50 } })
                    );
                    const profileResponses = await Promise.all(profileItemPromises);

                    // Combine and dedupe profile items
                    const profileItemsMap = new Map<number, KnowledgeItem>();
                    profileResponses.forEach(res => {
                        (res.data.items || []).forEach((item: KnowledgeItem) => {
                            profileItemsMap.set(item.id, item);
                        });
                    });
                    const profileItems = Array.from(profileItemsMap.values());

                    setProfileKnowledgeItems(profileItems);

                    // Auto-select profile items
                    if (profileItems.length > 0) {
                        setSelectedKnowledgeIds(profileItems.map(item => item.id));
                        setActiveTab('profile');
                    } else {
                        setActiveTab('all');
                    }
                } else if (allItems.length > 0) {
                    setActiveTab('all');
                } else {
                    setActiveTab('upload');
                }
            } catch {
                // Silent fail
            }
        };
        if (isOpen && projectData) loadKnowledge();
    }, [isOpen, projectData]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Reset when section changes
    useEffect(() => {
        setMessages([]);
        setGeneratedContent(null);
        setUploadedFiles([]);
        setSearchQuery('');
    }, [section.id]);

    const generateMessageId = () => `msg-${Date.now()}`;

    const toggleKnowledgeItem = (id: number) => {
        setSelectedKnowledgeIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setUploadedFiles(prev => [...prev, ...files]);
            toast.success(`Added ${files.length} file(s)`);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setUploadedFiles(prev => [...prev, ...files]);
            toast.success(`Added ${files.length} file(s)`);
        }
    };

    const removeFile = (index: number) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendMessage = async () => {
        const message = inputValue.trim();
        if (!message || isLoading) return;

        const userMessage: Message = { id: generateMessageId(), role: 'user', content: message };
        const loadingMessage: Message = { id: generateMessageId(), role: 'assistant', content: '', isLoading: true };

        setMessages(prev => [...prev, userMessage, loadingMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const conversationHistory = messages
                .filter(m => !m.isLoading)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await api.post('/sections/chat', {
                project_id: projectId,
                section_type_id: section.section_type?.id,
                message,
                knowledge_item_ids: selectedKnowledgeIds,
                conversation_history: conversationHistory,
            });

            const assistantMessage: Message = {
                id: generateMessageId(),
                role: 'assistant',
                content: response.data.response,
                sources: response.data.sources || [],
            };

            setGeneratedContent(response.data.suggested_content || response.data.response);
            setMessages(prev => prev.filter(m => !m.isLoading).concat(assistantMessage));
        } catch {
            toast.error('AI request failed');
            setMessages(prev => prev.filter(m => !m.isLoading));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleApply = () => {
        if (generatedContent) {
            onContentGenerated(generatedContent);
            toast.success('Content applied!');
            onClose();
        }
    };

    // Filter knowledge items by search
    const filteredAllItems = allKnowledgeItems.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getFileIcon = (item: KnowledgeItem) => {
        const type = item.source_type || item.content_type || '';
        if (type.includes('pdf')) return '📄';
        if (type.includes('doc')) return '📝';
        if (type.includes('xls')) return '📊';
        if (type.includes('ppt')) return '📽️';
        return '📎';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop with blur */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Full Screen Panel with AI Vibes */}
            <div className="relative ml-auto w-full max-w-4xl bg-gradient-to-b from-white via-white to-gray-50/80 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 border-l border-purple-100/50">

                {/* Header with Gradient and Glow */}
                <div className="relative px-6 py-5 border-b border-purple-100/50 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-fuchsia-500/5 overflow-hidden">
                    {/* Animated background glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-400/5 via-transparent to-fuchsia-400/5 animate-pulse" />

                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/25">
                                <SparklesIcon className="h-6 w-6 text-white animate-pulse" />
                                {/* Glow effect */}
                                <div className="absolute inset-0 rounded-2xl bg-violet-400 blur-xl opacity-40 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                                    AI Content Assistant
                                </h2>
                                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                                    <span className="text-lg">{section.section_type?.icon || '📄'}</span>
                                    {section.section_type?.name || section.title}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl hover:bg-white/80 transition-all duration-200 hover:shadow-md group"
                        >
                            <XMarkIcon className="h-6 w-6 text-gray-400 group-hover:text-gray-600 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Context Panel with Tabs */}
                    <div className="w-72 border-r border-gray-100 bg-gradient-to-b from-gray-50/80 to-white flex flex-col flex-shrink-0">

                        {/* Context Header */}
                        <div className="p-4 border-b border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <BookOpenIcon className="h-4 w-4" />
                                Knowledge Context
                            </h3>
                            {selectedKnowledgeIds.length > 0 && (
                                <div className="mt-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-xs text-purple-600 font-medium inline-flex items-center gap-1.5">
                                    <CheckIcon className="h-3.5 w-3.5" />
                                    {selectedKnowledgeIds.length} document{selectedKnowledgeIds.length > 1 ? 's' : ''} selected
                                </div>
                            )}
                        </div>

                        {/* Tab Navigation */}
                        <div className="px-3 py-2 border-b border-gray-100">
                            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                                {[
                                    { key: 'profile', label: 'Profile', icon: FolderOpenIcon, count: profileKnowledgeItems.length },
                                    { key: 'all', label: 'All', icon: DocumentIcon, count: allKnowledgeItems.length },
                                    { key: 'upload', label: 'Upload', icon: CloudArrowUpIcon, count: uploadedFiles.length },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key as TabType)}
                                        className={clsx(
                                            'flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                                            activeTab === tab.key
                                                ? 'bg-white text-purple-600 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                        )}
                                    >
                                        <tab.icon className="h-3.5 w-3.5" />
                                        <span>{tab.label}</span>
                                        {tab.count > 0 && (
                                            <span className={clsx(
                                                'min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold',
                                                activeTab === tab.key ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-500'
                                            )}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-3">
                            {/* Profile Documents Tab */}
                            {activeTab === 'profile' && (
                                <div className="space-y-2">
                                    {profileKnowledgeItems.length === 0 ? (
                                        <div className="text-center py-6">
                                            <FolderOpenIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />

                                            {/* Show linked profiles */}
                                            {projectData?.knowledge_profiles && projectData.knowledge_profiles.length > 0 ? (
                                                <>
                                                    <p className="text-sm text-gray-500 font-medium">No documents in profile</p>
                                                    <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                                                        {projectData.knowledge_profiles.map((p: any) => (
                                                            <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                                                                📁 {p.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-3">
                                                        Upload documents to your knowledge profile
                                                    </p>
                                                    <a
                                                        href="/knowledge"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-3 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all"
                                                    >
                                                        <CloudArrowUpIcon className="h-4 w-4" />
                                                        Add Documents to Profile
                                                    </a>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-gray-500 font-medium">No knowledge profile linked</p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Link a knowledge profile to your project for AI context
                                                    </p>
                                                    <a
                                                        href={`/projects/${projectId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-3 px-4 py-2 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-all"
                                                    >
                                                        🔗 Link Knowledge Profile
                                                    </a>
                                                </>
                                            )}

                                            <button
                                                onClick={() => setActiveTab('all')}
                                                className="block mx-auto mt-4 text-xs text-gray-400 hover:text-gray-600"
                                            >
                                                Or browse all documents →
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-xs text-gray-400 mb-2 px-1">
                                                From your project's knowledge profile
                                            </p>
                                            {profileKnowledgeItems.map(item => (
                                                <label
                                                    key={item.id}
                                                    className={clsx(
                                                        'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200',
                                                        selectedKnowledgeIds.includes(item.id)
                                                            ? 'bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 shadow-sm'
                                                            : 'hover:bg-gray-50 border border-transparent'
                                                    )}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedKnowledgeIds.includes(item.id)}
                                                        onChange={() => toggleKnowledgeItem(item.id)}
                                                        className="rounded-md border-gray-300 text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className="text-lg">{getFileIcon(item)}</span>
                                                    <span className="text-sm text-gray-700 truncate flex-1">{item.title}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* All Documents Tab */}
                            {activeTab === 'all' && (
                                <div className="space-y-3">
                                    {/* Search */}
                                    <div className="relative">
                                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Search documents..."
                                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>

                                    {filteredAllItems.length === 0 ? (
                                        <div className="text-center py-6">
                                            <DocumentTextIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm text-gray-500">No documents found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {filteredAllItems.map(item => (
                                                <label
                                                    key={item.id}
                                                    className={clsx(
                                                        'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200',
                                                        selectedKnowledgeIds.includes(item.id)
                                                            ? 'bg-purple-50 border border-purple-200'
                                                            : 'hover:bg-gray-50 border border-transparent'
                                                    )}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedKnowledgeIds.includes(item.id)}
                                                        onChange={() => toggleKnowledgeItem(item.id)}
                                                        className="rounded-md border-gray-300 text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className="text-base">{getFileIcon(item)}</span>
                                                    <span className="text-sm text-gray-700 truncate flex-1">{item.title}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Upload Tab */}
                            {activeTab === 'upload' && (
                                <div className="space-y-3">
                                    {/* Drop Zone */}
                                    <div
                                        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={clsx(
                                            'relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300',
                                            isDragOver
                                                ? 'border-purple-400 bg-purple-50 scale-[1.02]'
                                                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                        )}
                                    >
                                        <CloudArrowUpIcon className={clsx(
                                            'h-10 w-10 mx-auto mb-3 transition-colors',
                                            isDragOver ? 'text-purple-500' : 'text-gray-300'
                                        )} />
                                        <p className="text-sm font-medium text-gray-600">
                                            {isDragOver ? 'Drop files here' : 'Drop files or click to upload'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, TXT</p>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept=".pdf,.doc,.docx,.txt"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />

                                    {/* Uploaded Files */}
                                    {uploadedFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-gray-400 px-1">Uploaded files</p>
                                            {uploadedFiles.map((file, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200"
                                                >
                                                    <span className="flex items-center gap-2 text-sm text-gray-700 truncate">
                                                        <DocumentTextIcon className="h-4 w-4 text-amber-500" />
                                                        {file.name}
                                                    </span>
                                                    <button
                                                        onClick={() => removeFile(i)}
                                                        className="p-1 rounded-lg hover:bg-amber-100 text-amber-600"
                                                    >
                                                        <XMarkIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Chat Area */}
                    <div className="flex-1 flex flex-col bg-white">
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.length === 0 ? (
                                <div className="text-center py-16">
                                    {/* AI Avatar */}
                                    <div className="relative w-20 h-20 mx-auto mb-6">
                                        <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-purple-600 rounded-3xl rotate-6 opacity-20" />
                                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                                            <SparklesIcon className="h-10 w-10 text-white" />
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-800 mb-2">How can I help?</h3>
                                    <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
                                        {section.content
                                            ? 'I can help improve, expand, or rewrite your existing content.'
                                            : 'I can generate content for this section based on your knowledge base.'}
                                    </p>

                                    {/* Quick Action Chips */}
                                    <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                                        {(section.content
                                            ? ['Make it more concise', 'Add more details', 'Improve the tone', 'Rewrite professionally']
                                            : ['Generate full content', 'Create an outline', 'What should I cover?', 'Draft an introduction']
                                        ).map(prompt => (
                                            <button
                                                key={prompt}
                                                onClick={() => setInputValue(prompt)}
                                                className="px-4 py-2.5 text-sm rounded-full bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 text-gray-600 hover:from-purple-50 hover:to-violet-50 hover:border-purple-200 hover:text-purple-600 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className="space-y-2">
                                        <div className={clsx('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                            {msg.role === 'assistant' && (
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20 flex-shrink-0">
                                                    <SparklesIcon className="h-5 w-5 text-white" />
                                                </div>
                                            )}
                                            <div className={clsx(
                                                'max-w-[75%] px-5 py-3.5 rounded-2xl text-sm shadow-sm',
                                                msg.role === 'user'
                                                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-br-md'
                                                    : 'bg-gray-50 border border-gray-100 text-gray-700 rounded-bl-md'
                                            )}>
                                                {msg.isLoading ? (
                                                    <div className="flex items-center gap-3 py-1">
                                                        <div className="flex gap-1.5">
                                                            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                                                            <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                                                        </div>
                                                        <span className="text-gray-400 text-sm">Generating...</span>
                                                    </div>
                                                ) : msg.role === 'assistant' ? (
                                                    <SimpleMarkdown content={msg.content} />
                                                ) : (
                                                    <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Sources Used - shown below AI messages */}
                                        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                                            <div className="ml-12 flex flex-wrap gap-1.5">
                                                <span className="text-xs text-gray-400">Sources:</span>
                                                {msg.sources.slice(0, 3).map((source, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-100"
                                                        title={source.snippet}
                                                    >
                                                        <BookOpenIcon className="h-3 w-3" />
                                                        {source.title.length > 25 ? source.title.slice(0, 25) + '...' : source.title}
                                                    </span>
                                                ))}
                                                {msg.sources.length > 3 && (
                                                    <span className="text-xs text-gray-400">
                                                        +{msg.sources.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-5 border-t border-gray-100 bg-gradient-to-t from-gray-50/50 to-white">
                            <div className="flex gap-3">
                                <input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your request..."
                                    className="flex-1 px-5 py-4 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm placeholder:text-gray-400"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isLoading}
                                    className="px-5 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white disabled:opacity-50 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 hover:-translate-y-0.5 disabled:hover:translate-y-0"
                                >
                                    <PaperAirplaneIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {generatedContent && messages.length > 0 && (
                                <button
                                    onClick={handleApply}
                                    className="w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-green-500/25 transition-all duration-200 hover:-translate-y-0.5"
                                >
                                    <CheckIcon className="h-5 w-5" />
                                    Apply Content to Section
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
