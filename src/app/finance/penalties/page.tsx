'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PenaltyModal } from '../../../components/payroll/PenaltyModal';
import { Penalty, PenaltyPolicy, PenaltyDeductionType } from '../../../lib/types/payroll';
import { ShieldAlert, Plus, CheckCircle2, RotateCcw, FileText, Settings2, Trash2, Pencil, Search, AlertCircle, Percent, DollarSign, Sparkles } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';
import { Modal } from '../../../components/ui/Modal';
import { DeleteConfirmModal } from '../../../components/ui/DeleteConfirmModal';

export default function PenaltiesPage() {
  const { isAdmin, isMentor, currentUser } = useAuth();
  const [penalties, setPenalties] = useState<Penalty[]>(
    isMentor ? db.getPenalties(currentUser.mentorId) : db.getPenalties()
  );

  // Card 1: Penalties Approval Queue State
  const [statusFilter, setStatusFilter] = useState<'SUBMITTED' | 'ALL' | 'APPROVED' | 'APPLIED' | 'REVERSED'>('SUBMITTED');
  const [penaltySearch, setPenaltySearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState<Penalty | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Card 2: Penalty Policies State & Form Inputs
  const [policies, setPolicies] = useState<PenaltyPolicy[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyDescription, setPolicyDescription] = useState('');
  const [policyType, setPolicyType] = useState<PenaltyDeductionType>('FIXED_AMOUNT');
  const [policyRate, setPolicyRate] = useState('');
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyFormError, setPolicyFormError] = useState<string | null>(null);
  const [policySuccessMsg, setPolicySuccessMsg] = useState<string | null>(null);

  // Edit / Delete Policy state
  const [editingPolicy, setEditingPolicy] = useState<PenaltyPolicy | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<PenaltyDeductionType>('FIXED_AMOUNT');
  const [editRate, setEditRate] = useState('');
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<PenaltyPolicy | null>(null);
  const [isDeletingPolicy, setIsDeletingPolicy] = useState(false);

  const refreshPolicies = async () => {
    try {
      const response = await fetch('/api/penalty-policies');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load penalty policies.');
      setPolicies(result.policies || []);
    } catch (err) {
      console.warn('Failed to load policies:', err);
    }
  };

  const refreshPenalties = () => {
    setPenalties(isMentor ? db.getPenalties(currentUser.mentorId) : db.getPenalties());
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPolicies();
      refreshPenalties();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Quick Approval Handler
  const handleQuickApprove = (penalty: Penalty) => {
    try {
      if (penalty.createdBy === currentUser.id) {
        setActionMessage({
          type: 'error',
          text: 'Anti-self-approval rule: Operations staff cannot approve their own submitted penalty.',
        });
        return;
      }
      db.approvePenalty(penalty.id, currentUser.id, currentUser.name);
      db.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'PENALTY_APPROVED',
        entityType: 'Penalty',
        entityId: penalty.id,
        details: `Approved penalty ${penalty.id} of $${penalty.amount} for ${penalty.mentorName}`,
      });
      void db.persistNow();
      refreshPenalties();
      setActionMessage({
        type: 'success',
        text: `Penalty for ${penalty.mentorName} successfully approved.`,
      });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Approval failed.',
      });
    }
  };

  // Card 2: Create Policy Handler
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicyFormError(null);
    setPolicySuccessMsg(null);

    const title = policyTitle.trim();
    if (!title) {
      setPolicyFormError('Policy title is required.');
      return;
    }

    const rate = parseFloat(policyRate);
    if (isNaN(rate) || rate < 0) {
      setPolicyFormError('Please enter a valid rate or amount value.');
      return;
    }

    const id = policyId.trim() || `POL-${Date.now().toString().slice(-6)}`;

    setIsSavingPolicy(true);
    try {
      const response = await fetch('/api/penalty-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          code: id,
          title,
          description: policyDescription.trim(),
          deductionType: policyType,
          rateValue: rate,
          defaultAmount: policyType === 'FIXED_AMOUNT' ? rate : 0,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to create penalty policy.');
      }

      setPolicyId('');
      setPolicyTitle('');
      setPolicyDescription('');
      setPolicyRate('');
      setPolicyType('FIXED_AMOUNT');
      setPolicySuccessMsg(`Policy "${title}" (${id}) saved to database successfully.`);
      setTimeout(() => setPolicySuccessMsg(null), 4000);
      await refreshPolicies();
    } catch (err) {
      setPolicyFormError(err instanceof Error ? err.message : 'Failed to save policy.');
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Card 2: Update Policy Handler
  const handleUpdatePolicy = async () => {
    if (!editingPolicy) return;
    setIsUpdatingPolicy(true);
    try {
      const rate = parseFloat(editRate);
      const response = await fetch('/api/penalty-policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPolicy.id,
          updates: {
            title: editTitle.trim(),
            description: editDescription.trim(),
            deductionType: editType,
            rateValue: isNaN(rate) ? editingPolicy.rateValue : rate,
            defaultAmount: editType === 'FIXED_AMOUNT' ? (isNaN(rate) ? editingPolicy.defaultAmount : rate) : 0,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to update policy.');
      setEditingPolicy(null);
      await refreshPolicies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setIsUpdatingPolicy(false);
    }
  };

  // Card 2: Delete Policy Handler
  const handleDeletePolicy = async () => {
    if (!deletingPolicy) return;
    setIsDeletingPolicy(true);
    try {
      const response = await fetch(`/api/penalty-policies?id=${encodeURIComponent(deletingPolicy.id)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to remove policy.');
      setDeletingPolicy(null);
      await refreshPolicies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setIsDeletingPolicy(false);
    }
  };

  // Filter penalties for Card 1
  const pendingCount = useMemo(() => {
    return penalties.filter((p) => p.status === 'SUBMITTED').length;
  }, [penalties]);

  const filteredPenalties = useMemo(() => {
    return penalties.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (penaltySearch.trim()) {
        const q = penaltySearch.toLowerCase();
        return (
          p.mentorName.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.reason.toLowerCase().includes(q) ||
          (p.branchName && p.branchName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [penalties, statusFilter, penaltySearch]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
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

        {actionMessage && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-in fade-in-50 duration-150 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-xs opacity-60 hover:opacity-100 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* CARD 1: ALL THE PENALTIES WHICH HAVE COME TO APPROVE           */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          {/* Card 1 Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50/50 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-200/70 shadow-2xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Penalties Submitted for Approval
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300/60">
                    {pendingCount} Pending Review
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  All deduction incidents requiring administrative authorization prior to payroll processing.
                </p>
              </div>
            </div>

            {/* Status Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setStatusFilter('SUBMITTED')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === 'SUBMITTED'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({penalties.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('APPROVED')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === 'APPROVED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Approved
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('APPLIED')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === 'APPLIED'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Applied
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('REVERSED')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === 'REVERSED'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Reversed
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search mentor or reason..."
                  value={penaltySearch}
                  onChange={(e) => setPenaltySearch(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs w-48 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 1 Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mentor</TableHead>
                <TableHead>Violation Category</TableHead>
                <TableHead>Mandatory Reason</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted By / Date</TableHead>
                <TableHead>Dispute State</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPenalties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <TableEmptyState
                      title={statusFilter === 'SUBMITTED' ? 'No Penalties Pending Approval' : 'No Penalty Records Found'}
                      description={
                        statusFilter === 'SUBMITTED'
                          ? 'All submitted penalties have been processed and approved. New violations submitted by operations will appear here.'
                          : 'Try selecting another status filter or submit a new penalty record.'
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredPenalties.map((pen) => {
                  const isSubmitter = pen.createdBy === currentUser.id;
                  const isSubmitted = pen.status === 'SUBMITTED';

                  return (
                    <TableRow
                      key={pen.id}
                      className="cursor-pointer hover:bg-slate-50/70"
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
                      <TableCell className="text-xs text-slate-700 max-w-xs truncate" title={pen.reason}>
                        {pen.reason}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-rose-600">
                        -{formatCurrency(pen.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            pen.status === 'APPROVED' || pen.status === 'APPLIED'
                              ? 'success'
                              : pen.status === 'SUBMITTED'
                              ? 'warning'
                              : pen.status === 'REVERSED'
                              ? 'purple'
                              : 'neutral'
                          }
                          size="sm"
                          dot
                        >
                          {pen.status === 'SUBMITTED' ? 'Pending Approval' : pen.status}
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
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && isSubmitted && (
                            <Button
                              variant="success"
                              size="sm"
                              disabled={isSubmitter}
                              title={
                                isSubmitter
                                  ? 'Anti-self-approval rule: submitter cannot approve own penalty'
                                  : 'Quick approve this penalty'
                              }
                              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              onClick={() => handleQuickApprove(pen)}
                            >
                              Approve
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPenalty(pen);
                              setModalOpen(true);
                            }}
                          >
                            Review
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ============================================================== */}
        {/* CARD 2: CREATING DIFFERENT TYPES OF PENALTIES & POLICIES TABLE */}
        {/* ============================================================== */}
        {!isMentor && (
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
            {/* Card 2 Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50/50 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-200/70 shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Penalty Policies & Deduction Types
                    </h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300/60">
                      {policies.length} Defined Policies
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create standardized penalty policies with policy IDs, titles, descriptions, and calculation types (Percent or Amount) saved to the database.
                  </p>
                </div>
              </div>
            </div>

            {/* Creation Form: Asks for ID, Title, Description, Type (Percent or Amount), and Value */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/60">
              <div className="max-w-4xl space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Create Penalty Policy
                  </h3>
                </div>

                {policyFormError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                    {policyFormError}
                  </div>
                )}
                {policySuccessMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    {policySuccessMsg}
                  </div>
                )}

                <form onSubmit={handleCreatePolicy} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {/* 1. Policy ID */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Policy ID / Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. POL-LATE-CANCEL"
                        value={policyId}
                        onChange={(e) => setPolicyId(e.target.value.toUpperCase())}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                      />
                    </div>

                    {/* 2. Policy Title */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Policy Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Late Class Cancellation"
                        value={policyTitle}
                        onChange={(e) => setPolicyTitle(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* 3. Type: Percent or Amount */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Deduction Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={policyType}
                        onChange={(e) => setPolicyType(e.target.value as PenaltyDeductionType)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="PERCENT">Percent (%)</option>
                        <option value="FIXED_AMOUNT">Amount ($)</option>
                      </select>
                    </div>

                    {/* 4. Rate / Value */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {policyType === 'PERCENT' ? 'Percentage Value (%)' : 'Amount Value ($ USD)'} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-bold">
                          {policyType === 'PERCENT' ? '%' : '$'}
                        </div>
                        <input
                          type="number"
                          step={policyType === 'PERCENT' ? '1' : '0.01'}
                          min="0"
                          max={policyType === 'PERCENT' ? '100' : undefined}
                          required
                          placeholder={policyType === 'PERCENT' ? 'e.g. 50' : 'e.g. 75.00'}
                          value={policyRate}
                          onChange={(e) => setPolicyRate(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Description & Save Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Description of policy violation, criteria, and operational rules (optional)..."
                        value={policyDescription}
                        onChange={(e) => setPolicyDescription(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      isLoading={isSavingPolicy}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Save Policy to Database
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* List / Table of All Defined Penalty Policies */}
            <div>
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Configured Penalty Policies ({policies.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  These policies appear in the violation category dropdown when submitting penalties.
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy ID</TableHead>
                    <TableHead>Policy Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Deduction Type</TableHead>
                    <TableHead>Standard Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <TableEmptyState
                          title="No Penalty Policies Configured"
                          description="Use the creation form above to register your first policy rule."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    policies.map((policy) => {
                      const isPercent = policy.deductionType === 'PERCENT';
                      const displayRate = isPercent
                        ? `${policy.rateValue ?? policy.defaultAmount ?? 0}%`
                        : formatCurrency(policy.rateValue ?? policy.defaultAmount ?? 0);

                      return (
                        <TableRow key={policy.id} className="hover:bg-slate-50/70">
                          <TableCell className="font-mono font-bold text-xs text-slate-900">
                            {policy.code || policy.id}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900 text-xs">
                            {policy.name}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 max-w-sm truncate" title={policy.description}>
                            {policy.description || 'No description provided'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isPercent ? 'purple' : 'neutral'} size="sm">
                              {isPercent ? 'Percent (%)' : 'Amount ($)'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-rose-600 font-mono">
                            {displayRate}
                          </TableCell>
                          <TableCell>
                            <Badge variant={policy.isActive ? 'success' : 'neutral'} size="sm" dot>
                              {policy.isActive ? 'Active' : 'Archived'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Edit Policy"
                                onClick={() => {
                                  setEditingPolicy(policy);
                                  setEditTitle(policy.name);
                                  setEditDescription(policy.description || '');
                                  setEditType(policy.deductionType || 'FIXED_AMOUNT');
                                  setEditRate(String(policy.rateValue ?? policy.defaultAmount ?? 0));
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Delete Policy"
                                onClick={() => setDeletingPolicy(policy)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Modal for Submitting New Penalty or Viewing Penalty Details */}
        <PenaltyModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          penaltyToView={selectedPenalty}
          onSaved={() => {
            refreshPenalties();
            void refreshPolicies();
          }}
        />

        {/* Modal for Editing Penalty Policy */}
        {editingPolicy && (
          <Modal
            isOpen={Boolean(editingPolicy)}
            onClose={() => setEditingPolicy(null)}
            title={`Edit Penalty Policy: ${editingPolicy.name}`}
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingPolicy(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isUpdatingPolicy}
                  onClick={handleUpdatePolicy}
                >
                  Save Policy Changes
                </Button>
              </div>
            }
          >
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Policy ID (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={editingPolicy.id}
                  className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Policy Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deduction Type *</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as PenaltyDeductionType)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="PERCENT">Percent (%)</option>
                    <option value="FIXED_AMOUNT">Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editType === 'PERCENT' ? 'Percentage Rate (%)' : 'Amount ($ USD)'} *
                  </label>
                  <input
                    type="number"
                    step={editType === 'PERCENT' ? '1' : '0.01'}
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Delete Confirmation Modal for Penalty Policy */}
        {deletingPolicy && (
          <DeleteConfirmModal
            isOpen={Boolean(deletingPolicy)}
            recordName={deletingPolicy.name}
            recordType="penalty policy"
            isDeleting={isDeletingPolicy}
            onConfirm={handleDeletePolicy}
            onClose={() => setDeletingPolicy(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
