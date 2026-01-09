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
            const newHeight = Math.min(Math.max(textarea.scrollHeight, 52), 200);
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
        <div className="bg-gradient-to-t from-slate-100/80 via-white to-white border-t border-slate-200/60 py-4 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Main Input Container - Clean Design */}
                <div className={clsx(
                    'relative rounded-2xl border bg-white transition-all duration-300 shadow-sm',
                    disabled
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-slate-200 focus-within:border-violet-400 focus-within:shadow-md'
                )}>
                    {/* Top Row - Mode Toggle and Options */}
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-100">
                        {/* Mode Toggle - Pill Style */}
                        <div className="inline-flex rounded-full bg-slate-100/80 p-0.5">
                            <button
                                onClick={() => onModeChange('general')}
                                className={clsx(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200',
                                    mode === 'general'
                                        ? 'bg-white text-slate-900 shadow-md'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                <SparklesIcon className="h-3.5 w-3.5 text-violet-500" />
                                General
                            </button>
                            <button
                                onClick={() => onModeChange('agents')}
                                className={clsx(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200',
                                    mode === 'agents'
                                        ? 'bg-white text-slate-900 shadow-md'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                <CpuChipIcon className="h-3.5 w-3.5 text-purple-500" />
                                Agents
                            </button>
                        </div>

                        {/* Agent Selector - Premium */}
                        {mode === 'agents' && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-200 bg-purple-50/50 hover:bg-purple-100/50 text-xs transition-all"
                                >
                                    <span className="text-sm">{selectedAgent?.icon || '🤖'}</span>
                                    <span className="font-medium text-purple-700">{selectedAgent?.name || 'Auto-Select'}</span>
                                    <ChevronDownIcon className={clsx('h-3 w-3 text-purple-400 transition-transform', showAgentDropdown && 'rotate-180')} />
                                </button>

                                {showAgentDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowAgentDropdown(false)} />
                                        <div className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-20 max-h-72 overflow-y-auto min-w-[220px] backdrop-blur-xl">
                                            <div className="px-3 py-2 border-b border-slate-100">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Agent</span>
                                            </div>
                                            <button
                                                onClick={() => { onAgentChange(null); setShowAgentDropdown(false); }}
                                                className={clsx(
                                                    'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm transition-colors',
                                                    !selectedAgent && 'bg-violet-50'
                                                )}
                                            >
                                                <span className="text-lg">🤖</span>
                                                <div className="text-left">
                                                    <span className="font-medium block">Auto-Select</span>
                                                    <span className="text-[10px] text-slate-400">Let AI choose the best agent</span>
                                                </div>
                                            </button>
                                            {Object.entries(agentsByCategory).map(([category, agents]) => (
                                                <div key={category}>
                                                    <div className="px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{CATEGORY_LABELS[category]}</div>
                                                    {agents.map((agent) => (
                                                        <button
                                                            key={agent.id}
                                                            onClick={() => { onAgentChange(agent); setShowAgentDropdown(false); }}
                                                            className={clsx(
                                                                'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm transition-colors',
                                                                selectedAgent?.id === agent.id && 'bg-violet-50'
                                                            )}
                                                        >
                                                            <span className="text-lg">{agent.icon}</span>
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

                        <div className="flex-1" />

                        {/* Web Search Toggle - Premium */}
                        <button
                            onClick={() => setUseWebSearch(!useWebSearch)}
                            disabled={disabled}
                            className={clsx(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200',
                                useWebSearch
                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            )}
                        >
                            <GlobeAltIcon className="h-3.5 w-3.5" />
                            Web
                        </button>
                    </div>

                    {/* Text Input Area */}
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={mode === 'general' ? 'Message Co-Pilot... (Shift+Enter for new line)' : 'Ask your specialized AI agents...'}
                            disabled={disabled}
                            rows={1}
                            style={{ outline: 'none', boxShadow: 'none' }}
                            className="w-full resize-none bg-transparent px-4 py-4 pr-16 text-base text-slate-900 placeholder-slate-400 outline-none focus:outline-none focus:ring-0 border-none focus:border-none disabled:opacity-50"
                        />

                        {/* Send Button - Premium Gradient */}
                        <button
                            onClick={handleSend}
                            disabled={disabled || !value.trim()}
                            className={clsx(
                                'absolute right-3 bottom-3 p-2.5 rounded-xl transition-all duration-300 transform',
                                value.trim()
                                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-300 hover:shadow-violet-400 hover:scale-105 active:scale-95'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            )}
                        >
                            <PaperAirplaneIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Helper Text */}
                <p className="text-center text-xs text-slate-400 mt-2">
                    Press Enter to send • Shift+Enter for new line
                </p>
            </div>
        </div>
    );
}
