import clsx from 'clsx';
import { CheckBadgeIcon, XCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid';

interface WinProbabilityGaugeProps {
    score: number; // 0-100
    status?: 'pending' | 'go' | 'no_go';
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export default function WinProbabilityGauge({
    score,
    status = 'pending',
    size = 'md',
    showLabel = true
}: WinProbabilityGaugeProps) {
    const getScoreColor = () => {
        if (score >= 70) return { bg: 'bg-green-500', text: 'text-green-600', ring: 'ring-green-500/30' };
        if (score >= 45) return { bg: 'bg-yellow-500', text: 'text-yellow-600', ring: 'ring-yellow-500/30' };
        return { bg: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-500/30' };
    };

    const colors = getScoreColor();

    const sizeConfig = {
        sm: { gauge: 80, stroke: 8, fontSize: '1.5rem', labelSize: 'text-xs' },
        md: { gauge: 120, stroke: 12, fontSize: '2rem', labelSize: 'text-sm' },
        lg: { gauge: 160, stroke: 16, fontSize: '2.5rem', labelSize: 'text-base' },
    };

    const config = sizeConfig[size];
    const radius = (config.gauge - config.stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = ((100 - score) / 100) * circumference;

    const StatusIcon = () => {
        if (status === 'go') {
            return <CheckBadgeIcon className="h-5 w-5 text-green-600" />;
        }
        if (status === 'no_go') {
            return <XCircleIcon className="h-5 w-5 text-red-600" />;
        }
        return <QuestionMarkCircleIcon className="h-5 w-5 text-yellow-600" />;
    };

    return (
        <div className="flex flex-col items-center gap-3">
            {/* Circular Gauge */}
            <div className="relative" style={{ width: config.gauge, height: config.gauge }}>
                {/* Background Ring */}
                <svg
                    className="transform -rotate-90"
                    width={config.gauge}
                    height={config.gauge}
                >
                    <circle
                        cx={config.gauge / 2}
                        cy={config.gauge / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={config.stroke}
                        className="text-gray-200"
                    />
                    {/* Progress Ring */}
                    <circle
                        cx={config.gauge / 2}
                        cy={config.gauge / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={config.stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={progress}
                        className={clsx('transition-all duration-1000 ease-out', colors.text)}
                        style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
                    />
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                        className={clsx('font-bold tabular-nums', colors.text)}
                        style={{ fontSize: config.fontSize }}
                    >
                        {Math.round(score)}%
                    </span>
                    {size !== 'sm' && (
                        <span className="text-xs text-gray-500 -mt-1">Win Rate</span>
                    )}
                </div>
            </div>

            {/* Status Badge */}
            {showLabel && (
                <div className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-full font-medium',
                    status === 'go' && 'bg-green-100 text-green-800',
                    status === 'no_go' && 'bg-red-100 text-red-800',
                    status === 'pending' && 'bg-yellow-100 text-yellow-800'
                )}>
                    <StatusIcon />
                    <span className="uppercase tracking-wide text-sm">
                        {status === 'go' ? 'GO' : status === 'no_go' ? 'NO GO' : 'PENDING'}
                    </span>
                </div>
            )}
        </div>
    );
}

interface ScoreBreakdownProps {
    breakdown: {
        resources: { score: number; details: string };
        timeline: { score: number; details: string };
        experience: { score: number; details: string };
        competition: { score: number; details: string };
    };
    weights: {
        resources: number;
        timeline: number;
        experience: number;
        competition: number;
    };
}

export function ScoreBreakdown({ breakdown, weights }: ScoreBreakdownProps) {
    const dimensions = [
        { key: 'resources', label: 'Resource Availability', icon: '👥', weight: weights.resources },
        { key: 'timeline', label: 'Timeline Feasibility', icon: '📅', weight: weights.timeline },
        { key: 'experience', label: 'Past Experience', icon: '📚', weight: weights.experience },
        { key: 'competition', label: 'Competitive Position', icon: '🎯', weight: weights.competition },
    ] as const;

    return (
        <div className="space-y-3">
            {dimensions.map((dim) => {
                const data = breakdown[dim.key];
                const score = data?.score ?? 0;
                const getBarColor = () => {
                    if (score >= 70) return 'bg-green-500';
                    if (score >= 45) return 'bg-yellow-500';
                    return 'bg-red-500';
                };

                return (
                    <div key={dim.key} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{dim.icon}</span>
                                <span className="text-sm font-medium text-gray-700">{dim.label}</span>
                                <span className="text-xs text-gray-400">({Math.round(dim.weight * 100)}%)</span>
                            </div>
                            <span className={clsx(
                                'text-sm font-bold',
                                score >= 70 ? 'text-green-600' : score >= 45 ? 'text-yellow-600' : 'text-red-600'
                            )}>
                                {Math.round(score)}
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                            <div
                                className={clsx('h-full rounded-full transition-all duration-500', getBarColor())}
                                style={{ width: `${score}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500">{data?.details}</p>
                    </div>
                );
            })}
        </div>
    );
}
