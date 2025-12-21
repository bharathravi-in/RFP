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
} from '@heroicons/react/24/outline';

interface VendorProfile {
    company_name?: string;
    registration_country?: string;
    years_in_business?: string | number;
    employee_count?: string | number;
    certifications?: string[];
    industries?: string[];
    geographies?: string[];
}

interface VendorEligibilityPanelProps {
    vendorProfile?: VendorProfile;
    organizationName?: string;
    className?: string;
}

export default function VendorEligibilityPanel({
    vendorProfile,
    organizationName,
    className = ''
}: VendorEligibilityPanelProps) {
    const profile = vendorProfile || {};

    // Define eligibility criteria and check status
    const eligibilityCriteria: Array<{
        label: string;
        value: string;
        icon: typeof BuildingOfficeIcon;
        status: 'met' | 'partial' | 'missing';
    }> = [
            {
                label: 'Company Registration',
                value: profile.registration_country || organizationName || 'Not specified',
                icon: BuildingOfficeIcon,
                status: profile.registration_country ? 'met' : organizationName ? 'partial' : 'missing',
            },
            {
                label: 'Years in Business',
                value: profile.years_in_business ? `${profile.years_in_business}+ years` : 'Not specified',
                icon: ClockIcon,
                status: profile.years_in_business ? 'met' : 'missing',
            },
            {
                label: 'Team Size',
                value: profile.employee_count ? `${profile.employee_count} employees` : 'Not specified',
                icon: UsersIcon,
                status: profile.employee_count ? 'met' : 'missing',
            },
            {
                label: 'Certifications',
                value: profile.certifications?.length ? profile.certifications.slice(0, 2).join(', ') : 'None listed',
                icon: ShieldCheckIcon,
                status: profile.certifications?.length ? 'met' : 'missing',
            },
            {
                label: 'Geographic Presence',
                value: profile.geographies?.length ? profile.geographies.slice(0, 2).join(', ') : 'Global',
                icon: GlobeAltIcon,
                status: profile.geographies?.length ? 'met' : 'partial',
            },
        ];

    const metCount = eligibilityCriteria.filter(c => c.status === 'met').length;
    const totalCount = eligibilityCriteria.length;

    return (
        <div className={clsx('card p-5', className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-text-primary">
                        Vendor Eligibility
                    </h3>
                    <p className="text-sm text-text-secondary">
                        {profile.company_name || organizationName || 'Your Organization'}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-primary">
                        {metCount}/{totalCount}
                    </span>
                    <span className="text-xs text-text-muted">verified</span>
                </div>
            </div>

            {/* Eligibility Checklist */}
            <div className="space-y-3">
                {eligibilityCriteria.map((criteria, idx) => (
                    <EligibilityRow key={idx} criteria={criteria} />
                ))}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-border">
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

interface EligibilityRowProps {
    criteria: {
        label: string;
        value: string;
        icon: typeof BuildingOfficeIcon;
        status: 'met' | 'partial' | 'missing';
    };
}

function EligibilityRow({ criteria }: EligibilityRowProps) {
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
        <div className={clsx(
            'flex items-center gap-3 p-2 rounded-lg',
            bgColor
        )}>
            <Icon className="h-4 w-4 text-text-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary">
                    {criteria.label}
                </p>
                <p className="text-xs text-text-secondary truncate">
                    {criteria.value}
                </p>
            </div>
            <StatusIcon className={clsx('h-5 w-5 flex-shrink-0', color)} />
        </div>
    );
}
