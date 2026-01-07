import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ProposalView from '@/components/proposal/ProposalView';

const ProposalViewPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const projectId = Number(id);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
            {/* Header */}
            <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="Go back"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Proposal View</h1>
                        <p className="text-sm text-gray-500">View and export final proposal</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                <ProposalView projectId={projectId} />
            </div>
        </div>
    );
};

export default ProposalViewPage;
