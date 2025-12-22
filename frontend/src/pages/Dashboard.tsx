import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { projectsApi, questionsApi, knowledgeApi, sectionsApi } from '@/api/client';
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
    LightBulbIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import RFPSummaryCard from '@/components/dashboard/RFPSummaryCard';
import SectionCompletionWidget from '@/components/dashboard/SectionCompletionWidget';
import VendorEligibilityPanel from '@/components/dashboard/VendorEligibilityPanel';
import { WinRateChart, RevenueStatsCard, TeamLeaderboard, LossReasonsChart, QuickStatsRow } from '@/components/analytics/AnalyticsCharts';

interface DashboardStats {
    activeProjects: number;
    pendingReviews: number;
    completedProjects: number;
    totalQuestions: number;
    knowledgeItems: number;
}

interface QuickAction {
    title: string;
    description: string;
    href: string;
    icon: typeof FolderIcon;
    color: string;
    bgColor: string;
}

// Loading skeleton component
function StatSkeleton() {
    return (
        <div className="card animate-pulse">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gray-200 h-12 w-12" />
                <div>
                    <div className="h-7 w-16 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-24 bg-gray-100 rounded" />
                </div>
            </div>
        </div>
    );
}

function ProjectSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl animate-pulse">
            <div className="h-10 w-10 rounded-lg bg-gray-200" />
            <div className="flex-1">
                <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-24 bg-gray-100 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-200 rounded-full" />
        </div>
    );
}

export default function Dashboard() {
    const { user, organization } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectsWithStats, setProjectsWithStats] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch dashboard data
    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch projects
                const projectsResponse = await projectsApi.list();
                const allProjects = projectsResponse.data.projects || [];

                // Calculate stats from real data
                const activeProjects = allProjects.filter(
                    (p: Project) => p.status === 'in_progress' || p.status === 'draft'
                ).length;
                const pendingReviews = allProjects.filter(
                    (p: Project) => p.status === 'review'
                ).length;
                const completedProjects = allProjects.filter(
                    (p: Project) => p.status === 'completed'
                ).length;

                // Try to get knowledge items count
                let knowledgeItems = 0;
                try {
                    const knowledgeResponse = await knowledgeApi.list();
                    knowledgeItems = knowledgeResponse.data.items?.length || 0;
                } catch {
                    // Knowledge API might not be accessible
                }

                // Calculate total questions across all projects
                let totalQuestions = 0;
                for (const project of allProjects.slice(0, 5)) {
                    try {
                        const questionsResponse = await questionsApi.list(project.id);
                        totalQuestions += questionsResponse.data.questions?.length || 0;
                    } catch {
                        // Continue if questions API fails
                    }
                }

                setStats({
                    activeProjects,
                    pendingReviews,
                    completedProjects,
                    totalQuestions,
                    knowledgeItems,
                });

                // Sort projects by updated_at and take recent ones
                const sortedProjects = allProjects.sort((a: Project, b: Project) => {
                    const dateA = new Date(a.updated_at || a.created_at).getTime();
                    const dateB = new Date(b.updated_at || b.created_at).getTime();
                    return dateB - dateA;
                });
                setProjects(sortedProjects.slice(0, 5));

            } catch (err) {
                console.error('Failed to load dashboard data:', err);
                setError('Failed to load dashboard data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, []);

    const quickActions: QuickAction[] = [
        {
            title: 'Setup Knowledge Profile',
            description: 'Create profile with dimensions',
            href: '/settings?tab=knowledge',
            icon: BookOpenIcon,
            color: 'text-green-600',
            bgColor: 'bg-green-50 hover:bg-green-100',
        },
        {
            title: 'Build Knowledge Base',
            description: 'Upload reusable content',
            href: '/knowledge',
            icon: DocumentTextIcon,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50 hover:bg-purple-100',
        },
        {
            title: 'Create New Project',
            description: 'Start a new RFP response',
            href: '/projects?action=create',
            icon: PlusIcon,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50 hover:bg-blue-100',
        },
        {
            title: 'Upload RFP Document',
            description: 'Import and analyze an RFP',
            href: '/projects',
            icon: DocumentArrowUpIcon,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50 hover:bg-orange-100',
        },
    ];

    const statsConfig = [
        {
            name: 'Active Projects',
            value: stats?.activeProjects || 0,
            icon: FolderIcon,
            color: 'bg-primary-100 text-primary-700',
            href: '/projects?status=active'
        },
        {
            name: 'Pending Reviews',
            value: stats?.pendingReviews || 0,
            icon: ClockIcon,
            color: 'bg-warning-light text-warning-dark',
            href: '/projects?status=review'
        },
        {
            name: 'Completed',
            value: stats?.completedProjects || 0,
            icon: CheckCircleIcon,
            color: 'bg-success-light text-success-dark',
            href: '/projects?status=completed'
        },
        {
            name: 'Knowledge Items',
            value: stats?.knowledgeItems || 0,
            icon: BookOpenIcon,
            color: 'bg-accent-light text-accent-dark',
            href: '/knowledge'
        },
    ];

    const isNewUser = !loading && projects.length === 0;

    return (
        <div className="space-y-6 md:space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="section-title">
                        Welcome back, {user?.name?.split(' ')[0] || 'User'}
                    </h1>
                    <p className="section-subtitle">
                        {isNewUser
                            ? "Let's get started with your first RFP response"
                            : "Here's what's happening with your RFP responses"
                        }
                    </p>
                </div>
                <Link to="/projects" className="btn-primary self-start sm:self-auto">
                    <PlusIcon className="h-5 w-5" />
                    <span className="hidden xs:inline">New Project</span>
                    <span className="xs:hidden">New</span>
                </Link>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    {error}
                    <button
                        onClick={() => window.location.reload()}
                        className="ml-4 underline hover:no-underline"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Quick Start Guide for New Users */}
            {isNewUser && (
                <div className="card bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-blue-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-white shadow-sm">
                            <RocketLaunchIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-text-primary text-lg">
                                Getting Started with RFP War Room
                            </h3>
                            <p className="mt-1 text-text-secondary mb-4">
                                Follow these steps to respond to your first RFP efficiently:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="flex items-start gap-3 p-3 bg-white/60 rounded-lg">
                                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
                                        1
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Knowledge Profile</p>
                                        <p className="text-xs text-text-secondary mt-0.5">Set up dimensions like client type, industry</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-white/60 rounded-lg">
                                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-medium">
                                        2
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Knowledge Base</p>
                                        <p className="text-xs text-text-secondary mt-0.5">Upload past proposals & content</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-white/60 rounded-lg">
                                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                                        3
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Create Project</p>
                                        <p className="text-xs text-text-secondary mt-0.5">Start new RFP response project</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-white/60 rounded-lg">
                                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-medium">
                                        4
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Upload & Analyze</p>
                                        <p className="text-xs text-text-secondary mt-0.5">AI extracts questions & sections</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-white/60 rounded-lg">
                                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center text-sm font-medium">
                                        5
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Generate & Export</p>
                                        <p className="text-xs text-text-secondary mt-0.5">Generate answers, export proposal</p>
                                    </div>
                                </div>
                            </div>
                            <Link
                                to="/projects"
                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                Start Your First Project
                                <ArrowRightIcon className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="stats-grid">
                {loading ? (
                    <>
                        <StatSkeleton />
                        <StatSkeleton />
                        <StatSkeleton />
                        <StatSkeleton />
                    </>
                ) : (
                    statsConfig.map((stat) => (
                        <Link
                            key={stat.name}
                            to={stat.href}
                            className="card-interactive group"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${stat.color}`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-2xl font-semibold text-text-primary group-hover:text-primary transition-colors">
                                        {stat.value}
                                    </p>
                                    <p className="text-sm text-text-secondary">{stat.name}</p>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>

            {/* Quick Actions */}
            <div className="card">
                <h2 className="text-xl font-semibold text-text-primary mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {quickActions.map((action) => (
                        <Link
                            key={action.title}
                            to={action.href}
                            className={clsx(
                                'flex items-start gap-3 p-4 rounded-xl transition-all',
                                action.bgColor
                            )}
                        >
                            <action.icon className={clsx('h-6 w-6 flex-shrink-0', action.color)} />
                            <div>
                                <p className="font-medium text-text-primary">{action.title}</p>
                                <p className="text-sm text-text-secondary mt-0.5">{action.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Analytics Section - Win/Loss Tracking */}
            {!loading && projects.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold text-text-primary mb-4">📊 Analytics</h2>

                    {/* Quick Stats Row */}
                    <QuickStatsRow />

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                        <WinRateChart />
                        <RevenueStatsCard />
                        <TeamLeaderboard />
                        <LossReasonsChart />
                    </div>
                </div>
            )}

            {/* RFP Summary & Vendor Eligibility Row */}
            {!loading && projects.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* RFP Summary Cards - 2 columns */}
                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-semibold text-text-primary mb-4">
                            Active RFP Projects
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {projects.slice(0, 4).map((project) => (
                                <RFPSummaryCard
                                    key={project.id}
                                    project={{
                                        id: project.id,
                                        name: project.name,
                                        status: project.status,
                                        client_name: project.client_name,
                                        completion_percent: project.completion_percent,
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Vendor Eligibility Panel - 1 column */}
                    <div>
                        <h2 className="text-xl font-semibold text-text-primary mb-4">
                            Vendor Profile
                        </h2>
                        <VendorEligibilityPanel
                            organizationName={organization?.name || user?.name + "'s Organization"}
                            vendorProfile={(organization?.settings as any)?.vendor_profile}
                        />
                    </div>
                </div>
            )}

            {/* Recent Projects */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-text-primary">Recent Projects</h2>
                    <Link to="/projects" className="text-sm text-primary font-medium hover:underline">
                        View all
                    </Link>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        <ProjectSkeleton />
                        <ProjectSkeleton />
                        <ProjectSkeleton />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-12">
                        <FolderIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <p className="text-text-secondary mb-4">No projects yet</p>
                        <Link to="/projects" className="btn-primary inline-flex">
                            <PlusIcon className="h-5 w-5" />
                            Create Your First Project
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {projects.map((project) => (
                            <Link
                                key={project.id}
                                to={`/projects/${project.id}`}
                                className="flex items-center gap-4 p-4 rounded-xl hover:bg-background transition-colors group"
                            >
                                <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center">
                                    <FolderIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                                        {project.name}
                                    </p>
                                    <p className="text-sm text-text-secondary">
                                        {project.description || 'No description'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={clsx(
                                        'badge',
                                        project.status === 'completed' ? 'badge-success' :
                                            project.status === 'review' ? 'badge-warning' :
                                                project.status === 'in_progress' ? 'badge-primary' :
                                                    'badge-neutral'
                                    )}>
                                        {project.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* AI Insights (show only when there's data) */}
            {!loading && projects.length > 0 && (
                <div className="card bg-gradient-to-br from-primary-50 to-purple-50 border-primary-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-white shadow-sm">
                            <SparklesIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-text-primary">AI-Powered Insights</h3>
                            <p className="mt-1 text-sm text-text-secondary">
                                {stats?.totalQuestions && stats.totalQuestions > 0 ? (
                                    <>
                                        You have {stats.totalQuestions} questions across your projects.
                                        {stats.knowledgeItems > 0 && (
                                            <> Your knowledge base contains {stats.knowledgeItems} items to help generate accurate answers.</>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        Upload an RFP document to automatically extract questions and generate AI-powered answers.
                                    </>
                                )}
                            </p>
                        </div>
                        <Link
                            to="/knowledge"
                            className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                        >
                            <LightBulbIcon className="h-4 w-4" />
                            Improve Knowledge Base
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
