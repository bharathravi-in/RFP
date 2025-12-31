// ===============================
// Super Admin Types
// ===============================

export interface SuperAdminOrganization {
    id: number;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
    created_at: string;
    user_count: number;
    project_count: number;
    // Trial & Subscription
    trial_ends_at: string | null;
    trial_days_remaining: number;
    is_trial_active: boolean;
    subscription_plan: SubscriptionPlan;
    subscription_status: SubscriptionStatus;
    is_subscription_active: boolean;
    // Limits
    max_users: number;
    max_projects: number;
    max_documents: number;
    // Feature Flags
    feature_flags: Record<string, boolean>;
    // Extended details (from detail endpoint)
    users?: SuperAdminUser[];
}

export interface SuperAdminUser {
    id: number;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
    is_super_admin: boolean;
    created_at: string;
}

export type SubscriptionPlan = 'trial' | 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'expired';

export interface PlatformStats {
    total_organizations: number;
    total_users: number;
    total_projects: number;
    total_documents: number;
    trialing: number;
    active: number;
    expired: number;
    plans: {
        trial: number;
        starter: number;
        professional: number;
        enterprise: number;
    };
}

export interface FeatureDefinition {
    [key: string]: string; // feature_key: display_name
}

export interface PlanDefinition {
    name: string;
    max_users: number;
    max_projects: number;
    max_documents: number;
    features: string[];
}

export interface PlansResponse {
    plans: {
        trial: PlanDefinition;
        starter: PlanDefinition;
        professional: PlanDefinition;
        enterprise: PlanDefinition;
    };
}

export interface UpdateSubscriptionData {
    plan?: SubscriptionPlan;
    status?: SubscriptionStatus;
    max_users?: number;
    max_projects?: number;
    max_documents?: number;
    feature_flags?: Record<string, boolean>;
}

export interface ExtendTrialData {
    days: number;
}

export interface ExtendTrialResponse {
    message: string;
    trial_ends_at: string;
    trial_days_remaining: number;
}
