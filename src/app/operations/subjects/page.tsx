'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { BookOpen, Plus } from 'lucide-react';
import { Subject } from '../../../lib/types/models';

export default function SubjectsPage() {
  const [subjects] = useState<Subject[]>(db.getSubjects());

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Subjects</h1>
            <p className="text-xs text-slate-500 mt-1">
              Curriculum catalog, category assignments, and configurable class durations.
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject Name</TableHead>
              <TableHead>Subject Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Default Duration</TableHead>
              <TableHead>Available Durations</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-bold text-slate-900">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span>{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs font-semibold text-slate-700">{s.code}</TableCell>
                <TableCell>
                  <Badge variant="neutral" size="sm">
                    {s.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-700 font-semibold">{s.defaultDurationMinutes} mins</TableCell>
                <TableCell className="text-xs text-slate-500">
                  {s.availableDurations.map((d) => `${d}m`).join(', ')}
                </TableCell>
                <TableCell>
                  <Badge variant={s.provenance === 'CLASSCARD_SOURCED' ? 'purple' : 'neutral'} size="sm">
                    {s.provenance === 'CLASSCARD_SOURCED' ? 'Classcard' : 'Local'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
