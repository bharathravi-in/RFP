/**
 * Vendor Profile API Client
 */
import api from './client';

export interface VendorProfile {
    id?: number;
    organization_id?: number;
    company_name?: string;
    registration_country?: string;
    years_in_business?: number;
    company_description?: string;
    industries_served?: string[];
    certifications?: string[];
    employee_count_range?: string;
    annual_revenue_range?: string;
    headquarters_location?: string;
    office_locations?: string[];
    mission_statement?: string;
    value_proposition?: string;
    key_differentiators?: string[];
    stats?: {
        clients_count: number;
        ongoing_clients: number;
        success_stories_count: number;
        featured_stories: number;
        capabilities_count: number;
        testimonials_count: number;
    };
}

export interface VendorClient {
    id?: number;
    client_name: string;
    client_industry?: string;
    client_size?: string;
    client_location?: string;
    client_type?: string;
    relationship_status?: string;
    start_date?: string;
    end_date?: string;
    project_count?: number;
    services_provided?: string[];
    technologies_used?: string[];
    project_value_range?: string;
    is_reference_available?: boolean;
    is_public?: boolean;
    anonymize_name?: boolean;
    description?: string;
}

export interface VendorSuccessStory {
    id?: number;
    title: string;
    client_name?: string;
    industry?: string;
    client_size?: string;
    challenge?: string;
    solution?: string;
    impact?: string;
    impact_metrics?: Record<string, { value: number; unit: string }>;
    technologies_used?: string[];
    methodologies?: string[];
    project_duration_months?: number;
    team_size?: number;
    budget_range?: string;
    tags?: string[];
    services_provided?: string[];
    is_public?: boolean;
    is_featured?: boolean;
}

export interface VendorCapability {
    id?: number;
    capability_name: string;
    description?: string;
    technologies_used?: string[];
    use_cases?: string;
    time_saved?: string;
    demo_link?: string;
}

export interface VendorTestimonial {
    id?: number;
    testimonial_text: string;
    client_name?: string;
    client_designation?: string;
    client_company?: string;
    client_industry?: string;
    rating?: number;
    project_category?: string;
    is_verified?: boolean;
    is_featured?: boolean;
    source_platform?: string;
}

export const vendorProfileApi = {
    // Profile
    getProfile: () => api.get<VendorProfile>('/vendor-profile'),
    updateProfile: (data: Partial<VendorProfile>) => api.post<VendorProfile>('/vendor-profile', data),

    // Clients
    getClients: (filters?: Record<string, string>) => api.get<VendorClient[]>('/vendor-profile/clients', { params: filters }),
    addClient: (data: VendorClient) => api.post<VendorClient>('/vendor-profile/clients', data),
    updateClient: (id: number, data: Partial<VendorClient>) => api.put<VendorClient>(`/vendor-profile/clients/${id}`, data),
    deleteClient: (id: number) => api.delete(`/vendor-profile/clients/${id}`),

    // Success Stories
    getSuccessStories: (filters?: Record<string, any>) => api.get<VendorSuccessStory[]>('/vendor-profile/success-stories', { params: filters }),
    addSuccessStory: (data: VendorSuccessStory) => api.post<VendorSuccessStory>('/vendor-profile/success-stories', data),
    updateSuccessStory: (id: number, data: Partial<VendorSuccessStory>) => api.put<VendorSuccessStory>(`/vendor-profile/success-stories/${id}`, data),
    deleteSuccessStory: (id: number) => api.delete(`/vendor-profile/success-stories/${id}`),
    toggleFeatured: (id: number) => api.post<VendorSuccessStory>(`/vendor-profile/success-stories/${id}/feature`),

    // Capabilities
    getCapabilities: (coreOnly?: boolean) => api.get<VendorCapability[]>('/vendor-profile/capabilities', { params: { core_only: coreOnly } }),
    addCapability: (data: VendorCapability) => api.post<VendorCapability>('/vendor-profile/capabilities', data),
    updateCapability: (id: number, data: Partial<VendorCapability>) => api.put<VendorCapability>(`/vendor-profile/capabilities/${id}`, data),
    deleteCapability: (id: number) => api.delete(`/vendor-profile/capabilities/${id}`),

    // Testimonials
    getTestimonials: (verifiedOnly?: boolean) => api.get<VendorTestimonial[]>('/vendor-profile/testimonials', { params: { verified_only: verifiedOnly } }),
    addTestimonial: (data: VendorTestimonial) => api.post<VendorTestimonial>('/vendor-profile/testimonials', data),
    updateTestimonial: (id: number, data: Partial<VendorTestimonial>) => api.put<VendorTestimonial>(`/vendor-profile/testimonials/${id}`, data),
    deleteTestimonial: (id: number) => api.delete(`/vendor-profile/testimonials/${id}`),
    verifyTestimonial: (id: number, method: string) => api.post<VendorTestimonial>(`/vendor-profile/testimonials/${id}/verify`, { verification_method: method }),

    // Bulk Upload
    bulkUpload: (type: 'clients' | 'stories' | 'capabilities' | 'testimonials', file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/vendor-profile/bulk-upload/${type}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
};
