// ===============================
// User & Organization Types
// ===============================

export type UserRole = 'admin' | 'editor' | 'reviewer' | 'viewer';

export interface User {
    id: number;
    email: string;
    name: string;
    profile_photo: string | null;
    role: UserRole;
    organization_id: number | null;
    is_active: boolean;
    created_at: string;
    expertise_tags?: string[];
}

export interface Organization {
    id: number;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
    created_at: string;
    user_count: number;
    project_count: number;
}

// ===============================
// Project Types
// ===============================

export type ProjectStatus = 'draft' | 'in_progress' | 'review' | 'completed';
export type ProjectOutcome = 'pending' | 'won' | 'lost' | 'abandoned';

export interface Project {
    id: number;
    name: string;
    description: string | null;
    status: ProjectStatus;
    completion_percent: number;
    due_date: string | null;
    organization_id: number;
    created_by: number;
    created_at: string;
    updated_at: string;
    document_count?: number;
    question_count?: number;
    reviewer_ids?: number[];
    // Dimension fields for knowledge scoping
    client_name?: string;
    client_type?: string;
    geography?: string;
    currency?: string;
    industry?: string;
    compliance_requirements?: string[];
    knowledge_profiles?: { id: number; name: string }[];
    // Project Outcome (for analytics)
    outcome?: ProjectOutcome;
    outcome_date?: string;
    outcome_notes?: string;
    contract_value?: number;
    loss_reason?: string;
}

export interface CreateProjectData {
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
}

// ===============================
// Document Types
// ===============================

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'doc' | 'xls';

export interface Document {
    id: number;
    filename: string;
    original_filename: string;
    file_type: FileType;
    file_size: number;
    status: DocumentStatus;
    metadata: Record<string, unknown>;
    error_message: string | null;
    project_id: number;
    uploaded_by: number;
    created_at: string;
    processed_at: string | null;
    question_count: number;
}

// ===============================
// Question Types
// ===============================

export type QuestionStatus = 'pending' | 'answered' | 'review' | 'approved' | 'rejected';
export type QuestionCategory = 'security' | 'compliance' | 'technical' | 'pricing' | 'legal' | 'product' | 'general';
export type QuestionPriority = 'high' | 'normal' | 'low';

export interface Question {
    id: number;
    text: string;
    section: string | null;
    category: QuestionCategory | null;
    sub_category: string | null;
    priority: QuestionPriority;
    flags: string[];
    order: number;
    status: QuestionStatus;
    notes: string | null;
    project_id: number;
    document_id: number | null;
    created_at: string;
    updated_at: string;
    assigned_to: number | null;
    due_date: string | null;
    assignee_name?: string;
    answer?: Answer;
}

// ===============================
// Answer Types
// ===============================

export type AnswerStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface AnswerSource {
    title: string;
    relevance: number;
    snippet?: string;
}

export interface Answer {
    id: number;
    content: string;
    confidence_score: number;
    sources: AnswerSource[];
    status: AnswerStatus;
    version: number;
    is_ai_generated: boolean;
    review_notes: string | null;
    question_id: number;
    reviewed_by: number | null;
    reviewed_at: string | null;
    created_at: string;
    verification_score: number;
    comments: AnswerComment[];
}

export interface AnswerComment {
    id: number;
    content: string;
    position: { start: number; end: number } | null;
    resolved: boolean;
    answer_id: number;
    user_id: number;
    user_name: string | null;
    created_at: string;
}

// ===============================
// Knowledge Base Types
// ===============================

export type KnowledgeSourceType = 'document' | 'csv' | 'manual' | 'file' | 'approved_answer';

export interface KnowledgeItem {
    id: number;
    title: string;
    content: string;
    tags: string[];
    category: string | null;
    compliance_frameworks: string[];
    chunk_index: number | null;
    parent_id: number | null;
    usage_count: number;
    last_used_at: string | null;
    source_type: KnowledgeSourceType;
    source_file: string | null;
    file_path: string | null;
    file_type: string | null;
    folder_id: number | null;
    is_active: boolean;
    organization_id: number;
    created_by: number;
    created_at: string;
    updated_at: string;
}

export interface CreateKnowledgeData {
    title: string;
    content: string;
    tags?: string[];
}

export interface KnowledgeSearchResult {
    item: KnowledgeItem;
    score: number;
}

// ===============================
// Similar Answer Types
// ===============================

export interface SimilarAnswer {
    question_id: number;
    question_text: string;
    answer_content: string;
    similarity_score: number;
    answer_id: number;
    category: string | null;
    approved_at: string | null;
}

export interface AnswerSuggestion {
    has_suggestion: boolean;
    suggestion?: {
        suggested_answer: string;
        source_question: string;
        source_answer_id: number;
        similarity: number;
        category: string | null;
        note: string;
    };
}

// ===============================
// API Response Types
// ===============================

export interface ApiError {
    error: string;
}

export interface AuthResponse {
    user: User;
    organization?: Organization | null;
    access_token: string;
    refresh_token: string;
}

export interface ListResponse<T> {
    items?: T[];
    projects?: T[];
    questions?: T[];
    results?: T[];
}

// ===============================
// UI State Types
// ===============================

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
}

export type GenerateAction = 'regenerate' | 'shorten' | 'expand' | 'improve_tone';

export interface GenerateOptions {
    tone?: 'professional' | 'formal' | 'friendly';
    length?: 'short' | 'medium' | 'long';
}

// ===============================
// Export Types
// ===============================

export type ExportFormat = 'pdf' | 'docx' | 'xlsx';

export interface ExportPreview {
    project_name: string;
    total_questions: number;
    answered: number;
    approved: number;
    content: ExportPreviewItem[];
}

export interface ExportPreviewItem {
    section: string | null;
    question: string;
    answer: string;
    status: string;
    confidence: number;
}

// ===============================
// RFP Section Types
// ===============================

export type SectionStatus = 'draft' | 'generated' | 'reviewed' | 'approved' | 'rejected';

export interface RFPSectionType {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    icon: string;
    default_prompt: string | null;
    required_inputs: string[];
    knowledge_scopes: string[];
    is_system: boolean;
    is_active: boolean;
    organization_id: number | null;
    created_at: string;
    color?: string;
    template_type?: string;
    recommended_word_count?: number;
}

export interface SectionComment {
    id: number;
    user_id: number;
    user_name: string;
    text: string;
    created_at: string;
}

export type SectionPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface RFPSection {
    id: number;
    project_id: number;
    section_type_id: number;
    section_type: RFPSectionType | null;
    title: string;
    order: number;
    status: SectionStatus;
    content: string | null;
    inputs: Record<string, string>;
    ai_generation_params: GenerateOptions;
    confidence_score: number | null;
    sources: AnswerSource[];
    flags: string[];
    version: number;
    reviewed_by: number | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
    // Workflow fields
    assigned_to: number | null;
    assignee_name: string | null;
    due_date: string | null;
    priority: SectionPriority;
    comments: SectionComment[];
}

export interface SectionTemplate {
    id: number;
    name: string;
    section_type_id: number | null;
    section_type: RFPSectionType | null;
    content: string;
    variables: string[];
    description: string | null;
    is_default: boolean;
    is_active: boolean;
    organization_id: number | null;
    created_by: number | null;
    created_at: string;
}

export interface SectionGenerationResult {
    content: string;
    confidence_score: number;
    sources: AnswerSource[];
    flags: string[];
}

// ===============================
// Section Version Types
// ===============================

export type SectionChangeType = 'edit' | 'generate' | 'regenerate' | 'restore';

export interface SectionVersion {
    id: number;
    section_id: number;
    version_number: number;
    content: string | null;
    title: string | null;
    status: SectionStatus | null;
    confidence_score: number | null;
    change_type: SectionChangeType;
    change_summary: string | null;
    changed_by: number | null;
    changed_by_name: string | null;
    created_at: string;
}

// ===============================
// Proposal Version Types
// ===============================

export interface ProposalVersion {
    id: number;
    project_id: number;
    version_number: number;
    title: string;
    description: string | null;
    file_type: string;
    file_size: number;
    can_restore: boolean;
    is_restoration_point: boolean;
    restored_from_version: number | null;
    created_by: number;
    creator_name?: string;
    created_at: string;
}

// ===============================
// Version Comparison Types
// ===============================

export type DiffLineType = 'added' | 'removed' | 'unchanged' | 'context';

export interface DiffLine {
    type: DiffLineType;
    content: string;
}

export type SectionDiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface SectionDiff {
    title: string;
    status: SectionDiffStatus;
    content_a: string | null;
    content_b: string | null;
    diff_lines: DiffLine[];
}

export interface VersionComparisonStats {
    total_sections: number;
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
}

export interface VersionComparisonResult {
    version_a: ProposalVersion;
    version_b: ProposalVersion;
    section_diffs: SectionDiff[];
    stats: VersionComparisonStats;
}

// ===============================
// Compliance Matrix Types
// ===============================

export type ComplianceStatus = 'compliant' | 'partial' | 'non_compliant' | 'not_applicable' | 'pending';

export interface ComplianceItem {
    id: number;
    project_id: number;
    requirement_id: string | null;
    requirement_text: string;
    source: string | null;
    category: string | null;
    compliance_status: ComplianceStatus;
    section_id: number | null;
    response_summary: string | null;
    notes: string | null;
    priority: 'high' | 'normal' | 'low';
    order: number;
    created_at: string;
    updated_at: string;
    section?: {
        id: number;
        title: string;
        status: string;
    };
}

export interface ComplianceStats {
    total: number;
    compliant: number;
    partial: number;
    non_compliant: number;
    not_applicable: number;
    pending: number;
}

// ===============================
// Answer Library Types
// ===============================

export interface AnswerLibraryItem {
    id: number;
    organization_id: number;
    question_text: string;
    answer_text: string;
    category: string | null;
    tags: string[];
    status: 'draft' | 'under_review' | 'approved' | 'archived';
    version_number: number;
    item_metadata: Record<string, any>;
    last_reviewed_at: string | null;
    next_review_due: string | null;
    reviewed_by: number | null;
    reviewed_by_name: string | null;
    source_project_id: number | null;
    source_project_name: string | null;
    source_question_id: number | null;
    source_answer_id: number | null;
    times_used: number;
    times_helpful: number;
    created_by: number;
    creator_name: string | null;
    updated_by: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ===============================
// Go/No-Go Analysis Types
// ===============================

export type GoNoGoStatus = 'pending' | 'go' | 'no_go';

export interface GoNoGoCriteria {
    team_available: number;
    required_team_size: number;
    key_skills_available: number;
    typical_response_days: number;
    incumbent_advantage: boolean;
    relationship_score: number;
    pricing_competitiveness: number;
    unique_capabilities: number;
}

export interface GoNoGoDimensionScore {
    score: number;
    details: string;
    breakdown: Record<string, any>;
}

export interface GoNoGoAnalysis {
    status: GoNoGoStatus;
    win_probability: number;
    breakdown: {
        resources: GoNoGoDimensionScore;
        timeline: GoNoGoDimensionScore;
        experience: GoNoGoDimensionScore;
        competition: GoNoGoDimensionScore;
    };
    ai_recommendation: string;
    completed_at: string | null;
}

export interface GoNoGoWeights {
    resources: number;
    timeline: number;
    experience: number;
    competition: number;
}

