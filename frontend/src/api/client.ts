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
        // Outcome fields
        outcome: 'pending' | 'won' | 'lost' | 'abandoned';
        outcome_date: string;
        outcome_notes: string;
        contract_value: number;
        loss_reason: string;
    }>) =>
        api.put(`/projects/${id}`, data),

    updateOutcome: (id: number, data: {
        outcome: 'pending' | 'won' | 'lost' | 'abandoned';
        outcome_notes?: string;
        contract_value?: number;
        loss_reason?: string;
    }) =>
        api.put(`/projects/${id}/outcome`, data),

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

    // Preview and Download
    getPreviewUrl: (id: number) => `/api/documents/${id}/preview`,

    getDownloadUrl: (id: number) => `/api/documents/${id}/download`,
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

    generateAnswer: (questionId: number) =>
        api.post(`/questions/${questionId}/generate-answer`),

    delete: (id: number) =>
        api.delete(`/questions/${id}`),

    // Auto-answer matching
    autoMatch: (projectId: number, questionIds?: number[]) =>
        api.post('/questions/auto-match', { project_id: projectId, question_ids: questionIds }),

    getSuggestions: (questionId: number) =>
        api.get(`/questions/${questionId}/suggestions`),

    applySuggestion: (questionId: number, sourceAnswerId: number) =>
        api.post(`/questions/${questionId}/apply-suggestion`, { source_answer_id: sourceAnswerId }),
};

// ===============================
// Answers API
// ===============================

export const answersApi = {
    generate: (questionId: number, options?: { tone?: string; length?: string }) =>
        api.post('/answers/generate', { question_id: questionId, options }),

    regenerate: (questionId: number, feedback?: string, action: string = 'regenerate') =>
        api.post('/answers/regenerate', { question_id: questionId, feedback, action }),

    create: (questionId: number, content: string) =>
        api.post('/answers', { question_id: questionId, content }),

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
        assigned_to: number | null;
        due_date: string | null;
        priority: 'low' | 'normal' | 'high' | 'urgent';
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

    // Chat for section generation
    chat: (data: {
        project_id: number;
        section_type_id?: number;
        message: string;
        knowledge_item_ids?: number[];
        conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => api.post('/sections/chat', data),

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

    // Section History
    getHistory: (sectionId: number) =>
        api.get(`/sections/${sectionId}/history`),

    restoreVersion: (sectionId: number, versionNumber: number) =>
        api.post(`/sections/${sectionId}/restore/${versionNumber}`),

    // Section Comments
    addComment: (sectionId: number, text: string) =>
        api.post(`/sections/${sectionId}/comments`, { text }),

    deleteComment: (sectionId: number, commentId: number) =>
        api.delete(`/sections/${sectionId}/comments/${commentId}`),
};

// ===============================
// Users API
// ===============================

export const usersApi = {
    list: () =>
        api.get('/users/list'),

    getProfile: () =>
        api.get('/users/profile'),

    updateProfile: (data: { name?: string; email?: string }) =>
        api.put('/users/profile', data),

    uploadPhoto: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/users/profile/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    removePhoto: () =>
        api.delete('/users/profile/photo'),

    changePassword: (data: { current_password: string; new_password: string }) =>
        api.put('/users/profile/password', data),
};

// ===============================
// Organizations API
// ===============================

export const organizationsApi = {
    get: () =>
        api.get('/organizations'),

    create: (data: { name: string; settings?: Record<string, any> }) =>
        api.post('/organizations', data),

    update: (id: number, data: { name?: string; settings?: Record<string, any> }) =>
        api.put(`/organizations/${id}`, data),

    delete: (id: number, confirm: boolean = false) =>
        api.delete(`/organizations/${id}`, { data: { confirm } }),

    extractVendorProfile: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/organizations/extract-vendor-profile', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    getMembers: () =>
        api.get('/organizations/members'),
};

// ===============================
// Invitations API
// ===============================

export const invitationsApi = {
    list: () =>
        api.get('/invitations'),

    create: (data: { email: string; role?: string }) =>
        api.post('/invitations', data),

    resend: (invitationId: number) =>
        api.post(`/invitations/${invitationId}/resend`),

    cancel: (invitationId: number) =>
        api.delete(`/invitations/${invitationId}`),

    validate: (token: string) =>
        api.get(`/invitations/validate/${token}`),

    accept: (token: string) =>
        api.post('/invitations/accept', { token }),

    acceptAndRegister: (data: { token: string; name: string; password: string }) =>
        api.post('/invitations/accept/register', data),
};

// ===============================
// Versions API
// ===============================

export const versionsApi = {
    list: (projectId: number) =>
        api.get(`/projects/${projectId}/versions`),

    create: (projectId: number, data: { title: string; description?: string; include_qa?: boolean }) =>
        api.post(`/projects/${projectId}/versions`, data),

    get: (id: number) =>
        api.get(`/versions/${id}`),

    getPreviewUrl: (id: number) => `/api/versions/${id}/preview`,

    getDownloadUrl: (id: number) => `/api/versions/${id}/download`,

    delete: (id: number) =>
        api.delete(`/versions/${id}`),

    restore: (id: number) =>
        api.post(`/versions/${id}/restore`),

    compare: (versionId: number, otherVersionId: number) =>
        api.get(`/versions/${versionId}/compare/${otherVersionId}`),

    branch: (id: number, mode: 'replace' | 'merge' = 'replace') =>
        api.post(`/versions/${id}/branch`, { mode }),
};

// ===============================
// Compliance API
// ===============================

export const complianceApi = {
    list: (projectId: number, params?: { category?: string; status?: string }) =>
        api.get(`/projects/${projectId}/compliance`, { params }),

    create: (projectId: number, data: {
        requirement_text: string;
        requirement_id?: string;
        source?: string;
        category?: string;
        compliance_status?: string;
        section_id?: number;
        response_summary?: string;
        notes?: string;
        priority?: string;
    }) => api.post(`/projects/${projectId}/compliance`, data),

    get: (id: number) =>
        api.get(`/compliance/${id}`),

    update: (id: number, data: Partial<{
        requirement_id: string;
        requirement_text: string;
        source: string;
        category: string;
        compliance_status: string;
        section_id: number | null;
        response_summary: string;
        notes: string;
        priority: string;
        order: number;
    }>) => api.put(`/compliance/${id}`, data),

    delete: (id: number) =>
        api.delete(`/compliance/${id}`),

    bulkCreate: (projectId: number, items: Array<{
        requirement_text: string;
        requirement_id?: string;
        source?: string;
        category?: string;
    }>) => api.post(`/projects/${projectId}/compliance/bulk`, { items }),

    extractFromDocuments: (projectId: number) =>
        api.post(`/projects/${projectId}/compliance/extract`),

    getExportUrl: (projectId: number) =>
        `/api/projects/${projectId}/compliance/export`,
};

// ===============================
// Answer Library API
// ===============================

export const answerLibraryApi = {
    list: (params?: { category?: string; tag?: string; search?: string }) =>
        api.get('/answer-library/list', { params }),

    get: (id: number) =>
        api.get(`/answer-library/${id}`),

    create: (data: {
        question_text: string;
        answer_text: string;
        category?: string;
        tags?: string[];
        source_project_id?: number;
        source_question_id?: number;
        source_answer_id?: number;
    }) => api.post('/answer-library', data),

    saveFromAnswer: (answerId: number, data?: { category?: string; tags?: string[] }) =>
        api.post(`/answer-library/from-answer/${answerId}`, data || {}),

    update: (id: number, data: Partial<{
        question_text: string;
        answer_text: string;
        category: string;
        tags: string[];
        is_active: boolean;
    }>) => api.put(`/answer-library/${id}`, data),

    delete: (id: number) =>
        api.delete(`/answer-library/${id}`),

    search: (query: string, category?: string, limit: number = 5) =>
        api.post('/answer-library/search', { query, category, limit }),

    recordUsage: (id: number, helpful: boolean = true) =>
        api.post(`/answer-library/${id}/use`, { helpful }),

    getCategories: () =>
        api.get('/answer-library/categories'),
};

// ===============================
// Go/No-Go Analysis API
// ===============================

export const goNoGoApi = {
    analyze: (projectId: number, criteria: {
        team_available?: number;
        required_team_size?: number;
        key_skills_available?: number;
        typical_response_days?: number;
        incumbent_advantage?: boolean;
        relationship_score?: number;
        pricing_competitiveness?: number;
        unique_capabilities?: number;
    }) => api.post(`/projects/${projectId}/go-no-go/analyze`, { criteria }),

    get: (projectId: number) =>
        api.get(`/projects/${projectId}/go-no-go`),

    getCriteria: (projectId: number) =>
        api.get(`/projects/${projectId}/go-no-go/criteria`),

    updateDecision: (projectId: number, decision: 'go' | 'no_go' | 'pending', notes?: string) =>
        api.put(`/projects/${projectId}/go-no-go/decision`, { decision, notes }),

    reset: (projectId: number) =>
        api.post(`/projects/${projectId}/go-no-go/reset`),
};

// ===============================
// Analytics API
// ===============================

export const analyticsApi = {
    getDashboard: () =>
        api.get('/analytics/dashboard'),

    getProjectStats: (projectId: number) =>
        api.get(`/analytics/project/${projectId}`),

    getOverview: () =>
        api.get('/analytics/overview'),

    getWinRateTrend: () =>
        api.get('/analytics/win-rate-trend'),

    getResponseTimes: () =>
        api.get('/analytics/response-times'),

    getTeamMetrics: () =>
        api.get('/analytics/team-metrics'),

    getLossReasons: () =>
        api.get('/analytics/loss-reasons'),
};

// ===============================
// Notifications API
// ===============================

export const notificationsApi = {
    list: (options?: { limit?: number; offset?: number; unread_only?: boolean }) =>
        api.get('/notifications', { params: options }),

    getUnreadCount: () =>
        api.get('/notifications/unread-count'),

    markAsRead: (notificationId: number) =>
        api.put(`/notifications/${notificationId}/read`),

    markAllAsRead: () =>
        api.put('/notifications/read-all'),

    delete: (notificationId: number) =>
        api.delete(`/notifications/${notificationId}`),
};

export default api;


