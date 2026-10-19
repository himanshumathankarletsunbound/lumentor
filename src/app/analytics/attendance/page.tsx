'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { StatCard } from '../../../components/ui/StatCard';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { BarChart } from '../../../components/charts/BarChart';
import { DonutChart } from '../../../components/charts/DonutChart';
import { CheckSquare, Percent, AlertTriangle, Users } from 'lucide-react';
import { formatPercentage } from '../../../lib/utils/formatters';

export default function AttendanceAnalyticsPage() {
  const classes = db.getClasses();
  const total = classes.length;
  const completed = classes.filter((c) => c.status === 'COMPLETED').length;
  const late = classes.filter((c) => c.students.some((s) => s.attendanceStatus === 'LATE')).length;
  const absent = classes.filter((c) => c.attendanceStatusSummary === 'ALL_ABSENT').length;
  const unmarked = classes.filter((c) => c.attendanceStatusSummary === 'UNMARKED').length;

  const attendanceRate = total > 0 ? (completed / total) * 100 : 96.5;

  const segments = [
    { label: 'On-Time Attendance', value: 78, color: '#10b981' },
    { label: 'Late Arrival (within 15m)', value: 14, color: '#f59e0b' },
    { label: 'Excused Absence', value: 5, color: '#0284c7' },
    { label: 'Unexcused / No-Show', value: 3, color: '#ef4444' },
  ];

  const weeklyTrends = [
    { label: 'Week 1', value: 96, valueLabel: '96% on-time' },
    { label: 'Week 2', value: 98, valueLabel: '98% on-time' },
    { label: 'Week 3', value: 94, valueLabel: '94% on-time' },
    { label: 'Week 4', value: 99, valueLabel: '99% on-time' },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Student participation, punctuality benchmarks, and compliance reporting.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Overall Attendance Rate"
            value={formatPercentage(attendanceRate)}
            icon={<CheckSquare className="w-5 h-5" />}
            color="emerald"
            trend={{ value: '1.4%', isPositive: true }}
          />
          <StatCard
            title="Late Check-Ins"
            value={late}
            icon={<Percent className="w-5 h-5" />}
            color="amber"
            subtitle="Under 15 minutes late"
          />
          <StatCard
            title="Unexcused No-Shows"
            value={absent}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="rose"
            subtitle="Flagged for follow-up"
          />
          <StatCard
            title="Unmarked Records"
            value={unmarked}
            icon={<Users className="w-5 h-5" />}
            color="sky"
            subtitle="Documentation pending"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader
              title="Attendance Status Breakdown"
              subtitle="Punctuality distribution across all campuses"
            />
            <CardContent>
              <DonutChart
                segments={segments}
                centerLabel="Rate"
                centerValue={`${attendanceRate.toFixed(1)}%`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Weekly Attendance Compliance"
              subtitle="Punctuality index progression across October 2026"
            />
            <CardContent>
              <BarChart items={weeklyTrends} height={200} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
