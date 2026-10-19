'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Users, Mail, Phone, MapPin, Search } from 'lucide-react';
import { formatDate } from '../../../lib/utils/formatters';

export default function StudentsPage() {
  const [students] = useState(db.getStudents());
  const [search, setSearch] = useState('');
  const branches = db.getBranches();

  const filtered = students.filter((s) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Students Directory</h1>
            <p className="text-xs text-slate-500 mt-1">
              Enrolled students, guardian contacts, custom attributes, and Classcard synchronization status.
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student Name</TableHead>
              <TableHead>Campus Branch</TableHead>
              <TableHead>Guardian Contact</TableHead>
              <TableHead>Custom Fields (Classcard)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provenance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const branch = branches.find((b) => b.id === s.branchId);
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {s.firstName[0]}
                        {s.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{s.firstName} {s.lastName}</p>
                        <p className="text-[11px] text-slate-400">{s.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-700">
                    {branch?.name || 'Primary Campus'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{s.guardianName || 'None'}</p>
                    <p className="text-[11px] text-slate-400">{s.guardianEmail}</p>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {s.customFields ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(s.customFields).map(([k, v]) => (
                          <span key={k} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" dot>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.provenance === 'CLASSCARD_SOURCED' ? (
                      <Badge variant="purple" size="sm">Classcard</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Local</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
