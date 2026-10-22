'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { BookOpen, Plus } from 'lucide-react';
import { Subject } from '../../../lib/types/models';
import { AddRecordModal } from '../../../components/operations/AddRecordModal';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>(db.getSubjects());
  const [showModal, setShowModal] = useState(false);

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
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>
            Add record
          </Button>
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
        <AddRecordModal
          title="Add academic subject"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          fields={[
            { name: 'name', label: 'Subject name', placeholder: 'Mathematics' },
            { name: 'code', label: 'Subject code', placeholder: 'MATH-101' },
            { name: 'category', label: 'Category', placeholder: 'STEM' },
            { name: 'duration', label: 'Default duration (minutes)', type: 'number', placeholder: '60' },
          ]}
          onSave={async (values) => {
            const duration = Number(values.duration) || 60;
            const response = await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'subject', record: {
              name: values.name.trim(), code: values.code.trim().toUpperCase(), category: values.category.trim(),
              description: '', defaultDurationMinutes: duration, availableDurations: [duration],
              isActive: true, color: '#6366f1', provenance: 'LOCALLY_CREATED',
            }})});
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to create subject.');
            setSubjects((current) => [...current, result.record]);
            setShowModal(false);
          }}
        />
      </div>
    </AppShell>
  );
}
