import { ReactNode } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  iconBgClass?: string;
}

const variantStyles = {
  default: 'from-primary/20 to-primary/5',
  danger: 'from-risk-critical/20 to-risk-critical/5',
  success: 'from-risk-safe/20 to-risk-safe/5',
  warning: 'from-risk-high/20 to-risk-high/5',
};

const iconVariantStyles = {
  default: 'bg-primary/20 text-primary',
  danger: 'bg-risk-critical/20 text-risk-critical',
  success: 'bg-risk-safe/20 text-risk-safe',
  warning: 'bg-risk-high/20 text-risk-high',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  variant = 'default',
}: StatCardProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <div className="card-stat group hover:border-primary/50 transition-colors duration-300">
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
              iconVariantStyles[variant]
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          {trend !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                isPositive && 'bg-risk-critical/10 text-risk-critical',
                isNegative && 'bg-risk-safe/10 text-risk-safe',
                !isPositive && !isNegative && 'bg-muted text-muted-foreground'
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : isNegative ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-3xl font-bold text-foreground mb-1">{value}</h3>
          <p className="text-sm text-muted-foreground">{title}</p>
          {trendLabel && (
            <p className="text-xs text-muted-foreground/70 mt-1">{trendLabel}</p>
          )}
        </div>
      </div>
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-30 rounded-xl transition-opacity group-hover:opacity-50',
          variantStyles[variant]
        )}
      />
    </div>
  );
}
