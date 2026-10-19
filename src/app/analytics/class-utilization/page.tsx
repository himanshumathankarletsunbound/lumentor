'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { DonutChart } from '../../../components/charts/DonutChart';
import { BarChart } from '../../../components/charts/BarChart';

export default function ClassUtilizationPage() {
  const classes = db.getClasses();
  const subjects = db.getSubjects();

  const subjectSplit = subjects.map((s, idx) => {
    const count = classes.filter((c) => c.subjectId === s.id).length;
    const colors = ['#6366f1', '#0284c7', '#059669', '#8b5cf6', '#f59e0b'];
    return {
      label: s.name,
      value: count || 1,
      color: colors[idx % colors.length],
    };
  });

  const timeSlots = [
    { label: '10 AM - 12 PM', value: 3, valueLabel: '3 classes' },
    { label: '12 PM - 2 PM', value: 2, valueLabel: '2 classes' },
    { label: '2 PM - 4 PM', value: 6, valueLabel: '6 classes (Peak)' },
    { label: '4 PM - 6 PM', value: 4, valueLabel: '4 classes' },
    { label: '6 PM - 8 PM', value: 2, valueLabel: '2 classes' },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Class & Facility Utilization</h1>
          <p className="text-xs text-slate-500 mt-1">
            Subject demand distribution, time-slot occupancy, and room scheduling efficiency.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Instructional Demand by Subject" subtitle="Class volume distribution across subjects" />
            <CardContent>
              <DonutChart segments={subjectSplit} centerLabel="Subjects" centerValue="5 Tracked" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Peak Hourly Scheduling" subtitle="Session volume across daily teaching windows" />
            <CardContent>
              <BarChart items={timeSlots} height={200} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
