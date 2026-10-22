'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Package } from '../../../lib/types/models';
import { Package as PackageIcon } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils/formatters';
import { Button } from '../../../components/ui/Button';
import { AddRecordModal } from '../../../components/operations/AddRecordModal';
import { Plus } from 'lucide-react';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>(db.getPackages());
  const [showModal, setShowModal] = useState(false);

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

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Packages & Enrolments</h1>
            <p className="text-xs text-slate-500 mt-1">
              Tuition package offerings, session allowances, validity periods, and pricing.
            </p>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>
            Add record
          </Button>
        </div>

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((p) => (
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <AddRecordModal
          title="Add tuition package"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          fields={[
            { name: 'name', label: 'Package name', placeholder: '12-Session Math Package' },
            { name: 'code', label: 'Package code', placeholder: 'MATH-12' },
            { name: 'sessions', label: 'Included sessions', type: 'number', placeholder: '12' },
            { name: 'validity', label: 'Validity (days)', type: 'number', placeholder: '90' },
            { name: 'price', label: 'Tuition price', type: 'number', placeholder: '1200' },
            { name: 'currency', label: 'Currency', placeholder: 'USD' },
          ]}
          onSave={async (values) => {
            const response = await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'package', record: {
              name: values.name.trim(), code: values.code.trim().toUpperCase(),
              totalSessions: Number(values.sessions) || 1, validityDays: Number(values.validity) || 30,
              price: Number(values.price) || 0, currency: values.currency.trim().toUpperCase() || 'USD',
              subjectIds: [], branchIds: [], isActive: true, provenance: 'LOCALLY_CREATED',
            }})});
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to create package.');
            await refreshPackages();
            setShowModal(false);
          }}
        />
      </div>
    </AppShell>
  );
}
