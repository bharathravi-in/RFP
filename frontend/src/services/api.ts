/**
 * Centralized API layer for RFP application.
 * 
 * Provides:
 * - Consistent error handling
 * - Automatic token management
 * - Request/response interceptors
 * - Type-safe API calls
 */

const API_BASE_URL = '/api';

interface ApiResponse<T> {
    data?: T;
    error?: {
        code: string;
        message: string;
        request_id?: string;
    };
}

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: any;
    headers?: Record<string, string>;
    skipAuth?: boolean;
}

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string | null {
    return localStorage.getItem('access_token');
}

/**
 * Handle API errors consistently
 */
function handleApiError(response: Response, data: any): never {
    const error = data?.error || { code: 'UNKNOWN', message: 'An error occurred' };

    // Handle auth errors
    if (response.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    }

    throw {
        status: response.status,
        code: error.code,
        message: error.message,
        request_id: error.request_id || response.headers.get('X-Request-ID'),
    };
}

/**
 * Core API request function
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, skipAuth = false } = options;

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
    };

    // Add auth token if available
    if (!skipAuth) {
        const token = getAuthToken();
        if (token) {
            requestHeaders['Authorization'] = `Bearer ${token}`;
        }
    }

    const config: RequestInit = {
        method,
        headers: requestHeaders,
    };

    if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Handle empty responses
    if (response.status === 204) {
        return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
        handleApiError(response, data);
    }

    return data;
}

/**
 * Upload file with multipart form data
 */
async function uploadFile<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, string>
): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });
    }

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        handleApiError(response, data);
    }

    return data;
}

// ================================================
// API Methods
// ================================================

export const api = {
    // Auth
    auth: {
        login: (email: string, password: string) =>
            request<{ access_token: string; user: any }>('/auth/login', {
                method: 'POST',
                body: { email, password },
                skipAuth: true,
            }),

        me: () => request<{ user: any }>('/auth/me'),

        logout: () => {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        },
    },

    // Projects
    projects: {
        list: () => request<any[]>('/projects'),

        get: (id: number) => request<any>(`/projects/${id}`),

        create: (data: { name: string; client_name: string; description?: string }) =>
            request<any>('/projects', { method: 'POST', body: data }),

        update: (id: number, data: any) =>
            request<any>(`/projects/${id}`, { method: 'PUT', body: data }),

        delete: (id: number) =>
            request<void>(`/projects/${id}`, { method: 'DELETE' }),
    },

    // Documents
    documents: {
        list: (projectId: number) => request<any[]>(`/documents?project_id=${projectId}`),

        get: (id: number) => request<any>(`/documents/${id}`),

        upload: (projectId: number, file: File) =>
            uploadFile<any>(`/documents?project_id=${projectId}`, file),

        delete: (id: number) =>
            request<void>(`/documents/${id}`, { method: 'DELETE' }),

        analyze: (id: number) =>
            request<any>(`/documents/${id}/analyze`, { method: 'POST' }),
    },

    // Knowledge Base
    knowledge: {
        list: () => request<any[]>('/knowledge'),

        get: (id: number) => request<any>(`/knowledge/${id}`),

        search: (query: string) =>
            request<any[]>(`/knowledge/search?q=${encodeURIComponent(query)}`),

        chat: (itemId: number) => request<any>(`/knowledge/${itemId}/chat`),

        sendMessage: (itemId: number, message: string) =>
            request<any>(`/knowledge/${itemId}/chat`, {
                method: 'POST',
                body: { message },
            }),
    },

    // Questions & Answers
    questions: {
        list: (projectId: number) => request<any[]>(`/questions?project_id=${projectId}`),

        get: (id: number) => request<any>(`/questions/${id}`),

        update: (id: number, data: any) =>
            request<any>(`/questions/${id}`, { method: 'PUT', body: data }),
    },

    // AI
    ai: {
        generateAnswer: (questionId: number) =>
            request<any>(`/ai/generate-answer`, {
                method: 'POST',
                body: { question_id: questionId },
            }),

        improveAnswer: (answerId: number, prompt: string) =>
            request<any>(`/ai/improve-answer`, {
                method: 'POST',
                body: { answer_id: answerId, prompt },
            }),
    },

    // Notifications
    notifications: {
        list: (limit = 10) => request<any[]>(`/notifications?limit=${limit}`),

        unreadCount: () => request<{ count: number }>('/notifications/unread-count'),

        markRead: (id: number) =>
            request<void>(`/notifications/${id}/read`, { method: 'POST' }),

        markAllRead: () =>
            request<void>('/notifications/read-all', { method: 'POST' }),
    },

    // Health
    health: {
        check: () => request<{ status: string }>('/health', { skipAuth: true }),
        ready: () => request<any>('/ready', { skipAuth: true }),
    },
};

export default api;
