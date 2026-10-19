'use client';

import React from 'react';
import { cn } from '../../lib/utils/cn';

export interface BarChartItem {
  label: string;
  value: number;
  valueLabel?: string;
  color?: string;
}

export function BarChart({
  items,
  height = 180,
  className,
}: {
  items: BarChartItem[];
  height?: number;
  className?: string;
}) {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={cn('w-full flex items-end gap-2.5 sm:gap-4 pt-6 pb-2', className)} style={{ height }}>
      {items.map((item, idx) => {
        const heightPct = Math.round((item.value / maxValue) * 100);
        return (
          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
            {/* Tooltip on Hover */}
            <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-semibold py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-10">
              {item.valueLabel || item.value}
            </div>

            {/* Bar */}
            <div
              className={cn(
                'w-full max-w-[42px] rounded-t-md transition-all duration-300 group-hover:opacity-90',
                item.color || 'bg-indigo-600'
              )}
              style={{ height: `${Math.max(heightPct, 4)}%` }}
            />

            {/* Label */}
            <span className="text-[10px] text-slate-500 font-medium mt-2 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
