import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Organization } from '@/types';
import { authApi } from '@/api/client';

interface AuthState {
    user: User | null;
    organization: Organization | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    setUser: (user: User | null) => void;
    setOrganization: (org: Organization | null) => void;
    login: (email: string, password: string) => Promise<void>;
    register: (data: { email: string; password: string; name: string; organization_name?: string }) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            organization: null,
            isAuthenticated: false,
            isLoading: true,

            setUser: (user) => set({ user, isAuthenticated: !!user }),
            setOrganization: (organization) => set({ organization }),

            login: async (email, password) => {
                set({ isLoading: true });
                try {
                    const response = await authApi.login(email, password);
                    const { user, access_token, refresh_token } = response.data;

                    localStorage.setItem('access_token', access_token);
                    localStorage.setItem('refresh_token', refresh_token);

                    set({ user, isAuthenticated: true, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            register: async (data) => {
                set({ isLoading: true });
                try {
                    const response = await authApi.register(data);
                    const { user, organization, access_token, refresh_token } = response.data;

                    localStorage.setItem('access_token', access_token);
                    localStorage.setItem('refresh_token', refresh_token);

                    set({ user, organization, isAuthenticated: true, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            logout: async () => {
                try {
                    await authApi.logout();
                } catch {
                    // Ignore logout errors
                } finally {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    set({ user: null, organization: null, isAuthenticated: false });
                }
            },

            checkAuth: async () => {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    set({ isLoading: false, isAuthenticated: false });
                    return;
                }

                try {
                    const response = await authApi.me();
                    set({
                        user: response.data,
                        organization: response.data.organization,
                        isAuthenticated: true,
                        isLoading: false
                    });
                } catch {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    set({ user: null, organization: null, isAuthenticated: false, isLoading: false });
                }
            },

            fetchUser: async () => {
                try {
                    const response = await authApi.me();
                    set({
                        user: response.data,
                        organization: response.data.organization,
                    });
                } catch (error) {
                    console.error('Failed to fetch user:', error);
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                organization: state.organization,
                isAuthenticated: state.isAuthenticated
            }),
        }
    )
);
