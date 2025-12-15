import { useState, useEffect } from 'react';
import { api } from '@/api/client';

interface DashboardStats {
    total_projects: number;
    active_projects: number;
    total_questions: number;
    answered_questions: number;
    approved_answers: number;
    knowledge_items: number;
    answer_rate: number;
    approval_rate: number;
}

interface ActivityDay {
    date: string;
    day: string;
    answers: number;
}

interface DashboardData {
    stats: DashboardStats;
    recent_projects: any[];
    activity: ActivityDay[];
}

export function useAnalytics() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/analytics/dashboard');
            setData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectStats = async (projectId: number) => {
        try {
            const response = await api.get(`/analytics/project/${projectId}`);
            return response.data;
        } catch (err: any) {
            throw new Error(err.response?.data?.error || 'Failed to load project stats');
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    return {
        data,
        loading,
        error,
        refresh: fetchDashboard,
        fetchProjectStats,
    };
}
