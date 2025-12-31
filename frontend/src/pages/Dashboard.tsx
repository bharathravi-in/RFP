import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { projectsApi, questionsApi, knowledgeApi } from '@/api/client';
import { Project } from '@/types';
import {
    FolderIcon,
    DocumentTextIcon,
    CheckCircleIcon,
    ClockIcon,
    PlusIcon,
    BookOpenIcon,
    RocketLaunchIcon,
    DocumentArrowUpIcon,
    SparklesIcon,
    ArrowRightIcon,
    ArrowTrendingUpIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import VendorEligibilityPanel from '@/components/dashboard/VendorEligibilityPanel';
import DeadlineWidget from '@/components/dashboard/DeadlineWidget';
import { WinRateChart, RevenueStatsCard, TeamLeaderboard, LossReasonsChart, QuickStatsRow } from '@/components/analytics/AnalyticsCharts';
import PlatformTour from '@/components/onboarding/PlatformTour';

interface DashboardStats {
    activeProjects: number;
    pendingReviews: number;
    completedProjects: number;
    totalQuestions: number;
    knowledgeItems: number;
}

const TOUR_COMPLETED_KEY = 'rfp_pro_tour_completed';

export default function Dashboard() {
    const { user, organization } = useAuthStore();
    const { t } = useTranslation();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showTour, setShowTour] = useState(false);

    // Check if user has seen the tour on first load
    useEffect(() => {
        const tourCompleted = localStorage.getItem(TOUR_COMPLETED_KEY);
        if (!tourCompleted) {
            // Show tour for first-time users after a short delay
            const timer = setTimeout(() => {
                setShowTour(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleTourComplete = () => {
        localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
        setShowTour(false);
    };

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                setLoading(true);
                const projectsResponse = await projectsApi.list();
                const allProjects = projectsResponse.data.projects || [];

                const activeProjects = allProjects.filter((p: Project) => p.status === 'in_progress' || p.status === 'draft').length;
                const pendingReviews = allProjects.filter((p: Project) => p.status === 'review').length;
                const completedProjects = allProjects.filter((p: Project) => p.status === 'completed').length;

                let knowledgeItems = 0;
                try {
                    const knowledgeResponse = await knowledgeApi.list();
                    knowledgeItems = knowledgeResponse.data.items?.length || 0;
                } catch { }

                let totalQuestions = 0;
                for (const project of allProjects.slice(0, 5)) {
                    try {
                        const questionsResponse = await questionsApi.list(project.id);
                        totalQuestions += questionsResponse.data.questions?.length || 0;
                    } catch { }
                }

                setStats({ activeProjects, pendingReviews, completedProjects, totalQuestions, knowledgeItems });
                setProjects(allProjects.sort((a: Project, b: Project) =>
                    new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
                ));
            } catch (err) {
                setError('Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        };
        loadDashboardData();
    }, []);

    const STATS = [
        { name: 'Active', value: stats?.activeProjects || 0, icon: FolderIcon, color: 'text-blue-600 bg-blue-50', href: '/projects?status=active' },
        { name: 'Pending', value: stats?.pendingReviews || 0, icon: ClockIcon, color: 'text-amber-600 bg-amber-50', href: '/projects?status=review' },
        { name: 'Completed', value: stats?.completedProjects || 0, icon: CheckCircleIcon, color: 'text-green-600 bg-green-50', href: '/projects?status=completed' },
        { name: 'Knowledge', value: stats?.knowledgeItems || 0, icon: BookOpenIcon, color: 'text-purple-600 bg-purple-50', href: '/knowledge' },
    ];

    const QUICK_ACTIONS = [
        { title: 'Knowledge Profile', desc: 'Set up dimensions', href: '/settings?tab=knowledge', icon: BookOpenIcon, color: 'text-green-600', bg: 'bg-green-50 hover:bg-green-100 border-green-100' },
        { title: 'Knowledge Base', desc: 'Upload content', href: '/knowledge', icon: DocumentTextIcon, color: 'text-purple-600', bg: 'bg-purple-50 hover:bg-purple-100 border-purple-100' },
        { title: 'New Project', desc: 'Start RFP response', href: '/projects?action=create', icon: PlusIcon, color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100 border-blue-100' },
        { title: 'Upload RFP', desc: 'Import & analyze', href: '/projects', icon: DocumentArrowUpIcon, color: 'text-orange-600', bg: 'bg-orange-50 hover:bg-orange-100 border-orange-100' },
    ];

    const isNewUser = !loading && projects.length === 0;

    return (
        <div className="space-y-6">
            {/* Platform Tour Modal */}
            <PlatformTour
                isOpen={showTour}
                onClose={() => setShowTour(false)}
                onComplete={handleTourComplete}
            />


            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                        {t('dashboard.welcome')}, {user?.name?.split(' ')[0]} 👋
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {isNewUser ? "Let's get started with your first RFP" : "Here's your RFP overview"}
                    </p>
                </div>
                <Link to="/projects" className="btn-primary w-full sm:w-auto justify-center">
                    <PlusIcon className="h-4 w-4" />
                    {t('dashboard.createProject')}
                </Link>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error} <button onClick={() => window.location.reload()} className="underline ml-2">Retry</button>
                </div>
            )}

            {/* Stats Row - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {STATS.map((stat) => (
                    <Link
                        key={stat.name}
                        to={stat.href}
                        className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className={clsx('p-2.5 rounded-lg', stat.color)}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 group-hover:text-primary">
                                    {loading ? '—' : stat.value}
                                </p>
                                <p className="text-xs text-gray-500">{stat.name}</p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Quick Actions - Horizontal Compact */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {QUICK_ACTIONS.map((action) => (
                        <Link
                            key={action.title}
                            to={action.href}
                            className={clsx(
                                'flex items-center gap-3 p-4 rounded-xl border transition-all group',
                                action.bg
                            )}
                        >
                            <div className={clsx('p-2 rounded-lg bg-white shadow-sm', action.color)}>
                                <action.icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                                <p className="text-xs text-gray-500">{action.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* New User Onboarding */}
            {isNewUser && (
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
                    <div className="flex items-start gap-4">
                        <RocketLaunchIcon className="h-8 w-8" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
                            <div className="grid grid-cols-5 gap-3 text-sm">
                                {['Knowledge Profile', 'Knowledge Base', 'Create Project', 'Upload & Analyze', 'Generate & Export'].map((step, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                                        <span className="text-white/90">{step}</span>
                                    </div>
                                ))}
                            </div>
                            <Link to="/projects" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white text-primary rounded-lg font-medium hover:bg-gray-100">
                                Start First Project <ArrowRightIcon className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Analytics Section */}
            {!loading && projects.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
                        <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
                    </div>
                    <QuickStatsRow />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                        <WinRateChart />
                        <RevenueStatsCard />
                        <TeamLeaderboard />
                        <LossReasonsChart />
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            {!loading && projects.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Projects List - 2 columns */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Active Projects */}
                        <div className="bg-white rounded-xl border border-gray-100">
                            <div className="flex items-center justify-between p-4 border-b border-gray-50">
                                <h2 className="font-semibold text-gray-900">Active Projects</h2>
                                <Link to="/projects" className="text-sm text-primary hover:underline">View all</Link>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {projects.slice(0, 5).map((project) => (
                                    <Link
                                        key={project.id}
                                        to={`/projects/${project.id}/proposal`}
                                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <FolderIcon className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 truncate group-hover:text-primary">{project.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{project.client_name || 'No client'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                                project.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    project.status === 'review' ? 'bg-amber-100 text-amber-700' :
                                                        project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-gray-100 text-gray-600'
                                            )}>
                                                {project.status.replace('_', ' ')}
                                            </span>
                                            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Recent Projects */}
                        <div className="bg-white rounded-xl border border-gray-100">
                            <div className="flex items-center justify-between p-4 border-b border-gray-50">
                                <h2 className="font-semibold text-gray-900">Recent Activity</h2>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {projects.slice(0, 4).map((project) => (
                                    <Link
                                        key={project.id}
                                        to={`/projects/${project.id}`}
                                        className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                                    >
                                        <FolderIcon className="h-4 w-4 text-gray-400" />
                                        <span className="text-sm text-gray-700 truncate flex-1">{project.name}</span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(project.updated_at || project.created_at).toLocaleDateString()}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar - 1 column */}
                    <div className="space-y-4">
                        {/* Deadlines */}
                        <DeadlineWidget />

                        {/* Vendor Profile */}
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <h2 className="font-semibold text-gray-900 mb-3">Vendor Profile</h2>
                            <VendorEligibilityPanel
                                organizationName={organization?.name || user?.name + "'s Organization"}
                                vendorProfile={(organization?.settings as any)?.vendor_profile}
                            />
                        </div>

                        {/* AI Insights */}
                        <div className="bg-gradient-to-br from-primary/5 to-purple-50 rounded-xl border border-primary/10 p-4">
                            <div className="flex items-start gap-3">
                                <SparklesIcon className="h-5 w-5 text-primary" />
                                <div className="flex-1">
                                    <h3 className="font-medium text-gray-900">AI Insights</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {stats?.totalQuestions ? (
                                            <>You have {stats.totalQuestions} questions. {stats.knowledgeItems} knowledge items available.</>
                                        ) : (
                                            <>Upload an RFP to get AI-powered analysis.</>
                                        )}
                                    </p>
                                    <Link to="/knowledge" className="text-sm text-primary font-medium hover:underline mt-2 inline-block">
                                        Improve Knowledge Base →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && projects.length === 0 && !isNewUser && (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                    <FolderIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">No projects yet</p>
                    <Link to="/projects" className="btn-primary inline-flex">
                        <PlusIcon className="h-4 w-4" /> Create Project
                    </Link>
                </div>
            )}
        </div>
    );
}
