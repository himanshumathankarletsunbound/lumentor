'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { RowActions } from '../../../components/ui/RowActions';
import { DeleteConfirmModal } from '../../../components/ui/DeleteConfirmModal';
import { Search, RefreshCw, Plus, ArrowDown, ArrowUp } from 'lucide-react';
import Link from 'next/link';
import { AddRecordModal } from '../../../components/operations/AddRecordModal';
import { Student } from '../../../lib/types/models';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>(() => db.getStudents());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Student['status']>('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [branches, setBranches] = useState(() => db.getBranches());

  const refreshStudents = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (json.success && json.data && json.data.students) {
        setStudents(json.data.students);
        if (json.data.branches) setBranches(json.data.branches);
        if (typeof db.initClient === 'function') {
          db.initClient({ ...db.getSnapshot(), students: json.data.students });
        }
        const branchResponse = await fetch('/api/records?type=branch');
        const branchResult = await branchResponse.json();
        if (branchResponse.ok && branchResult.success) setBranches(branchResult.records);
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

  const handleCreateStudent = async (values: Record<string, string>) => {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'student',
        record: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone?.trim() || '',
          guardianName: values.guardianName?.trim() || '',
          guardianEmail: values.guardianEmail?.trim() || '',
          branchId: values.branchId || branches[0]?.id || '',
          enrolledPackageIds: [],
          status: 'ACTIVE',
          provenance: 'LOCALLY_CREATED',
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to create student.');
    const created = result.record as Student;
    setStudents((current) => [...current, created]);
    setShowModal(false);
  };

  const handleUpdateStudent = async (values: Record<string, string>) => {
    if (!editingStudent) return;
    const response = await fetch('/api/records', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'student',
        id: editingStudent.id,
        updates: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone?.trim() || '',
          guardianName: values.guardianName?.trim() || '',
          guardianEmail: values.guardianEmail?.trim() || '',
          branchId: values.branchId || editingStudent.branchId,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to update student.');
    await refreshStudents();
    setEditingStudent(null);
  };

  const handleDeleteStudent = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/records?type=student&id=${encodeURIComponent(deletingStudent.id)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete student.');
      await refreshStudents();
      setDeletingStudent(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesBranch = branchFilter === 'ALL' || s.branchId === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  }).sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.trim();
    const nameB = `${b.firstName} ${b.lastName}`.trim();
    return sortDirection === 'asc'
      ? nameA.localeCompare(nameB)
      : nameB.localeCompare(nameA);
  });

  const toggleNameSort = () => {
    setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
  };

  const formatCreatedAt = (value: string) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

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
            <select
              aria-label="Filter students by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="LEAD">Lead</option>
              <option value="GRADUATED">Graduated</option>
            </select>
            <select
              aria-label="Filter students by branch"
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
            >
              <option value="ALL">All branches</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
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
                <TableHead>
                  <button type="button" onClick={toggleNameSort} className="inline-flex items-center gap-1.5 hover:text-slate-900">
                    Name
                    {sortDirection === 'desc' ? <ArrowDown className="h-3.5 w-3.5" aria-label="descending" /> : <ArrowUp className="h-3.5 w-3.5" aria-label="ascending" />}
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created at</TableHead>
                <TableHead>Campus Branch</TableHead>
                <TableHead>Guardian Contact</TableHead>
                <TableHead>Custom Fields (Classcard)</TableHead>
                <TableHead>Provenance</TableHead>
                <TableHead className="text-right">Action</TableHead>
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
                    <TableCell>
                      <Badge variant={s.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" dot>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{s.email || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-600">{s.phone || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-600">{formatCreatedAt(s.createdAt)}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">
                      {branch?.name || 'Primary Campus'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <p className="font-medium text-slate-800">{s.guardianName || 'None'}</p>
                      <p className="text-[11px] text-slate-400">{s.guardianEmail || '-'}</p>
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
                      {s.provenance === 'CLASSCARD_SOURCED' ? (
                        <Badge variant="purple" size="sm">Classcard</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Local</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        editTooltip={`Edit ${s.firstName} ${s.lastName}`}
                        deleteTooltip={`Delete ${s.firstName} ${s.lastName}`}
                        onEdit={() => setEditingStudent(s)}
                        onDelete={() => setDeletingStudent(s)}
                        extraActions={[
                          {
                            label: 'View attendance history',
                            onClick: () => alert(`Opening attendance record history for ${s.firstName} ${s.lastName}...`),
                          },
                          {
                            label: 'View guardian profile',
                            onClick: () => alert(`Guardian contact: ${s.guardianName || 'None'} (${s.guardianEmail || 'No email'})`),
                          },
                          {
                            label: 'Export student record',
                            onClick: () => alert(`Exporting record for ${s.firstName} ${s.lastName}...`),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Add Student Modal */}
        <AddRecordModal
          title="Add Student"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          fields={[
            { name: 'firstName', label: 'First name', placeholder: 'e.g. Aarav' },
            { name: 'lastName', label: 'Last name', placeholder: 'e.g. Sharma' },
            { name: 'email', label: 'Email', type: 'email', placeholder: 'student@example.com' },
            { name: 'phone', label: 'Phone', required: false, placeholder: '+1 (555) 000-0000' },
            { name: 'guardianName', label: 'Guardian name', required: false, placeholder: 'Parent or Guardian' },
            { name: 'guardianEmail', label: 'Guardian email', type: 'email', required: false, placeholder: 'guardian@example.com' },
          ]}
          onSave={handleCreateStudent}
        />

        {/* Edit Student Modal */}
        {editingStudent && (
          <AddRecordModal
            title={`Edit Student: ${editingStudent.firstName} ${editingStudent.lastName}`}
            isOpen={Boolean(editingStudent)}
            submitLabel="Save changes"
            onClose={() => setEditingStudent(null)}
            initialValues={{
              firstName: editingStudent.firstName,
              lastName: editingStudent.lastName,
              email: editingStudent.email,
              phone: editingStudent.phone || '',
              guardianName: editingStudent.guardianName || '',
              guardianEmail: editingStudent.guardianEmail || '',
              branchId: editingStudent.branchId || '',
            }}
            fields={[
              { name: 'firstName', label: 'First name' },
              { name: 'lastName', label: 'Last name' },
              { name: 'email', label: 'Email', type: 'email' },
              { name: 'phone', label: 'Phone', required: false },
              { name: 'guardianName', label: 'Guardian name', required: false },
              { name: 'guardianEmail', label: 'Guardian email', type: 'email', required: false },
            ]}
            onSave={handleUpdateStudent}
          />
        )}

        {/* Delete Student Modal */}
        {deletingStudent && (
          <DeleteConfirmModal
            isOpen={Boolean(deletingStudent)}
            recordName={`${deletingStudent.firstName} ${deletingStudent.lastName}`}
            recordType="student"
            isDeleting={isDeleting}
            onConfirm={handleDeleteStudent}
            onClose={() => setDeletingStudent(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
