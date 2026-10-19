'use client';

import React from 'react';
import { cn } from '../../lib/utils/cn';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  size = 140,
  strokeWidth = 20,
  centerLabel,
  centerValue,
  className,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = 0;

  return (
    <div className={cn('flex flex-col sm:flex-row items-center gap-6', className)}>
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {segments.map((seg, idx) => {
            const strokeDasharray = `${(seg.value / total) * circumference} ${circumference}`;
            const strokeDashoffset = -currentAngle;
            currentAngle += (seg.value / total) * circumference;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300 hover:opacity-85"
              />
            );
          })}
        </svg>

        {/* Center Text */}
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {centerValue && <span className="text-base font-bold text-slate-900 leading-tight">{centerValue}</span>}
            {centerLabel && <span className="text-[10px] text-slate-400 font-medium">{centerLabel}</span>}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-1 gap-1.5 text-xs flex-1 w-full">
        {segments.map((seg, idx) => {
          const pct = Math.round((seg.value / total) * 100);
          return (
            <div key={idx} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-slate-600 truncate">{seg.label}</span>
              </div>
              <span className="font-semibold text-slate-800 shrink-0">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
