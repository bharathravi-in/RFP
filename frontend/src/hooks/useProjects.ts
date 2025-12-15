import { useState, useEffect, useCallback } from 'react';
import { projectsApi } from '@/api/client';
import { Project, CreateProjectData } from '@/types';

interface UseProjectsReturn {
    projects: Project[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createProject: (data: CreateProjectData) => Promise<Project>;
    updateProject: (id: number, data: Partial<CreateProjectData>) => Promise<Project>;
    deleteProject: (id: number) => Promise<void>;
}

export function useProjects(): UseProjectsReturn {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjects = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await projectsApi.list();
            setProjects(response.data.projects || []);
        } catch (err) {
            setError('Failed to load projects');
            console.error('Failed to fetch projects:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const createProject = async (data: CreateProjectData): Promise<Project> => {
        const response = await projectsApi.create(data);
        const newProject = response.data.project;
        setProjects((prev) => [newProject, ...prev]);
        return newProject;
    };

    const updateProject = async (id: number, data: Partial<CreateProjectData>): Promise<Project> => {
        const response = await projectsApi.update(id, data);
        const updatedProject = response.data.project;
        setProjects((prev) =>
            prev.map((p) => (p.id === id ? updatedProject : p))
        );
        return updatedProject;
    };

    const deleteProject = async (id: number): Promise<void> => {
        await projectsApi.delete(id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
    };

    return {
        projects,
        isLoading,
        error,
        refresh: fetchProjects,
        createProject,
        updateProject,
        deleteProject,
    };
}

// Hook for a single project
export function useProject(id: number | undefined) {
    const [project, setProject] = useState<Project | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProject = useCallback(async () => {
        if (!id) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await projectsApi.get(id);
            setProject(response.data.project);
        } catch (err) {
            setError('Failed to load project');
            console.error('Failed to fetch project:', err);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchProject();
    }, [fetchProject]);

    return {
        project,
        isLoading,
        error,
        refresh: fetchProject,
    };
}
