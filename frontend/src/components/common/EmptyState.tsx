import React from 'react';
import { Link } from 'react-router-dom';
import {
    DocumentPlusIcon,
    FolderPlusIcon,
    BookOpenIcon,
    SparklesIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';

interface EmptyStateProps {
    type: 'dashboard' | 'projects' | 'knowledge' | 'answers';
    onAction?: () => void;
}

const EMPTY_STATES = {
    dashboard: {
        icon: SparklesIcon,
        title: 'Welcome to RFP Pro!',
        description: 'Get started by creating your first proposal project. Our AI will help you respond faster and win more deals.',
        primaryAction: 'Create Your First Project',
        primaryLink: '/projects/new',
        secondaryAction: 'Upload Knowledge',
        secondaryLink: '/knowledge',
        tips: [
            '📄 Upload an RFP to extract questions automatically',
            '🧠 Add past proposals to your knowledge base',
            '✨ Let AI generate tailored answers in seconds',
        ],
    },
    projects: {
        icon: FolderPlusIcon,
        title: 'No Projects Yet',
        description: 'Create a project to start responding to RFPs with AI assistance.',
        primaryAction: 'Create Project',
        primaryLink: '/projects/new',
        tips: [
            'Projects help organize your proposals',
            'Track progress from draft to submission',
            'Collaborate with your team',
        ],
    },
    knowledge: {
        icon: BookOpenIcon,
        title: 'Build Your Knowledge Base',
        description: 'Upload past proposals, capability statements, and case studies. The more you add, the better your AI answers.',
        primaryAction: 'Upload Documents',
        tips: [
            'Add your best past proposals',
            'Include company capabilities',
            'Upload case studies and success stories',
        ],
    },
    answers: {
        icon: DocumentPlusIcon,
        title: 'No Answers Generated Yet',
        description: 'Upload an RFP document to extract questions, then generate AI-powered answers.',
        primaryAction: 'Upload RFP',
        tips: [
            'Supported formats: PDF, DOCX, XLSX',
            'AI extracts questions automatically',
            'Review and refine AI answers',
        ],
    },
};

export const EmptyState: React.FC<EmptyStateProps> = ({ type, onAction }) => {
    const config = EMPTY_STATES[type];
    const Icon = config.icon;

    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 max-w-lg mx-auto text-center">
            {/* Icon */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl opacity-50" />
                <div className="relative p-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl">
                    <Icon className="h-12 w-12 text-indigo-600" />
                </div>
            </div>

            {/* Content */}
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {config.title}
            </h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
                {config.description}
            </p>

            {/* Tips */}
            {config.tips && (
                <div className="bg-gray-50 rounded-xl p-4 mb-6 w-full">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Tips</h4>
                    <ul className="space-y-2 text-left">
                        {config.tips.map((tip, index) => (
                            <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                {config.primaryLink ? (
                    <Link
                        to={config.primaryLink}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                        {config.primaryAction}
                        <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                ) : (
                    <button
                        onClick={onAction}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                        {config.primaryAction}
                        <ArrowRightIcon className="h-4 w-4" />
                    </button>
                )}

                {config.secondaryLink && (
                    <Link
                        to={config.secondaryLink}
                        className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                        {config.secondaryAction}
                    </Link>
                )}
            </div>
        </div>
    );
};

export default EmptyState;
