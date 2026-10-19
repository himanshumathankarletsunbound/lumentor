'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { BarChart } from '../../../components/charts/BarChart';

export default function MentorPerformancePage() {
  const mentors = db.getMentors();
  const mentorBars = mentors.map((m) => ({
    label: `${m.firstName[0]}. ${m.lastName}`,
    value: m.teachingHoursThisMonth,
    valueLabel: `${m.teachingHoursThisMonth} hrs`,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mentor Workload & Performance</h1>
          <p className="text-xs text-slate-500 mt-1">
            Faculty teaching distribution, session completion metrics, and punctuality benchmarks.
          </p>
        </div>

        <Card>
          <CardHeader title="Teaching Hours This Month" subtitle="Instructional duration across faculty members" />
          <CardContent>
            <BarChart items={mentorBars} height={200} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Faculty Efficiency Scorecard" subtitle="Verified completion and attendance records" />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Completed Classes</TableHead>
                  <TableHead>Teaching Hours</TableHead>
                  <TableHead>Attendance Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mentors.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-bold text-slate-900">{m.firstName} {m.lastName}</TableCell>
                    <TableCell className="text-xs text-slate-600">{m.branchName}</TableCell>
                    <TableCell className="text-xs font-semibold text-slate-800">{m.completedClassesCount}</TableCell>
                    <TableCell className="text-xs font-mono font-semibold text-slate-800">{m.teachingHoursThisMonth} hrs</TableCell>
                    <TableCell className="text-xs font-bold text-emerald-600">{m.attendanceRate}%</TableCell>
                    <TableCell>
                      <Badge variant="success" size="sm" dot>Active</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
