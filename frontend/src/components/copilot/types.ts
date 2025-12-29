// Tarento Co-Pilot Types
// Multi-Agent AI Chat Interface

export interface ChatSession {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messages: ChatMessage[];
    agentContext?: string;
    mode?: 'general' | 'agents';
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    agentName?: string;
    agentIcon?: string;
    status?: 'sending' | 'streaming' | 'complete' | 'error';
}

export interface Agent {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    capabilities: string[];
    category: 'general' | 'rfp' | 'knowledge' | 'analysis' | 'writing';
}

export interface CoPilotState {
    sessions: ChatSession[];
    activeSessionId: string | null;
    agents: Agent[];
    isLoading: boolean;
    isStreaming: boolean;
    mode: 'general' | 'agents';
}

// All available agents in the platform
export const ALL_AGENTS: Agent[] = [
    // General AI
    {
        id: 'general-ai',
        name: 'General AI',
        description: 'Like ChatGPT - ask anything, get instant answers',
        icon: '✨',
        color: 'purple',
        capabilities: ['chat', 'explain', 'code', 'creative'],
        category: 'general',
    },
    // RFP Specialized Agents
    {
        id: 'rfp-analyzer',
        name: 'RFP Analyzer',
        description: 'Analyzes RFP documents and extracts requirements',
        icon: '🔍',
        color: 'blue',
        capabilities: ['extract', 'analyze', 'categorize'],
        category: 'rfp',
    },
    {
        id: 'question-extractor',
        name: 'Question Extractor',
        description: 'Extracts questions from RFP documents',
        icon: '❓',
        color: 'cyan',
        capabilities: ['extract', 'parse', 'organize'],
        category: 'rfp',
    },
    {
        id: 'answer-generator',
        name: 'Answer Generator',
        description: 'Generates responses to RFP questions using knowledge base',
        icon: '✍️',
        color: 'green',
        capabilities: ['generate', 'compose', 'refine'],
        category: 'writing',
    },
    {
        id: 'compliance-checker',
        name: 'Compliance Checker',
        description: 'Verifies responses meet RFP requirements',
        icon: '✅',
        color: 'amber',
        capabilities: ['validate', 'check', 'verify'],
        category: 'analysis',
    },
    // Knowledge Agents
    {
        id: 'knowledge-search',
        name: 'Knowledge Search',
        description: 'Searches your knowledge base for relevant content',
        icon: '📚',
        color: 'indigo',
        capabilities: ['search', 'retrieve', 'summarize'],
        category: 'knowledge',
    },
    {
        id: 'document-reader',
        name: 'Document Reader',
        description: 'Reads and understands uploaded documents',
        icon: '📄',
        color: 'slate',
        capabilities: ['read', 'extract', 'summarize'],
        category: 'knowledge',
    },
    // Writing Agents
    {
        id: 'proposal-writer',
        name: 'Proposal Writer',
        description: 'Helps write professional proposal content',
        icon: '📝',
        color: 'rose',
        capabilities: ['write', 'edit', 'format'],
        category: 'writing',
    },
    {
        id: 'executive-summary',
        name: 'Executive Summary',
        description: 'Creates executive summaries and overviews',
        icon: '📊',
        color: 'orange',
        capabilities: ['summarize', 'condense', 'highlight'],
        category: 'writing',
    },
    // Analysis Agents
    {
        id: 'competitor-analyzer',
        name: 'Competitor Analyzer',
        description: 'Analyzes competitive positioning and differentiators',
        icon: '🎯',
        color: 'red',
        capabilities: ['analyze', 'compare', 'recommend'],
        category: 'analysis',
    },
    {
        id: 'risk-assessor',
        name: 'Risk Assessor',
        description: 'Identifies risks and mitigation strategies',
        icon: '⚠️',
        color: 'yellow',
        capabilities: ['assess', 'identify', 'mitigate'],
        category: 'analysis',
    },
    {
        id: 'pricing-advisor',
        name: 'Pricing Advisor',
        description: 'Helps with pricing strategy and cost breakdowns',
        icon: '💰',
        color: 'emerald',
        capabilities: ['calculate', 'optimize', 'recommend'],
        category: 'analysis',
    },
];

// Legacy export for backward compatibility
export const DEFAULT_AGENTS = ALL_AGENTS.filter(a =>
    ['general-ai', 'rfp-analyzer', 'answer-generator', 'compliance-checker', 'knowledge-search'].includes(a.id)
);

// Helper to generate unique IDs
export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper to generate chat title from first message
export const generateChatTitle = (message: string): string => {
    const truncated = message.slice(0, 40);
    return truncated.length < message.length ? `${truncated}...` : truncated;
};

// Group agents by category
export const getAgentsByCategory = () => {
    const categories: Record<string, Agent[]> = {};
    ALL_AGENTS.forEach(agent => {
        if (!categories[agent.category]) {
            categories[agent.category] = [];
        }
        categories[agent.category].push(agent);
    });
    return categories;
};

export const CATEGORY_LABELS: Record<string, string> = {
    general: 'General',
    rfp: 'RFP Analysis',
    knowledge: 'Knowledge',
    writing: 'Writing',
    analysis: 'Analysis',
};
