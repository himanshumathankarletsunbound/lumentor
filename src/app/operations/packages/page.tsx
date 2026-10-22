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
import { Package as PackageIcon, Plus, Search } from 'lucide-react';
import { Package } from '../../../lib/types/models';
import { formatCurrency } from '../../../lib/utils/formatters';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>(db.getPackages());
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<Package | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const refreshPackages = async () => {
    const response = await fetch('/api/records?type=package');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load packages.');
    setPackages(result.records as Package[]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPackages().catch((error: unknown) => {
        console.error('Failed to load packages from the database:', error);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCreate = async (values: Record<string, string>) => {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'package',
        record: {
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          totalSessions: Number(values.sessions) || 1,
          validityDays: Number(values.validity) || 30,
          price: Number(values.price) || 0,
          currency: values.currency?.trim().toUpperCase() || 'USD',
          subjectIds: [],
          branchIds: [],
          isActive: true,
          provenance: 'LOCALLY_CREATED',
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to create package.');
    await refreshPackages();
    setShowModal(false);
  };

  const handleUpdate = async (values: Record<string, string>) => {
    if (!editingPackage) return;
    const response = await fetch('/api/records', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'package',
        id: editingPackage.id,
        updates: {
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          totalSessions: Number(values.sessions) || editingPackage.totalSessions,
          validityDays: Number(values.validity) || editingPackage.validityDays,
          price: Number(values.price) || editingPackage.price,
          currency: values.currency?.trim().toUpperCase() || editingPackage.currency,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to update package.');
    await refreshPackages();
    setEditingPackage(null);
  };

  const handleDelete = async () => {
    if (!deletingPackage) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/records?type=package&id=${encodeURIComponent(deletingPackage.id)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete package.');
      await refreshPackages();
      setDeletingPackage(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = packages.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Packages & Enrolments</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {packages.length} Packages
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tuition package offerings, session allowances, validity periods, and pricing.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search packages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>
              Add record
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8">
            <TableEmptyState
              title={search ? 'No matching packages found' : 'No Tuition Packages Configured'}
              description={
                search
                  ? 'Try adjusting your search query.'
                  : 'Define credit packages and tuition plans for student enrollments.'
              }
              action={
                <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>
                  Create Tuition Package
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Included Sessions</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Tuition Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <PackageIcon className="w-4 h-4 text-indigo-600" />
                      <span>{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-slate-700">{p.code}</TableCell>
                  <TableCell className="text-xs font-semibold text-slate-800">{p.totalSessions} sessions</TableCell>
                  <TableCell className="text-xs text-slate-600">{p.validityDays} days</TableCell>
                  <TableCell className="text-xs font-bold text-slate-900">
                    {formatCurrency(p.price, p.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? 'success' : 'neutral'} size="sm" dot>
                      {p.isActive ? 'Active' : 'Archived'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.provenance === 'CLASSCARD_SOURCED' ? 'purple' : 'neutral'} size="sm">
                      {p.provenance === 'CLASSCARD_SOURCED' ? 'Classcard' : 'Local'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      editTooltip={`Edit ${p.name}`}
                      deleteTooltip={`Delete ${p.name}`}
                      onEdit={() => setEditingPackage(p)}
                      onDelete={() => setDeletingPackage(p)}
                      extraActions={[
                        {
                          label: 'View enrolled students',
                          onClick: () => alert(`Enrolled students in ${p.name} (${p.code})...`),
                        },
                        {
                          label: 'Duplicate package',
                          onClick: () => setShowModal(true),
                        },
                        {
                          label: 'Adjust pricing rules',
                          onClick: () => alert(`Adjust pricing rules for ${p.name}...`),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Add Package Modal */}
        <AddRecordModal
          title="Add Tuition Package"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          fields={[
            { name: 'name', label: 'Package name', placeholder: 'e.g. 12-Session Math Package' },
            { name: 'code', label: 'Package code', placeholder: 'e.g. MATH-12' },
            { name: 'sessions', label: 'Included sessions', type: 'number', placeholder: '12' },
            { name: 'validity', label: 'Validity (days)', type: 'number', placeholder: '90' },
            { name: 'price', label: 'Tuition price', type: 'number', placeholder: '1200' },
            { name: 'currency', label: 'Currency', placeholder: 'USD' },
          ]}
          onSave={handleCreate}
        />

        {/* Edit Package Modal */}
        {editingPackage && (
          <AddRecordModal
            title={`Edit Package: ${editingPackage.name}`}
            isOpen={Boolean(editingPackage)}
            submitLabel="Save changes"
            onClose={() => setEditingPackage(null)}
            initialValues={{
              name: editingPackage.name,
              code: editingPackage.code,
              sessions: String(editingPackage.totalSessions),
              validity: String(editingPackage.validityDays),
              price: String(editingPackage.price),
              currency: editingPackage.currency,
            }}
            fields={[
              { name: 'name', label: 'Package name' },
              { name: 'code', label: 'Package code' },
              { name: 'sessions', label: 'Included sessions', type: 'number' },
              { name: 'validity', label: 'Validity (days)', type: 'number' },
              { name: 'price', label: 'Tuition price', type: 'number' },
              { name: 'currency', label: 'Currency' },
            ]}
            onSave={handleUpdate}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deletingPackage && (
          <DeleteConfirmModal
            isOpen={Boolean(deletingPackage)}
            recordName={deletingPackage.name}
            recordType="package"
            isDeleting={isDeleting}
            onConfirm={handleDelete}
            onClose={() => setDeletingPackage(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
