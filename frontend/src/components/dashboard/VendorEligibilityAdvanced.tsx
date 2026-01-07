import { useState } from 'react';
import clsx from 'clsx';
import {
    BuildingOfficeIcon,
    GlobeAltIcon,
    ShieldCheckIcon,
    ClockIcon,
    UsersIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    CurrencyDollarIcon,
    LightBulbIcon,
    BriefcaseIcon,
    DocumentCheckIcon,
    StarIcon,
    AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';

interface VendorProfile {
    company_name?: string;
    registration_country?: string;
    years_in_business?: string | number;
    employee_count?: string | number;
    certifications?: string[];
    industries?: string[];
    geographies?: string[];
    annual_revenue?: string | number;
    past_projects_count?: number;
    similar_projects?: number;
    references_count?: number;
    insurance_coverage?: boolean;
    compliance_status?: 'compliant' | 'partial' | 'non-compliant';
}

interface EligibilityCriteria {
    id: string;
    label: string;
    value: string;
    icon: typeof BuildingOfficeIcon;
    status: 'met' | 'partial' | 'missing';
    weight: number; // 0-10
    category: 'basic' | 'experience' | 'compliance' | 'financial';
}

interface ScoringWeights {
    basic: number;
    experience: number;
    compliance: number;
    financial: number;
}

interface VendorEligibilityAdvancedProps {
    vendorProfile?: VendorProfile;
    organizationName?: string;
    className?: string;
    showScoring?: boolean;
    editableWeights?: boolean;
    onWeightsChange?: (weights: ScoringWeights) => void;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
    basic: 20,
    experience: 30,
    compliance: 30,
    financial: 20,
};

export default function VendorEligibilityAdvanced({
    vendorProfile,
    organizationName,
    className = '',
    showScoring = true,
    editableWeights = false,
    onWeightsChange,
}: VendorEligibilityAdvancedProps) {
    const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
    const [showWeightEditor, setShowWeightEditor] = useState(false);
    const profile = vendorProfile || {};

    // Define eligibility criteria
    const eligibilityCriteria: EligibilityCriteria[] = [
        // Basic Info
        {
            id: 'registration',
            label: 'Company Registration',
            value: profile.registration_country || organizationName || 'Not specified',
            icon: BuildingOfficeIcon,
            status: profile.registration_country ? 'met' : organizationName ? 'partial' : 'missing',
            weight: 3,
            category: 'basic',
        },
        {
            id: 'years',
            label: 'Years in Business',
            value: profile.years_in_business ? `${profile.years_in_business}+ years` : 'Not specified',
            icon: ClockIcon,
            status: Number(profile.years_in_business) >= 5 ? 'met' : Number(profile.years_in_business) >= 2 ? 'partial' : 'missing',
            weight: 4,
            category: 'basic',
        },
        {
            id: 'team_size',
            label: 'Team Size',
            value: profile.employee_count ? `${profile.employee_count} employees` : 'Not specified',
            icon: UsersIcon,
            status: Number(profile.employee_count) >= 50 ? 'met' : Number(profile.employee_count) >= 10 ? 'partial' : 'missing',
            weight: 3,
            category: 'basic',
        },
        // Experience
        {
            id: 'industries',
            label: 'Industry Experience',
            value: profile.industries?.length ? profile.industries.slice(0, 2).join(', ') : 'Not specified',
            icon: BriefcaseIcon,
            status: profile.industries?.length && profile.industries.length >= 2 ? 'met' : profile.industries?.length ? 'partial' : 'missing',
            weight: 5,
            category: 'experience',
        },
        {
            id: 'geographies',
            label: 'Geographic Presence',
            value: profile.geographies?.length ? profile.geographies.slice(0, 2).join(', ') : 'Global',
            icon: GlobeAltIcon,
            status: profile.geographies?.length && profile.geographies.length >= 3 ? 'met' : profile.geographies?.length ? 'partial' : 'partial',
            weight: 3,
            category: 'experience',
        },
        {
            id: 'past_projects',
            label: 'Past Projects',
            value: profile.past_projects_count ? `${profile.past_projects_count} projects` : 'Not specified',
            icon: DocumentCheckIcon,
            status: Number(profile.past_projects_count) >= 20 ? 'met' : Number(profile.past_projects_count) >= 5 ? 'partial' : 'missing',
            weight: 4,
            category: 'experience',
        },
        {
            id: 'similar_projects',
            label: 'Similar Projects',
            value: profile.similar_projects ? `${profile.similar_projects} relevant` : 'Not specified',
            icon: LightBulbIcon,
            status: Number(profile.similar_projects) >= 5 ? 'met' : Number(profile.similar_projects) >= 2 ? 'partial' : 'missing',
            weight: 5,
            category: 'experience',
        },
        // Compliance
        {
            id: 'certifications',
            label: 'Certifications',
            value: profile.certifications?.length ? profile.certifications.slice(0, 2).join(', ') : 'None listed',
            icon: ShieldCheckIcon,
            status: profile.certifications && profile.certifications.length >= 3 ? 'met' : profile.certifications?.length ? 'partial' : 'missing',
            weight: 5,
            category: 'compliance',
        },
        {
            id: 'compliance',
            label: 'Compliance Status',
            value: profile.compliance_status ? profile.compliance_status.replace('-', ' ') : 'Not verified',
            icon: DocumentCheckIcon,
            status: profile.compliance_status === 'compliant' ? 'met' : profile.compliance_status === 'partial' ? 'partial' : 'missing',
            weight: 5,
            category: 'compliance',
        },
        {
            id: 'references',
            label: 'References',
            value: profile.references_count ? `${profile.references_count} verified` : 'None',
            icon: StarIcon,
            status: Number(profile.references_count) >= 5 ? 'met' : Number(profile.references_count) >= 2 ? 'partial' : 'missing',
            weight: 3,
            category: 'compliance',
        },
        // Financial
        {
            id: 'revenue',
            label: 'Annual Revenue',
            value: profile.annual_revenue ? `$${profile.annual_revenue}M+` : 'Not disclosed',
            icon: CurrencyDollarIcon,
            status: Number(profile.annual_revenue) >= 10 ? 'met' : Number(profile.annual_revenue) >= 1 ? 'partial' : 'missing',
            weight: 4,
            category: 'financial',
        },
        {
            id: 'insurance',
            label: 'Insurance Coverage',
            value: profile.insurance_coverage ? 'Verified' : 'Not verified',
            icon: ShieldCheckIcon,
            status: profile.insurance_coverage ? 'met' : 'missing',
            weight: 3,
            category: 'financial',
        },
    ];

    // Calculate scores
    const calculateCategoryScore = (category: keyof ScoringWeights) => {
        const categoryCriteria = eligibilityCriteria.filter(c => c.category === category);
        const maxScore = categoryCriteria.reduce((sum, c) => sum + c.weight * 10, 0);
        const actualScore = categoryCriteria.reduce((sum, c) => {
            const statusScore = c.status === 'met' ? 10 : c.status === 'partial' ? 5 : 0;
            return sum + (c.weight * statusScore);
        }, 0);
        return maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;
    };

    const calculateTotalScore = () => {
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        const weightedScore = Object.entries(weights).reduce((sum, [cat, weight]) => {
            return sum + (calculateCategoryScore(cat as keyof ScoringWeights) * weight / 100);
        }, 0);
        return Math.round((weightedScore / totalWeight) * 100);
    };

    const handleWeightChange = (category: keyof ScoringWeights, value: number) => {
        const newWeights = { ...weights, [category]: value };
        setWeights(newWeights);
        onWeightsChange?.(newWeights);
    };

    const metCount = eligibilityCriteria.filter(c => c.status === 'met').length;
    const totalScore = calculateTotalScore();

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-success';
        if (score >= 60) return 'text-warning';
        return 'text-error';
    };

    const categories: Array<{ key: keyof ScoringWeights; label: string; icon: typeof BuildingOfficeIcon }> = [
        { key: 'basic', label: 'Basic Info', icon: BuildingOfficeIcon },
        { key: 'experience', label: 'Experience', icon: BriefcaseIcon },
        { key: 'compliance', label: 'Compliance', icon: ShieldCheckIcon },
        { key: 'financial', label: 'Financial', icon: CurrencyDollarIcon },
    ];

    return (
        <div className={clsx('card', className)}>
            {/* Header */}
            <div className="p-5 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-text-primary">Vendor Eligibility</h3>
                        <p className="text-sm text-text-secondary">
                            {profile.company_name || organizationName || 'Your Organization'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {showScoring && (
                            <div className="text-center">
                                <span className={clsx('text-2xl font-bold', getScoreColor(totalScore))}>
                                    {totalScore}%
                                </span>
                                <p className="text-xs text-text-muted">Score</p>
                            </div>
                        )}
                        <div className="text-center">
                            <span className="text-lg font-bold text-primary">
                                {metCount}/{eligibilityCriteria.length}
                            </span>
                            <p className="text-xs text-text-muted">verified</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Scores */}
            {showScoring && (
                <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border">
                    {categories.map(({ key, label, icon: Icon }) => (
                        <div key={key} className="p-3 border-r border-border last:border-r-0 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <Icon className="h-4 w-4 text-text-muted" />
                                <span className="text-xs text-text-muted">{label}</span>
                            </div>
                            <span className={clsx('text-lg font-bold', getScoreColor(calculateCategoryScore(key)))}>
                                {calculateCategoryScore(key)}%
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Weight Editor Toggle */}
            {editableWeights && (
                <div className="px-5 py-2 border-b border-border bg-background/50">
                    <button
                        onClick={() => setShowWeightEditor(!showWeightEditor)}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                        <AdjustmentsHorizontalIcon className="h-4 w-4" />
                        Configure Scoring Weights
                    </button>
                    {showWeightEditor && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            {categories.map(({ key, label }) => (
                                <div key={key} className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted w-20">{label}</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={weights[key]}
                                        onChange={(e) => handleWeightChange(key, Number(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="text-xs font-medium w-8">{weights[key]}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Eligibility Checklist by Category */}
            <div className="p-5 space-y-4">
                {categories.map(({ key, label }) => (
                    <div key={key}>
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                            {label}
                        </h4>
                        <div className="space-y-2">
                            {eligibilityCriteria
                                .filter(c => c.category === key)
                                .map(criteria => (
                                    <EligibilityRow key={criteria.id} criteria={criteria} />
                                ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-background/50">
                <p className="text-xs text-text-muted text-center">
                    Update vendor profile in{' '}
                    <a href="/settings" className="text-primary hover:underline">
                        Settings
                    </a>
                </p>
            </div>
        </div>
    );
}

function EligibilityRow({ criteria }: { criteria: EligibilityCriteria }) {
    const Icon = criteria.icon;

    const statusConfig = {
        met: {
            icon: CheckCircleIcon,
            color: 'text-green-500',
            bgColor: 'bg-green-50',
        },
        partial: {
            icon: ExclamationTriangleIcon,
            color: 'text-amber-500',
            bgColor: 'bg-amber-50',
        },
        missing: {
            icon: XCircleIcon,
            color: 'text-gray-300',
            bgColor: 'bg-gray-50',
        },
    };

    const { icon: StatusIcon, color, bgColor } = statusConfig[criteria.status];

    return (
        <div className={clsx('flex items-center gap-3 p-2 rounded-lg', bgColor)}>
            <Icon className="h-4 w-4 text-text-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-text-primary">{criteria.label}</p>
                    <span className="text-[10px] text-text-muted">×{criteria.weight}</span>
                </div>
                <p className="text-xs text-text-secondary truncate">{criteria.value}</p>
            </div>
            <StatusIcon className={clsx('h-5 w-5 flex-shrink-0', color)} />
        </div>
    );
}
