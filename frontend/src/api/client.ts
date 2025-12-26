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

    getUpcomingDeadlines: (days?: number) =>
        api.get('/projects/upcoming-deadlines', { params: days ? { days } : {} }),
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

    merge: (questionIds: number[], mergedText?: string) =>
        api.post('/questions/merge', { question_ids: questionIds, merged_text: mergedText }),

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

    pdf: (projectId: number) =>
        api.post('/export/pdf', { project_id: projectId }, { responseType: 'blob' }),

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

    // Q&A to Section Bridge (NEW)
    populateFromQA: (projectId: number, options?: {
        create_qa_section?: boolean;
        inject_into_sections?: boolean;
        use_ai_mapping?: boolean;
    }) => api.post(`/projects/${projectId}/sections/populate-from-qa`, options || {}),

    getQAMappingPreview: (projectId: number) =>
        api.get(`/projects/${projectId}/sections/qa-mapping-preview`),

    injectQAIntoSection: (sectionId: number, questionIds?: number[]) =>
        api.post(`/sections/${sectionId}/inject-qa`, questionIds ? { question_ids: questionIds } : {}),

    populateQASection: (projectId: number) =>
        api.post(`/projects/${projectId}/sections/populate-qa-section`),
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

    approve: (id: number) =>
        api.post(`/answer-library/${id}/approve`),

    archive: (id: number) =>
        api.post(`/answer-library/${id}/archive`),

    getCategories: () =>
        api.get('/answer-library/categories'),

    getAllTags: () =>
        api.get('/answer-library/all-tags'),

    getSuggestedTags: (text: string, limit?: number) =>
        api.get('/answer-library/suggested-tags', { params: { text, limit } }),
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

    getContentPerformance: () =>
        api.get('/analytics/content-performance'),

    getWinLossDeepDive: () =>
        api.get('/analytics/win-loss-deep-dive'),
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

// ===============================
// Comments API
// ===============================

export const commentsApi = {
    list: (params: { section_id?: number; question_id?: number; answer_id?: number; include_resolved?: boolean }) =>
        api.get('/comments', { params }),

    create: (data: {
        content: string;
        section_id?: number;
        question_id?: number;
        answer_id?: number;
        parent_id?: number;
    }) => api.post('/comments', data),

    update: (commentId: number, data: { content: string }) =>
        api.put(`/comments/${commentId}`, data),

    resolve: (commentId: number, resolved: boolean = true) =>
        api.put(`/comments/${commentId}/resolve`, { resolved }),

    delete: (commentId: number) =>
        api.delete(`/comments/${commentId}`),

    getUsersForMention: (search?: string) =>
        api.get('/comments/users-for-mention', { params: { search } }),
};

// ===============================
// Search API
// ===============================

export const searchApi = {
    smart: (query: string, options?: { categories?: string[]; limit?: number }) =>
        api.post('/search/smart', { query, ...options }),
};

// ===============================
// Activity API
// ===============================

export const activityApi = {
    getProjectActivity: (projectId: number, params?: { limit?: number; offset?: number }) =>
        api.get(`/activity/project/${projectId}`, { params }),

    getRecentActivity: (params?: { limit?: number }) =>
        api.get('/activity/recent', { params }),

    log: (data: {
        action: string;
        entity_type: string;
        entity_id?: number;
        entity_name?: string;
        project_id?: number;
        description?: string;
        extra_data?: Record<string, unknown>;
    }) => api.post('/activity', data),
};

// ===============================
// Diagrams API
// ===============================

export const diagramsApi = {
    getDiagramTypes: () =>
        api.get('/agents/diagram-types'),

    generateDiagram: (documentId: number, diagramType: string = 'architecture') =>
        api.post('/agents/generate-diagram', { document_id: documentId, diagram_type: diagramType }),

    generateAllDiagrams: (documentId: number, diagramTypes?: string[]) =>
        api.post('/agents/generate-all-diagrams', { document_id: documentId, diagram_types: diagramTypes }),
};

// ===============================
// PPT Generation API
// ===============================

export const pptApi = {
    generate: (projectId: number, options?: { style?: string; branding?: Record<string, string> }) =>
        api.post(`/ppt/generate/${projectId}`, options, { responseType: 'blob' }),

    preview: (projectId: number) =>
        api.get(`/ppt/preview/${projectId}`),

    getStyles: () =>
        api.get('/ppt/styles'),
};

// ===============================
// Agents API (NEW)
// ===============================

export const agentsApi = {
    // Health & Status
    getHealth: () =>
        api.get('/agents/health'),

    // RFP Analysis
    analyzeRfp: (documentId: number, options?: { tone?: string; length?: string }) =>
        api.post('/agents/analyze-rfp', { document_id: documentId, options }),

    analyzeDocument: (documentId: number) =>
        api.post('/agents/analyze-document', { document_id: documentId }),

    extractQuestions: (documentId: number) =>
        api.post('/agents/extract-questions', { document_id: documentId }),

    generateAnswers: (questions: Array<{ id: number; text: string; category?: string }>, options?: { tone?: string; length?: string }) =>
        api.post('/agents/generate-answers', { questions, options }),

    // Multi-Document Analysis
    analyzeMultipleDocuments: (documents: Array<{ id: number; name: string; text: string }>) =>
        api.post('/agents/analyze-multiple-documents', { documents }),

    // Feedback Learning
    analyzeFeedbackEdit: (data: {
        original_answer: string;
        edited_answer: string;
        question_text: string;
        category?: string;
        question_id?: number;
    }) => api.post('/agents/feedback/analyze-edit', data),

    getLearnedContext: (params?: { category?: string; limit?: number }) =>
        api.get('/agents/feedback/learned-context', { params }),

    // Section Mapping
    mapQuestionsToSections: (questions: Array<{ id: number; text: string; category?: string }>) =>
        api.post('/agents/sections/map-questions', { questions }),

    getAvailableSections: () =>
        api.get('/agents/sections/available'),

    // Metrics & Dashboard
    getMetricsDashboard: () =>
        api.get('/agents/metrics/dashboard'),

    getAgentMetrics: (agentName: string, hoursBack: number = 24) =>
        api.get(`/agents/metrics/agent/${agentName}`, { params: { hours_back: hoursBack } }),

    // A/B Experiments
    createExperiment: (data: {
        experiment_id: string;
        agent_name: string;
        control_version: string;
        treatment_version: string;
        traffic_split?: number;
    }) => api.post('/agents/experiments', data),

    getExperimentResults: (experimentId: string) =>
        api.get(`/agents/experiments/${experimentId}`),

    // Async Jobs
    analyzeRfpAsync: (documentId: number, options?: { tone?: string; length?: string }) =>
        api.post('/agents/analyze-rfp-async', { document_id: documentId, options }),

    getJobStatus: (jobId: string) =>
        api.get(`/agents/job-status/${jobId}`),

    cancelJob: (jobId: string) =>
        api.post(`/agents/cancel-job/${jobId}`),

    // ========================================
    // PRICING CALCULATOR (NEW)
    // ========================================
    calculatePricing: (projectId: number, options?: { complexity?: string; duration_weeks?: number }) =>
        api.post('/agents/calculate-pricing', { project_id: projectId, ...options }),

    estimateEffort: (requirements: string[], complexity: string = 'medium') =>
        api.post('/agents/estimate-effort', { requirements, complexity }),

    // ========================================
    // LEGAL REVIEW (NEW)
    // ========================================
    legalReview: (projectId: number, checkMode: string = 'full') =>
        api.post('/agents/legal-review', { project_id: projectId, check_mode: checkMode }),

    legalQuickCheck: (content: string) =>
        api.post('/agents/legal-quick-check', { content }),

    // ========================================
    // WIN THEMES (NEW)
    // ========================================
    generateWinThemes: (projectId: number, options?: {
        rfp_requirements?: string[];
        evaluation_criteria?: string[];
    }) =>
        api.post('/agents/generate-win-themes', { project_id: projectId, ...options }),

    applyThemesToSection: (sectionContent: string, sectionName: string, winThemes: Array<{ theme_title: string; sections_to_apply: string[] }>) =>
        api.post('/agents/apply-themes-to-section', { section_content: sectionContent, section_name: sectionName, win_themes: winThemes }),

    // ========================================
    // COMPETITIVE ANALYSIS (NEW)
    // ========================================
    competitiveAnalysis: (projectId: number, options?: {
        known_competitors?: string[];
        industry?: string;
    }) =>
        api.post('/agents/competitive-analysis', { project_id: projectId, ...options }),

    generateCounterObjections: (objections: string[], vendorProfile?: Record<string, unknown>) =>
        api.post('/agents/counter-objections', { objections, vendor_profile: vendorProfile }),

    // ========================================
    // STRATEGY PERSISTENCE (NEW)
    // ========================================
    getProjectStrategy: (projectId: number) =>
        api.get(`/agents/strategy/${projectId}`),

    saveWinThemes: (projectId: number, themesData: Record<string, unknown>) =>
        api.post(`/agents/strategy/${projectId}/win-themes`, themesData),

    saveCompetitiveAnalysis: (projectId: number, analysisData: Record<string, unknown>) =>
        api.post(`/agents/strategy/${projectId}/competitive-analysis`, analysisData),

    savePricing: (projectId: number, pricingData: Record<string, unknown>) =>
        api.post(`/agents/strategy/${projectId}/pricing`, pricingData),

    saveLegalReview: (projectId: number, reviewData: Record<string, unknown>) =>
        api.post(`/agents/strategy/${projectId}/legal-review`, reviewData),
};



// Co-Pilot AI Chat API
export const copilotApi = {
    // Sessions CRUD
    getSessions: () => api.get('/copilot/sessions'),

    createSession: (data?: { title?: string; mode?: string }) =>
        api.post('/copilot/sessions', data),

    getSession: (sessionId: number) =>
        api.get(`/copilot/sessions/${sessionId}`),

    updateSession: (sessionId: number, data: { title?: string }) =>
        api.put(`/copilot/sessions/${sessionId}`, data),

    deleteSession: (sessionId: number) =>
        api.delete(`/copilot/sessions/${sessionId}`),

    // Chat (send message within session)
    chat: (sessionId: number, data: {
        content: string;
        mode?: 'general' | 'agents';
        agent_id?: string;
        use_web_search?: boolean;
    }) => api.post(`/copilot/sessions/${sessionId}/chat`, data),

    // Get available agents
    getAgents: () => api.get('/copilot/agents'),

    // Health check
    health: () => api.get('/copilot/health'),
};

// ===============================
// Export Templates API
// ===============================

export const exportTemplatesApi = {
    // List all export templates
    list: (type?: 'docx' | 'pptx') =>
        api.get('/export-templates', { params: type ? { type } : {} }),

    // Upload new template
    upload: (file: File, name: string, description?: string, isDefault?: boolean) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        if (description) formData.append('description', description);
        if (isDefault) formData.append('is_default', 'true');
        return api.post('/export-templates/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    // Delete template
    delete: (templateId: number) =>
        api.delete(`/export-templates/${templateId}`),

    // Set as default
    setDefault: (templateId: number) =>
        api.put(`/export-templates/${templateId}/set-default`),

    // Download template
    download: (templateId: number) =>
        api.get(`/export-templates/${templateId}/download`, { responseType: 'blob' }),

    // Get default template for type
    getDefault: (type: 'docx' | 'pptx') =>
        api.get(`/export-templates/default/${type}`),
};

export default api;

