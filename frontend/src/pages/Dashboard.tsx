import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
    FolderIcon,
    DocumentTextIcon,
    CheckCircleIcon,
    ClockIcon,
    PlusIcon,
    ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

// Placeholder stats - in production, these would come from API
const stats = [
    { name: 'Active Projects', value: '4', icon: FolderIcon, color: 'bg-primary-light text-primary' },
    { name: 'Pending Reviews', value: '12', icon: ClockIcon, color: 'bg-warning-light text-warning' },
    { name: 'Completed', value: '28', icon: CheckCircleIcon, color: 'bg-success-light text-success' },
    { name: 'Questions Answered', value: '156', icon: DocumentTextIcon, color: 'bg-purple-100 text-purple-600' },
];

const recentProjects = [
    { id: 1, name: 'Enterprise Security RFP', status: 'in_progress', completion: 65, questions: 45 },
    { id: 2, name: 'Cloud Migration Questionnaire', status: 'review', completion: 100, questions: 32 },
    { id: 3, name: 'SOC 2 Compliance Assessment', status: 'draft', completion: 20, questions: 78 },
];

export default function Dashboard() {
    const { user } = useAuthStore();

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-text-primary">
                        Welcome back, {user?.name?.split(' ')[0] || 'User'}
                    </h1>
                    <p className="mt-1 text-text-secondary">
                        Here's what's happening with your RFP responses
                    </p>
                </div>
                <Link to="/projects" className="btn-primary">
                    <PlusIcon className="h-5 w-5" />
                    New Project
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.name} className="card">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${stat.color}`}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold text-text-primary">{stat.value}</p>
                                <p className="text-sm text-text-secondary">{stat.name}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Projects */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-text-primary">Recent Projects</h2>
                    <Link to="/projects" className="text-sm text-primary font-medium hover:underline">
                        View all
                    </Link>
                </div>

                <div className="space-y-4">
                    {recentProjects.map((project) => (
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
                                    {project.questions} questions
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-text-primary">{project.completion}%</p>
                                    <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden mt-1">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all"
                                            style={{ width: `${project.completion}%` }}
                                        />
                                    </div>
                                </div>
                                <span className={`badge ${project.status === 'completed' ? 'badge-success' :
                                        project.status === 'review' ? 'badge-warning' :
                                            project.status === 'in_progress' ? 'badge-primary' :
                                                'badge-neutral'
                                    }`}>
                                    {project.status.replace('_', ' ')}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* AI Insights */}
            <div className="card bg-gradient-to-br from-primary-50 to-purple-50 border-primary-100">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-white shadow-sm">
                        <ArrowTrendingUpIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-text-primary">AI Performance Insights</h3>
                        <p className="mt-1 text-sm text-text-secondary">
                            Your AI-generated answers have an 87% approval rate this month.
                            The knowledge base has been updated 12 times, improving answer accuracy by 15%.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
