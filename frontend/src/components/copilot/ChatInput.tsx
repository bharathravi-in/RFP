import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { PaperAirplaneIcon, GlobeAltIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { SparklesIcon, CpuChipIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { Agent, CATEGORY_LABELS, getAgentsByCategory } from './types';

interface ChatInputProps {
    onSend: (message: string, files?: File[], options?: {
        useWebSearch?: boolean;
        agent?: Agent | null;
        mode?: 'general' | 'agents';
    }) => void;
    disabled?: boolean;
    mode: 'general' | 'agents';
    onModeChange: (mode: 'general' | 'agents') => void;
    selectedAgent: Agent | null;
    onAgentChange: (agent: Agent | null) => void;
}

export default function ChatInput({
    onSend,
    disabled = false,
    mode,
    onModeChange,
    selectedAgent,
    onAgentChange,
}: ChatInputProps) {
    const [value, setValue] = useState('');
    const [useWebSearch, setUseWebSearch] = useState(false);
    const [showAgentDropdown, setShowAgentDropdown] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const agentsByCategory = getAgentsByCategory();

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 200);
            textarea.style.height = `${newHeight}px`;
        }
    }, [value]);

    const handleSend = () => {
        const trimmed = value.trim();
        if (trimmed && !disabled) {
            onSend(trimmed, undefined, {
                useWebSearch,
                agent: mode === 'agents' ? selectedAgent : null,
                mode,
            });
            setValue('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="bg-white border-t border-gray-100 py-3 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Mode + Agent Row - Compact inline */}
                <div className="flex items-center gap-3 mb-2">
                    {/* Mode Toggle */}
                    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                        <button
                            onClick={() => onModeChange('general')}
                            className={clsx(
                                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                                mode === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <SparklesIcon className="h-3 w-3" />
                            General
                        </button>
                        <button
                            onClick={() => onModeChange('agents')}
                            className={clsx(
                                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                                mode === 'agents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <CpuChipIcon className="h-3 w-3" />
                            Agents
                        </button>
                    </div>

                    {/* Agent Selector */}
                    {mode === 'agents' && (
                        <div className="relative">
                            <button
                                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs"
                            >
                                <span>{selectedAgent?.icon || '🤖'}</span>
                                <span className="font-medium text-gray-700">{selectedAgent?.name || 'Auto'}</span>
                                <ChevronDownIcon className={clsx('h-3 w-3 text-gray-400', showAgentDropdown && 'rotate-180')} />
                            </button>

                            {showAgentDropdown && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowAgentDropdown(false)} />
                                    <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20 max-h-64 overflow-y-auto min-w-[180px]">
                                        <button
                                            onClick={() => { onAgentChange(null); setShowAgentDropdown(false); }}
                                            className={clsx('w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-xs', !selectedAgent && 'bg-primary-50')}
                                        >
                                            <span>🤖</span>
                                            <span className="font-medium">Auto-Select</span>
                                        </button>
                                        {Object.entries(agentsByCategory).map(([category, agents]) => (
                                            <div key={category}>
                                                <div className="px-3 py-1 bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase">{CATEGORY_LABELS[category]}</div>
                                                {agents.map((agent) => (
                                                    <button
                                                        key={agent.id}
                                                        onClick={() => { onAgentChange(agent); setShowAgentDropdown(false); }}
                                                        className={clsx('w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-xs', selectedAgent?.id === agent.id && 'bg-primary-50')}
                                                    >
                                                        <span>{agent.icon}</span>
                                                        <span className="font-medium">{agent.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Web Search Toggle */}
                    <button
                        onClick={() => setUseWebSearch(!useWebSearch)}
                        disabled={disabled}
                        className={clsx(
                            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                            useWebSearch ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                        )}
                    >
                        <GlobeAltIcon className="h-3 w-3" />
                        Web
                    </button>
                </div>

                {/* Text Input - Clean, no upload */}
                <div className={clsx(
                    'relative rounded-xl border bg-white transition-all',
                    disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
                )}>
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={mode === 'general' ? 'Message Co-Pilot...' : 'Ask about your RFPs...'}
                        disabled={disabled}
                        rows={1}
                        className="w-full resize-none rounded-xl bg-transparent px-4 py-3 pr-14 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50"
                    />

                    {/* Send Button */}
                    <button
                        onClick={handleSend}
                        disabled={disabled || !value.trim()}
                        className={clsx(
                            'absolute right-2 bottom-2 p-2 rounded-lg transition-all',
                            value.trim()
                                ? 'bg-primary text-white hover:bg-primary-dark'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        )}
                    >
                        <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
