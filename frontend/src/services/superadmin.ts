/**
 * Super Admin API service for platform administration.
 */

import type {
    SuperAdminOrganization,
    PlatformStats,
    FeatureDefinition,
    PlansResponse,
    UpdateSubscriptionData,
    ExtendTrialResponse,
    SuperAdminUser,
} from '@/types/superadmin';

const API_BASE_URL = '/api/superadmin';

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

    if (response.status === 401) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    }

    if (response.status === 403) {
        throw {
            status: 403,
            code: 'FORBIDDEN',
            message: 'Super admin privileges required',
        };
    }

    throw {
        status: response.status,
        code: error.code,
        message: error.message,
    };
}

/**
 * Core request function for superadmin endpoints
 */
async function request<T>(endpoint: string, options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
} = {}): Promise<T> {
    const { method = 'GET', body } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        method,
        headers,
    };

    if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (response.status === 204) {
        return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
        handleApiError(response, data);
    }

    return data;
}

// ================================================
// Super Admin API Methods
// ================================================

export const superadminApi = {
    // Organization Management
    organizations: {
        /**
         * List all organizations
         */
        list: () =>
            request<{ organizations: SuperAdminOrganization[]; total: number }>('/organizations'),

        /**
         * Get organization details with users
         */
        get: (orgId: number) =>
            request<{ organization: SuperAdminOrganization }>(`/organizations/${orgId}`),

        /**
         * Update organization subscription and limits
         */
        updateSubscription: (orgId: number, data: UpdateSubscriptionData) =>
            request<{ message: string; organization: SuperAdminOrganization }>(
                `/organizations/${orgId}/subscription`,
                { method: 'PUT', body: data }
            ),

        /**
         * Update organization feature flags
         */
        updateFeatures: (orgId: number, features: Record<string, boolean>) =>
            request<{ message: string; feature_flags: Record<string, boolean> }>(
                `/organizations/${orgId}/features`,
                { method: 'PUT', body: features }
            ),

        /**
         * Extend organization trial
         */
        extendTrial: (orgId: number, days: number = 14) =>
            request<ExtendTrialResponse>(
                `/organizations/${orgId}/extend-trial`,
                { method: 'POST', body: { days } }
            ),
    },

    // User Management
    users: {
        /**
         * List all users across all organizations
         */
        list: () =>
            request<{ users: SuperAdminUser[]; total: number }>('/users'),

        /**
         * Toggle super admin status for a user
         */
        toggleSuperAdmin: (userId: number) =>
            request<{ message: string; user: SuperAdminUser }>(
                `/users/${userId}/toggle-super-admin`,
                { method: 'POST' }
            ),
    },

    // Platform Stats
    stats: {
        /**
         * Get platform-wide statistics
         */
        get: () => request<PlatformStats>('/stats'),
    },

    // Features & Plans
    features: {
        /**
         * Get available features that can be toggled
         */
        list: () => request<{ features: FeatureDefinition }>('/features'),
    },

    plans: {
        /**
         * Get subscription plan definitions
         */
        list: () => request<PlansResponse>('/plans'),
    },
};

export default superadminApi;
