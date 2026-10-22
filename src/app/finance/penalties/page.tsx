'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PenaltyModal } from '../../../components/payroll/PenaltyModal';
import { Penalty } from '../../../lib/types/payroll';
import { PenaltyPolicy } from '../../../lib/types/payroll';
import { ShieldAlert, Plus, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';

export default function PenaltiesPage() {
  const { isAdmin, isMentor, currentUser } = useAuth();
  const [penalties, setPenalties] = useState<Penalty[]>(
    isMentor ? db.getPenalties(currentUser.mentorId) : db.getPenalties()
  );
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState<Penalty | null>(null);
  const [policies, setPolicies] = useState<PenaltyPolicy[]>([]);
  const [policyName, setPolicyName] = useState('');
  const [policyDescription, setPolicyDescription] = useState('');
  const [policyAmount, setPolicyAmount] = useState('');

  const refreshPolicies = async () => {
    const response = await fetch('/api/penalty-policies');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load penalty policies.');
    setPolicies(result.policies);
  };

  React.useEffect(() => {
    const timer = window.setTimeout(() => void refreshPolicies().catch(console.error), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const createPolicy = async () => {
    const response = await fetch('/api/penalty-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: policyName, description: policyDescription, defaultAmount: Number(policyAmount) || 0 }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to create penalty policy.');
    setPolicyName('');
    setPolicyDescription('');
    setPolicyAmount('');
    await refreshPolicies();
  };

  const deletePolicy = async (id: string) => {
    const response = await fetch(`/api/penalty-policies?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Unable to remove penalty policy.');
    await refreshPolicies();
  };

  const filtered = penalties.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    return true;
  });

  const refresh = () => {
    setPenalties(isMentor ? db.getPenalties(currentUser.mentorId) : db.getPenalties());
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Penalties & Policy Deductions</h1>
            <p className="text-xs text-slate-500 mt-1">
              Authorized deductions, late cancellations, unapproved absences, and audit reversals.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setSelectedPenalty(null);
                setModalOpen(true);
              }}
            >
              Submit New Penalty
            </Button>
          )}
        </div>

        {!isMentor && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-slate-900">Penalty policy categories</h2>
              <p className="text-xs text-slate-500">Administrators define the categories available when operations submit a penalty.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_10rem_auto] gap-2">
              <input value={policyName} onChange={(event) => setPolicyName(event.target.value)} placeholder="Category name" className="p-2 border rounded-lg text-xs" />
              <input value={policyDescription} onChange={(event) => setPolicyDescription(event.target.value)} placeholder="Description" className="p-2 border rounded-lg text-xs" />
              <input value={policyAmount} onChange={(event) => setPolicyAmount(event.target.value)} type="number" min="0" step="0.01" placeholder="Default amount" className="p-2 border rounded-lg text-xs" />
              <Button size="sm" variant="primary" onClick={() => void createPolicy()}>Add category</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {policies.map((policy) => (
                <span key={policy.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
                  {policy.name}{policy.defaultAmount > 0 ? ` ($${policy.defaultAmount})` : ''}
                  <button type="button" className="text-rose-600" onClick={() => void deletePolicy(policy.id)} aria-label={`Remove ${policy.name}`}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 text-xs">
          {['ALL', 'SUBMITTED', 'APPROVED', 'APPLIED', 'REVERSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mentor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Mandatory Reason</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted By / Date</TableHead>
              <TableHead>Dispute State</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <TableEmptyState title="No penalty records found" description="Try selecting another status filter." />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((pen) => (
                <TableRow
                  key={pen.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedPenalty(pen);
                    setModalOpen(true);
                  }}
                >
                  <TableCell className="font-bold text-slate-900">
                    <p>{pen.mentorName}</p>
                    <p className="text-[11px] text-slate-400 font-normal">{pen.branchName}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" size="sm">
                      {pen.category.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 max-w-xs truncate">
                    {pen.reason}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-rose-600">
                    -{formatCurrency(pen.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        pen.status === 'APPROVED' || pen.status === 'APPLIED'
                          ? 'danger'
                          : pen.status === 'SUBMITTED'
                          ? 'warning'
                          : pen.status === 'REVERSED'
                          ? 'purple'
                          : 'neutral'
                      }
                      size="sm"
                      dot
                    >
                      {pen.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {pen.createdByName} on {formatDate(pen.createdAt)}
                  </TableCell>
                  <TableCell>
                    {pen.disputeStatus === 'DISPUTED' ? (
                      <Badge variant="warning" size="sm">
                        Disputed
                      </Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PenaltyModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          penaltyToView={selectedPenalty}
          onSaved={refresh}
        />
      </div>
    </AppShell>
  );
}
