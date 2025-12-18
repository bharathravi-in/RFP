import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// Create axios instance
const api: AxiosInstance = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Handle 401 - try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    const response = await axios.post('/api/auth/refresh', {}, {
                        headers: { Authorization: `Bearer ${refreshToken}` }
                    });

                    const { access_token } = response.data;
                    localStorage.setItem('access_token', access_token);

                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // Refresh failed - logout
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            }
        }

        return Promise.reject(error);
    }
);

// ===============================
// Auth API
// ===============================

export const authApi = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    register: (data: { email: string; password: string; name: string; organization_name?: string }) =>
        api.post('/auth/register', data),

    logout: () =>
        api.post('/auth/logout'),

    me: () =>
        api.get('/auth/me'),
};

// ===============================
// Projects API
// ===============================

export const projectsApi = {
    list: () =>
        api.get('/projects'),

    get: (id: number) =>
        api.get(`/projects/${id}`),

    create: (data: {
        name: string;
        description?: string;
        due_date?: string;
        client_name?: string;
        client_type?: string;
        geography?: string;
        currency?: string;
        industry?: string;
        compliance_requirements?: string[];
        knowledge_profile_ids?: number[];
    }) =>
        api.post('/projects', data),

    update: (id: number, data: Partial<{
        name: string;
        description: string;
        status: string;
        due_date: string;
        client_name: string;
        client_type: string;
        geography: string;
        currency: string;
        industry: string;
        compliance_requirements: string[];
        knowledge_profile_ids: number[];
    }>) =>
        api.put(`/projects/${id}`, data),

    delete: (id: number) =>
        api.delete(`/projects/${id}`),

    assignReviewers: (id: number, reviewerIds: number[]) =>
        api.post(`/projects/${id}/reviewers`, { reviewer_ids: reviewerIds }),
};

// ===============================
// Documents API
// ===============================

export const documentsApi = {
    list: (projectId: number) =>
        api.get('/documents', { params: { project_id: projectId } }),

    upload: (projectId: number, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', projectId.toString());
        return api.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    get: (id: number) =>
        api.get(`/documents/${id}`),

    parse: (id: number) =>
        api.post(`/documents/${id}/parse`),

    delete: (id: number) =>
        api.delete(`/documents/${id}`),

    // RFP Analysis
    analyze: (id: number) =>
        api.post(`/documents/${id}/analyze`),

    autoBuildProposal: (id: number, sectionTypeIds: number[], generateContent = false) =>
        api.post(`/documents/${id}/auto-build`, {
            section_type_ids: sectionTypeIds,
            generate_content: generateContent
        }),
};

// ===============================
// Questions API
// ===============================

export const questionsApi = {
    list: (projectId: number) =>
        api.get('/questions', { params: { project_id: projectId } }),

    get: (id: number) =>
        api.get(`/questions/${id}`),

    create: (projectId: number, data: { text: string; section?: string }) =>
        api.post('/questions', { project_id: projectId, ...data }),

    update: (id: number, data: Partial<{ text: string; section: string; order: number; status: string; notes: string }>) =>
        api.put(`/questions/${id}`, data),

    merge: (questionIds: number[]) =>
        api.post('/questions/merge', { question_ids: questionIds }),

    split: (questionId: number, texts: string[]) =>
        api.post('/questions/split', { question_id: questionId, texts }),

    delete: (id: number) =>
        api.delete(`/questions/${id}`),
};

// ===============================
// Answers API
// ===============================

export const answersApi = {
    generate: (questionId: number, options?: { tone?: string; length?: string }) =>
        api.post('/answers/generate', { question_id: questionId, options }),

    regenerate: (questionId: number, feedback?: string, action: string = 'regenerate') =>
        api.post('/answers/regenerate', { question_id: questionId, feedback, action }),

    update: (id: number, content: string) =>
        api.put(`/answers/${id}`, { content }),

    review: (id: number, action: 'approve' | 'reject', notes?: string) =>
        api.put(`/answers/${id}/review`, { action, notes }),

    addComment: (answerId: number, content: string, position?: { start: number; end: number }) =>
        api.post(`/answers/${answerId}/comment`, { content, position }),

    resolveComment: (commentId: number, resolved: boolean) =>
        api.put(`/answers/comments/${commentId}`, { resolved }),
};

// ===============================
// Knowledge API
// ===============================

export const knowledgeApi = {
    list: (params?: { tag?: string; source_type?: string; search?: string }) =>
        api.get('/knowledge', { params }),

    get: (id: number) =>
        api.get(`/knowledge/${id}`),

    create: (data: { title: string; content: string; tags?: string[] }) =>
        api.post('/knowledge', data),

    update: (id: number, data: Partial<{ title: string; content: string; tags: string[]; is_active: boolean }>) =>
        api.put(`/knowledge/${id}`, data),

    delete: (id: number) =>
        api.delete(`/knowledge/${id}`),

    search: (query: string, limit?: number) =>
        api.post('/knowledge/search', { query, limit }),

    reindex: () =>
        api.post('/knowledge/reindex'),
};

// ===============================
// Export API
// ===============================

export const exportApi = {
    preview: (projectId: number) =>
        api.post('/export/preview', { project_id: projectId }),

    docx: (projectId: number) =>
        api.post('/export/docx', { project_id: projectId }, { responseType: 'blob' }),

    xlsx: (projectId: number) =>
        api.post('/export/xlsx', { project_id: projectId }, { responseType: 'blob' }),

    complete: (projectId: number) =>
        api.post('/export/complete', { project_id: projectId }),
};

// ===============================
// Sections API
// ===============================

export const sectionsApi = {
    // Section Types
    listTypes: () =>
        api.get('/section-types'),

    createType: (data: {
        name: string;
        slug: string;
        description?: string;
        icon?: string;
        default_prompt?: string;
        required_inputs?: string[];
        knowledge_scopes?: string[];
    }) => api.post('/section-types', data),

    updateType: (id: number, data: Partial<{
        name: string;
        description: string;
        icon: string;
        default_prompt: string;
        required_inputs: string[];
        knowledge_scopes: string[];
        is_active: boolean;
    }>) => api.put(`/section-types/${id}`, data),

    deleteType: (id: number) =>
        api.delete(`/section-types/${id}`),

    seedTypes: () =>
        api.post('/section-types/seed'),

    // Project Sections
    listSections: (projectId: number) =>
        api.get(`/projects/${projectId}/sections`),

    getSection: (projectId: number, sectionId: number) =>
        api.get(`/projects/${projectId}/sections/${sectionId}`),

    addSection: (projectId: number, data: {
        section_type_id: number;
        title?: string;
        inputs?: Record<string, string>;
        ai_generation_params?: Record<string, string>;
    }) => api.post(`/projects/${projectId}/sections`, data),

    updateSection: (projectId: number, sectionId: number, data: Partial<{
        title: string;
        content: string;
        inputs: Record<string, string>;
        ai_generation_params: Record<string, string>;
        order: number;
        status: string;
        flags: any[];
    }>) => api.put(`/projects/${projectId}/sections/${sectionId}`, data),

    deleteSection: (projectId: number, sectionId: number) =>
        api.delete(`/projects/${projectId}/sections/${sectionId}`),

    reorderSections: (projectId: number, sectionOrder: number[]) =>
        api.post(`/projects/${projectId}/sections/reorder`, { section_order: sectionOrder }),

    // Section Generation
    generateSection: (sectionId: number, data?: {
        inputs?: Record<string, string>;
        generation_params?: { tone?: string; length?: string };
    }) => api.post(`/sections/${sectionId}/generate`, data || {}),

    regenerateSection: (sectionId: number, feedback: string) =>
        api.post(`/sections/${sectionId}/regenerate`, { feedback }),

    reviewSection: (sectionId: number, action: 'approve' | 'reject') =>
        api.post(`/sections/${sectionId}/review`, { action }),

    // Templates
    listTemplates: (sectionTypeId?: number) =>
        api.get('/section-templates', { params: sectionTypeId ? { section_type_id: sectionTypeId } : {} }),

    createTemplate: (data: {
        name: string;
        content: string;
        section_type_id?: number;
        variables?: string[];
        description?: string;
        is_default?: boolean;
    }) => api.post('/section-templates', data),

    updateTemplate: (templateId: number, data: Partial<{
        name: string;
        content: string;
        variables: string[];
        description: string;
        is_default: boolean;
        section_type_id: number;
    }>) => api.put(`/section-templates/${templateId}`, data),

    deleteTemplate: (templateId: number) =>
        api.delete(`/section-templates/${templateId}`),

    applyTemplate: (templateId: number, sectionId: number, variables: Record<string, string>) =>
        api.post(`/section-templates/${templateId}/apply`, { section_id: sectionId, variables }),

    // Export
    exportProposal: (projectId: number, format: 'docx' | 'xlsx' = 'docx', includeQA: boolean = true) =>
        api.post(`/projects/${projectId}/export/proposal`, { format, include_qa: includeQA }, { responseType: 'blob' }),

    getExportPreview: (projectId: number) =>
        api.get(`/projects/${projectId}/export/preview`),
};

export default api;
