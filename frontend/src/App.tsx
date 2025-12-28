import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

// Pages
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import AcceptInvite from '@/pages/AcceptInvite';
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import AnswerWorkspace from '@/pages/AnswerWorkspace';
import ProposalBuilder from '@/pages/ProposalBuilder';
import DocumentVersioning from '@/pages/DocumentVersioning';
import KnowledgeBase from '@/pages/KnowledgeBase';
import TemplatesManager from '@/pages/TemplatesManager';
import Settings from '@/pages/Settings';
import AnswerLibrary from '@/pages/AnswerLibrary';
import AnalyticsDeepDive from '@/pages/AnalyticsDeepDive';
import CoPilotPage from '@/pages/CoPilotPage';
import DocumentChatPage from '@/pages/DocumentChatPage';
import KnowledgeChatPage from '@/pages/KnowledgeChatPage';
import ProposalChatPage from '@/pages/ProposalChatPage';

// Layout
import PageLayout from '@/components/layout/PageLayout';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

function App() {
    const { checkAuth } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return (
        <BrowserRouter>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#FFFFFF',
                        color: '#1E293B',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                    },
                    success: {
                        iconTheme: {
                            primary: '#16A34A',
                            secondary: '#FFFFFF',
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#DC2626',
                            secondary: '#FFFFFF',
                        },
                    },
                }}
            />

            <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />

                {/* Document Chat - Full screen experience */}
                <Route
                    path="/documents/:documentId/chat"
                    element={
                        <ProtectedRoute>
                            <DocumentChatPage />
                        </ProtectedRoute>
                    }
                />

                {/* Knowledge Chat - Full screen experience */}
                <Route
                    path="/knowledge/:itemId/chat"
                    element={
                        <ProtectedRoute>
                            <KnowledgeChatPage />
                        </ProtectedRoute>
                    }
                />

                {/* Proposal Chat - Full screen experience */}
                <Route
                    path="/projects/:id/proposal-chat"
                    element={
                        <ProtectedRoute>
                            <ProposalChatPage />
                        </ProtectedRoute>
                    }
                />

                {/* Protected routes */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <PageLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projects/:id" element={<ProjectDetail />} />
                    <Route path="projects/:id/workspace" element={<AnswerWorkspace />} />
                    <Route path="projects/:id/proposal" element={<ProposalBuilder />} />
                    <Route path="projects/:id/versions" element={<DocumentVersioning />} />
                    <Route path="knowledge" element={<KnowledgeBase />} />
                    <Route path="templates" element={<TemplatesManager />} />
                    <Route path="library" element={<AnswerLibrary />} />
                    <Route path="analytics" element={<AnalyticsDeepDive />} />
                    <Route path="co-pilot" element={<CoPilotPage />} />
                    <Route path="settings" element={<Settings />} />
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
