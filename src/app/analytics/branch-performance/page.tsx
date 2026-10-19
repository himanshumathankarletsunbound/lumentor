'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { BarChart } from '../../../components/charts/BarChart';
import { Building2 } from 'lucide-react';

export default function BranchPerformancePage() {
  const branches = db.getBranches();
  const classes = db.getClasses();
  const students = db.getStudents();
  const mentors = db.getMentors();

  const branchBars = branches.map((b) => ({
    label: b.code,
    value: classes.filter((c) => c.branchId === b.id).length,
    valueLabel: `${classes.filter((c) => c.branchId === b.id).length} classes`,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Branch Performance Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Comparative volume, student retention, faculty allocation, and session density across campus branches.
          </p>
        </div>

        <Card>
          <CardHeader title="Campus Class Density" subtitle="Monthly instructional session volume" />
          <CardContent>
            <BarChart items={branchBars} height={200} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Campus Summary Table" subtitle="Key branch operational metrics" />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Enrolled Students</TableHead>
                  <TableHead>Faculty Assigned</TableHead>
                  <TableHead>Scheduled Classes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-bold text-slate-900">{b.name}</TableCell>
                    <TableCell className="font-mono text-xs">{b.code}</TableCell>
                    <TableCell className="text-xs text-slate-600">{b.city}</TableCell>
                    <TableCell className="text-xs font-semibold text-slate-800">
                      {students.filter((s) => s.branchId === b.id).length} students
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-800">
                      {mentors.filter((m) => m.branchId === b.id).length} mentors
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-indigo-700">
                      {classes.filter((c) => c.branchId === b.id).length} classes
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
