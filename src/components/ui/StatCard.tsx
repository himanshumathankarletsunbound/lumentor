import React from 'react';
import { cn } from '../../lib/utils/cn';
import { Card } from './Card';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  subtitle?: string;
  className?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  className,
  color = 'indigo',
}: StatCardProps) {
  const colorStyles = {
    indigo: {
      iconBg: 'bg-indigo-50 border-indigo-100 text-indigo-600',
      badge: 'text-indigo-700 bg-indigo-50',
    },
    emerald: {
      iconBg: 'bg-emerald-50 border-emerald-100 text-emerald-600',
      badge: 'text-emerald-700 bg-emerald-50',
    },
    amber: {
      iconBg: 'bg-amber-50 border-amber-100 text-amber-600',
      badge: 'text-amber-700 bg-amber-50',
    },
    rose: {
      iconBg: 'bg-rose-50 border-rose-100 text-rose-600',
      badge: 'text-rose-700 bg-rose-50',
    },
    sky: {
      iconBg: 'bg-sky-50 border-sky-100 text-sky-600',
      badge: 'text-sky-700 bg-sky-50',
    },
  };

  const currentStyle = colorStyles[color];

  return (
    <Card className={cn('p-5 flex flex-col justify-between hover:border-slate-300/80 transition-all duration-200 group', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </p>
          <p
            className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight group-hover:text-indigo-600 transition-colors"
            suppressHydrationWarning
          >
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105',
              currentStyle.iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {(trend || subtitle) && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center font-medium gap-1 px-1.5 py-0.5 rounded-md text-[11px]',
                trend.isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
              )}
            >
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
              {trend.label && <span className="text-slate-400 font-normal ml-0.5">{trend.label}</span>}
            </span>
          )}
          {subtitle && (
            <span className="text-slate-400 text-[11px] truncate ml-auto">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
