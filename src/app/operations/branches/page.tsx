'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Building2, Plus, MapPin, Phone, Mail, Globe } from 'lucide-react';
import { Branch } from '../../../lib/types/models';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>(db.getBranches());
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) return;
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'branch', record: {
      name,
      code,
      address,
      city,
      timezone,
      phone: '+1 (555) 0100',
      email: `${code.toLowerCase()}@academyapex.com`,
      isActive: true,
      provenance: 'LOCALLY_CREATED',
      }}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to create branch.');
    const b = result.record as Branch;
    setBranches((current) => [...current, b]);
    setShowModal(false);
    setName('');
    setCode('');
    setAddress('');
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campus Branches</h1>
            <p className="text-xs text-slate-500 mt-1">
              Physical learning centers, timezone configurations, and facility settings.
            </p>
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campus Name</TableHead>
              <TableHead>Branch Code</TableHead>
              <TableHead>Location / Address</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Active Status</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-bold text-slate-900">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>{b.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs font-semibold text-slate-700">{b.code}</TableCell>
                <TableCell className="text-xs text-slate-600">
                  {b.address}, {b.city}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title="Create New Campus Branch"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreate} disabled={!name || !code}>
                  Save Branch
                </Button>
              </div>
            }
          >
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Campus Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Austin STEM Center"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Branch Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. ATX-CENTRAL"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Austin"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="100 Congress Avenue, Suite 400"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}
