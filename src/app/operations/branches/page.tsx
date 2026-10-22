'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { RowActions } from '../../../components/ui/RowActions';
import { DeleteConfirmModal } from '../../../components/ui/DeleteConfirmModal';
import { AddRecordModal } from '../../../components/operations/AddRecordModal';
import { Building2, Plus, Search } from 'lucide-react';
import { Branch } from '../../../lib/types/models';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>(db.getBranches());
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const refreshBranches = async () => {
    const response = await fetch('/api/records?type=branch');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load branches.');
    setBranches(result.records as Branch[]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshBranches().catch((error: unknown) => {
        console.error('Failed to load branches from the database:', error);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCreate = async (values: Record<string, string>) => {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'branch',
        record: {
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          address: values.address?.trim() || '',
          city: values.city?.trim() || '',
          timezone: values.timezone?.trim() || 'America/New_York',
          phone: values.phone?.trim() || '+1 (555) 0100',
          email: values.email?.trim() || `${values.code.trim().toLowerCase()}@academyapex.com`,
          isActive: true,
          provenance: 'LOCALLY_CREATED',
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to create branch.');
    await refreshBranches();
    setShowModal(false);
  };

  const handleUpdate = async (values: Record<string, string>) => {
    if (!editingBranch) return;
    const response = await fetch('/api/records', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'branch',
        id: editingBranch.id,
        updates: {
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          address: values.address?.trim() || '',
          city: values.city?.trim() || '',
          timezone: values.timezone?.trim() || editingBranch.timezone,
          phone: values.phone?.trim() || editingBranch.phone,
          email: values.email?.trim() || editingBranch.email,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to update branch.');
    await refreshBranches();
    setEditingBranch(null);
  };

  const handleDelete = async () => {
    if (!deletingBranch) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/records?type=branch&id=${encodeURIComponent(deletingBranch.id)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete branch.');
      await refreshBranches();
      setDeletingBranch(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = branches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q);
  });

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campus Branches</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {branches.length} Locations
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Physical learning centers, timezone configurations, and facility settings.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search branches..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowModal(true)}
            >
              Add record
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8">
            <TableEmptyState
              title={search ? 'No matching branches found' : 'No Campus Branches Configured'}
              description={
                search
                  ? 'Try adjusting your search criteria.'
                  : 'Add your primary campus branch to associate mentors, classes, and students.'
              }
              action={
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowModal(true)}
                >
                  Create Campus Branch
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campus Name</TableHead>
                <TableHead>Branch Code</TableHead>
                <TableHead>Location / Address</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Active Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>{b.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-slate-700">{b.code}</TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {b.address}{b.city ? `, ${b.city}` : ''}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">{b.timezone}</TableCell>
                  <TableCell>
                    <Badge variant={b.isActive ? 'success' : 'neutral'} size="sm" dot>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.provenance === 'CLASSCARD_SOURCED' ? 'purple' : 'neutral'} size="sm">
                      {b.provenance === 'CLASSCARD_SOURCED' ? 'Classcard' : 'Local'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      editTooltip={`Edit ${b.name}`}
                      deleteTooltip={`Delete ${b.name}`}
                      onEdit={() => setEditingBranch(b)}
                      onDelete={() => setDeletingBranch(b)}
                      extraActions={[
                        {
                          label: 'View campus facilities',
                          onClick: () => alert(`Campus facilities view for ${b.name} will open.`),
                        },
                        {
                          label: 'View room schedules',
                          onClick: () => alert(`Room schedules for ${b.name} (${b.code})...`),
                        },
                        {
                          label: 'Export campus roster',
                          onClick: () => alert(`Exporting branch roster for ${b.name}...`),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Add Branch Modal */}
        <AddRecordModal
          title="Create New Campus Branch"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          fields={[
            { name: 'name', label: 'Campus name', placeholder: 'e.g. Austin Downtown Campus' },
            { name: 'code', label: 'Branch code', placeholder: 'e.g. ATX-01' },
            { name: 'address', label: 'Address', placeholder: 'e.g. 500 Congress Ave' },
            { name: 'city', label: 'City', placeholder: 'e.g. Austin, TX' },
            { name: 'timezone', label: 'Timezone', placeholder: 'e.g. America/Chicago' },
            { name: 'phone', label: 'Phone', required: false, placeholder: '+1 (555) 0100' },
          ]}
          onSave={handleCreate}
        />

        {/* Edit Branch Modal */}
        {editingBranch && (
          <AddRecordModal
            title={`Edit Campus Branch: ${editingBranch.name}`}
            isOpen={Boolean(editingBranch)}
            submitLabel="Save changes"
            onClose={() => setEditingBranch(null)}
            initialValues={{
              name: editingBranch.name,
              code: editingBranch.code,
              address: editingBranch.address || '',
              city: editingBranch.city || '',
              timezone: editingBranch.timezone || 'America/New_York',
              phone: editingBranch.phone || '',
            }}
            fields={[
              { name: 'name', label: 'Campus name' },
              { name: 'code', label: 'Branch code' },
              { name: 'address', label: 'Address', required: false },
              { name: 'city', label: 'City', required: false },
              { name: 'timezone', label: 'Timezone', required: false },
              { name: 'phone', label: 'Phone', required: false },
            ]}
            onSave={handleUpdate}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deletingBranch && (
          <DeleteConfirmModal
            isOpen={Boolean(deletingBranch)}
            recordName={deletingBranch.name}
            recordType="branch"
            isDeleting={isDeleting}
            onConfirm={handleDelete}
            onClose={() => setDeletingBranch(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
