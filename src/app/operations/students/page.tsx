'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Users, Mail, Phone, MapPin, Search, RefreshCw, Plus } from 'lucide-react';
import { formatDate } from '../../../lib/utils/formatters';
import Link from 'next/link';
import { AddRecordModal } from '../../../components/operations/AddRecordModal';

export default function StudentsPage() {
  const [students, setStudents] = useState(() => db.getStudents());
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const branches = db.getBranches();

  const refreshStudents = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (json.success && json.data && json.data.students) {
        setStudents(json.data.students);
        if (typeof db.initClient === 'function') {
          db.initClient({ ...db.getSnapshot(), students: json.data.students });
        }
      }
    } catch (e) {
      console.warn('Failed to refresh students from API:', e);
    }
  };

  React.useEffect(() => {
    const timer = window.setTimeout(() => void refreshStudents(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSyncStudents = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/classcard/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: 'STUDENTS' }),
      });
      const data = await res.json();
      if (data.status === 'COMPLETED' || data.success || data.recordsProcessed > 0) {
        await refreshStudents();
      }
    } finally {
      setIsSyncing(false);
    }
  };

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
          <div className="flex items-center gap-2.5">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>
              Add record
            </Button>
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
            <Button
              variant="outline"
              size="sm"
              isLoading={isSyncing}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
              onClick={handleSyncStudents}
            >
              Sync Classcard
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8">
            <TableEmptyState
              title={search ? 'No matching students found' : 'No Students Synchronized Yet'}
              description={
                search
                  ? 'Try adjusting your search criteria.'
                  : 'Your database is in production mode with demo data purged. Connect to Classcard to import live student rosters.'
              }
              action={
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isSyncing}
                    leftIcon={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
                    onClick={handleSyncStudents}
                  >
                    Sync Students from Classcard
                  </Button>
                  <Link href="/admin/classcard-integration">
                    <Button variant="outline" size="sm">
                      Integration Gateway
                    </Button>
                  </Link>
                </div>
              }
            />
          </div>
        ) : (
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
        )}
        <AddRecordModal
          title="Add student"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          fields={[
            { name: 'firstName', label: 'First name', placeholder: 'Aarav' },
            { name: 'lastName', label: 'Last name', placeholder: 'Sharma' },
            { name: 'email', label: 'Email', type: 'email', placeholder: 'student@example.com' },
            { name: 'phone', label: 'Phone', required: false },
          ]}
          onSave={async (values) => {
            const response = await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'student', record: {
              firstName: values.firstName.trim(), lastName: values.lastName.trim(),
              email: values.email.trim(), phone: values.phone.trim(), branchId: branches[0]?.id || '',
              enrolledPackageIds: [], status: 'ACTIVE', provenance: 'LOCALLY_CREATED',
            }})});
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to create student.');
            const created = result.record;
            setStudents((current) => [...current, created]);
            setShowModal(false);
          }}
        />
      </div>
    </AppShell>
  );
}
