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
  const iconColors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
  };

  return (
    <Card className={cn('p-5 flex flex-col justify-between', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">{value}</p>
        </div>
        {icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconColors[color])}>
            {icon}
          </div>
        )}
      </div>

      {(trend || subtitle) && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center font-medium gap-1',
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
              {trend.label && <span className="text-slate-400 font-normal">{trend.label}</span>}
            </span>
          )}
          {subtitle && <span className="text-slate-400 truncate ml-auto">{subtitle}</span>}
        </div>
      )}
    </Card>
  );
}
