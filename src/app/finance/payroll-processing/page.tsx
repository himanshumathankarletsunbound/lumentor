'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { payrollEngine } from '../../../lib/payroll/engine';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { PayslipViewer } from '../../../components/payroll/PayslipViewer';
import { ReconcileClassesModal } from '../../../components/payroll/ReconcileClassesModal';
import {
  Calculator,
  CheckCircle2,
  Lock,
  Unlock,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  CalendarClock,
  Sparkles,
  Snowflake,
  Send,
  Users,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { formatCurrency, formatDuration, formatDate } from '../../../lib/utils/formatters';
import { PayrollBatch, PayrollLineItem, Payslip, PayoutSchedule } from '../../../lib/types/payroll';
import { ClassEvent, Mentor } from '../../../lib/types/models';
import Link from 'next/link';

export default function PayrollProcessingPage() {
  const { currentUser, isAdmin } = useAuth();

  // Data from store
  const [schedules, setSchedules] = useState<PayoutSchedule[]>([]);
  const [branches, setBranches] = useState(db.getBranches());
  const [batches, setBatches] = useState<PayrollBatch[]>(db.getPayrollBatches());
  const [classes, setClasses] = useState<ClassEvent[]>(db.getClasses());
  const [mentors, setMentors] = useState<Mentor[]>(db.getMentors());

  // Active / Selected Batch
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || '');
  const activeBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];

  // Selection mode: 'SCHEDULE' vs 'CUSTOM'
  const [calculationMode, setCalculationMode] = useState<'SCHEDULE' | 'CUSTOM'>('SCHEDULE');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState('ALL');

  // Operational states
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const refreshData = () => {
    const freshSchedules = db.getPayoutSchedules();
    const freshClasses = db.getClasses();
    const freshBatches = db.getPayrollBatches();
    const freshMentors = db.getMentors();
    setSchedules(freshSchedules);
    setClasses(freshClasses);
    setBatches(freshBatches);
    setMentors(freshMentors);

    if (!selectedScheduleId && freshSchedules.length > 0) {
      setSelectedScheduleId(freshSchedules[0].id);
    }
  };

  useEffect(() => {
    refreshData();

    // Check query params safely on client
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qScheduleId = params.get('scheduleId');
      if (qScheduleId) {
        setSelectedScheduleId(qScheduleId);
        setCalculationMode('SCHEDULE');
      }
    }
  }, []);

  const activeSchedule = schedules.find((s) => s.id === selectedScheduleId) || schedules[0];

  // Compute effective date window
  const effectiveStartDate =
    calculationMode === 'SCHEDULE' && activeSchedule
      ? activeSchedule.startDate
      : customStartDate || '2026-10-01';

  const effectiveEndDate =
    calculationMode === 'SCHEDULE' && activeSchedule
      ? activeSchedule.endDate
      : customEndDate || '2026-10-31';

  // Target mentors
  const targetMentorIds =
    calculationMode === 'SCHEDULE' && activeSchedule?.assignedMentorIds?.length
      ? activeSchedule.assignedMentorIds
      : undefined;

  // Pre-flight check: Detect unmarked classes in the selected window
  const startObj = new Date(effectiveStartDate);
  const endObj = new Date(effectiveEndDate);

  const unmarkedClassesInPeriod = classes.filter((cls) => {
    if (selectedBranchId !== 'ALL' && cls.branchId !== selectedBranchId) return false;
    if (targetMentorIds && !targetMentorIds.includes(cls.mentorId)) return false;

    const cDate = new Date(cls.startTime);
    if (cDate < startObj || cDate > endObj) return false;

    return (
      cls.attendanceStatusSummary === 'UNMARKED' ||
      cls.status === 'SCHEDULED' ||
      cls.status === 'IN_PROGRESS'
    );
  });

  // Unique affected mentors
  const affectedMentorCounts = unmarkedClassesInPeriod.reduce((acc, cls) => {
    acc[cls.mentorName] = (acc[cls.mentorName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleQuickMarkAllPresent = () => {
    try {
      for (const cls of unmarkedClassesInPeriod) {
        const updatedStudents = cls.students.map((s) => ({
          ...s,
          attendanceStatus: 'PRESENT' as const,
          markedAt: new Date().toISOString(),
          markedBy: 'Bulk Pre-Flight Resolve',
        }));

        db.updateClass(cls.id, {
          students: updatedStudents,
          attendanceStatusSummary: 'ALL_PRESENT',
          status: 'COMPLETED',
        });
      }

      refreshData();
      setNotification({
        type: 'success',
        message: `Successfully marked ${unmarkedClassesInPeriod.length} class(es) as COMPLETED & PRESENT.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reconcile classes',
      });
    }
  };

  const handleSendAttendanceReminders = async () => {
    setIsSendingReminders(true);
    setNotification(null);
    try {
      const res = await fetch('/api/payroll/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: activeSchedule?.id,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          freezingDate: activeSchedule?.freezingDate || effectiveEndDate,
          payoutDate: activeSchedule?.payoutDate || 'Scheduled Payout',
          mentorIds: targetMentorIds,
          dispatchedBy: currentUser.name,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to dispatch reminders');

      setNotification({
        type: 'success',
        message: data.message || `Dispatched attendance reminders to faculty members.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error sending reminders',
      });
    } finally {
      setIsSendingReminders(false);
    }
  };

  const handleToggleFreezeSchedule = async () => {
    if (!activeSchedule) return;
    const isFrozen = activeSchedule.isFrozen;
    const action = isFrozen ? 'UNFREEZE' : 'FREEZE';

    try {
      const res = await fetch('/api/payroll/payout-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: activeSchedule.id, frozenBy: currentUser.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to toggle freeze');

      refreshData();
      setNotification({
        type: 'success',
        message: isFrozen
          ? `Schedule "${activeSchedule.name}" unlocked.`
          : `Schedule "${activeSchedule.name}" is now FROZEN. Past session records are secured.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to freeze schedule',
      });
    }
  };

  const handleCalculateNewBatch = () => {
    setIsCalculating(true);
    setNotification(null);
    try {
      const periodId = activeSchedule ? activeSchedule.id : `period-${Date.now()}`;
      const batch = payrollEngine.generateBatch({
        periodId,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        branchId: selectedBranchId,
        mentorIds: targetMentorIds,
      });

      refreshData();
      setSelectedBatchId(batch.id);
      setNotification({
        type: 'success',
        message: `Calculated new batch ${batch.batchNumber} with ${batch.totalMentors} mentors (${formatCurrency(batch.totalNet)} total net).`,
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmitForApproval = () => {
    if (!activeBatch) return;
    activeBatch.status = 'SUBMITTED';
    activeBatch.submittedBy = currentUser.id;
    activeBatch.submittedByName = currentUser.name;
    activeBatch.submittedAt = new Date().toISOString();
    activeBatch.updatedAt = new Date().toISOString();
    db.savePayrollBatch(activeBatch);

    db.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'PAYROLL_SUBMITTED',
      entityType: 'PayrollBatch',
      entityId: activeBatch.id,
      details: `Submitted batch ${activeBatch.batchNumber} for administrative review.`,
    });

    refreshData();
    setNotification({
      type: 'success',
      message: `Batch ${activeBatch.batchNumber} submitted for approval.`,
    });
  };

  const handleApproveBatch = () => {
    if (!activeBatch) return;
    activeBatch.status = 'APPROVED';
    activeBatch.approvedBy = currentUser.id;
    activeBatch.approvedByName = currentUser.name;
    activeBatch.approvedAt = new Date().toISOString();
    activeBatch.updatedAt = new Date().toISOString();
    db.savePayrollBatch(activeBatch);

    db.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: 'ADMINISTRATOR',
      action: 'PAYROLL_APPROVED',
      entityType: 'PayrollBatch',
      entityId: activeBatch.id,
      details: `Approved batch ${activeBatch.batchNumber} for disbursement.`,
    });

    refreshData();
    setNotification({
      type: 'success',
      message: `Batch ${activeBatch.batchNumber} approved! Ready to lock and generate payslips.`,
    });
  };

  const handleLockBatch = () => {
    if (!activeBatch) return;
    try {
      const generated = payrollEngine.finalizeBatchAndGeneratePayslips(
        activeBatch.id,
        currentUser.name
      );
      refreshData();
      setNotification({
        type: 'success',
        message: `Batch locked and ${generated.length} official payslips generated!`,
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleRecordPayment = () => {
    if (!activeBatch || !paymentRef.trim()) return;
    activeBatch.paymentStatus = 'PAID';
    activeBatch.paidAt = new Date().toISOString();
    activeBatch.paymentReference = paymentRef;
    activeBatch.updatedAt = new Date().toISOString();
    db.savePayrollBatch(activeBatch);

    // Update payslips
    const slips = db.getPayslips().filter((p) => p.batchId === activeBatch.id);
    for (const s of slips) {
      s.paymentStatus = 'PAID';
      s.paidAt = activeBatch.paidAt;
      s.paymentReference = paymentRef;
      db.savePayslip(s);
    }

    db.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: 'ADMINISTRATOR',
      action: 'PAYROLL_PAID',
      entityType: 'PayrollBatch',
      entityId: activeBatch.id,
      details: `Recorded disbursement of ${formatCurrency(activeBatch.totalNet)} with reference ${paymentRef}`,
    });

    setShowPaymentInput(false);
    refreshData();
    setNotification({
      type: 'success',
      message: `Disbursement confirmed via ${paymentRef}. All payslips marked as PAID.`,
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Link
            href="/finance/payroll-processing"
            className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-200 shadow-2xs flex items-center gap-1.5"
          >
            <Calculator className="w-3.5 h-3.5" />
            Process Payroll Batch
          </Link>
          <Link
            href="/finance/payout-schedules"
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Payout Schedules (3rd, 5th, 15th)
          </Link>
          <Link
            href="/finance/single-payout"
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-100 transition-colors"
          >
            Single Payout
          </Link>
          <Link
            href="/finance/payroll-rules"
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-100 transition-colors"
          >
            Payroll Rules & Plans
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll Processing Engine</h1>
            <p className="text-xs text-slate-500 mt-1">
              Execute batch calculations against defined payout schedules, review pre-flight attendance exceptions, approve disbursements, and lock historical records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/finance/payout-schedules">
              <Button variant="outline" size="sm" leftIcon={<CalendarClock className="w-4 h-4" />}>
                Manage Payout Schedules
              </Button>
            </Link>
          </div>
        </div>

        {notification && (
          <Alert
            type={notification.type}
            title={notification.type === 'success' ? 'Success' : 'Error'}
            message={notification.message}
          />
        )}

        {/* Step 1: Batch Calculation Controls */}
        <Card className="border-indigo-100">
          <CardHeader
            title="1. Initiate Compensation Calculation"
            subtitle="Select a payout schedule cohort (3rd, 5th, 15th) or custom dates to evaluate session eligibility"
          />
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Payout Schedule Selector */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Payout Schedule Cohort *</label>
                  <Link
                    href="/finance/payout-schedules"
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    Configure <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {schedules.length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center justify-between">
                    <span>No schedules found.</span>
                    <Link
                      href="/finance/payout-schedules"
                      className="font-bold underline hover:text-amber-950"
                    >
                      Create Standard Schedules →
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedScheduleId}
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Day {s.payoutDay}) — {formatDate(s.startDate)} to {formatDate(s.endDate)}
                        {s.isFrozen ? ' [FROZEN]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Branch Filter */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Campus Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="ALL">All Campus Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Calculate Button */}
              <div className="flex items-end">
                <Button
                  variant="primary"
                  className="w-full"
                  isLoading={isCalculating}
                  leftIcon={<Calculator className="w-4 h-4" />}
                  onClick={handleCalculateNewBatch}
                >
                  Calculate Batch
                </Button>
              </div>
            </div>

            {/* Schedule Details Strip */}
            {activeSchedule && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Session Evaluation Range
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatDate(activeSchedule.startDate)} → {formatDate(activeSchedule.endDate)}
                    </span>
                  </div>

                  <div className="border-l border-slate-200 pl-4">
                    <span className="text-sky-600 block text-[10px] uppercase font-semibold flex items-center gap-1">
                      <Snowflake className="w-3 h-3" /> Freezing Cutoff Date
                    </span>
                    <span className="font-bold text-sky-900">
                      {formatDate(activeSchedule.freezingDate)}
                    </span>
                  </div>

                  <div className="border-l border-slate-200 pl-4">
                    <span className="text-emerald-600 block text-[10px] uppercase font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Scheduled Payout Date
                    </span>
                    <span className="font-bold text-emerald-900">
                      {formatDate(activeSchedule.payoutDate)} ({activeSchedule.payoutDay}th)
                    </span>
                  </div>

                  <div className="border-l border-slate-200 pl-4">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Assigned Mentors
                    </span>
                    <span className="font-bold text-slate-800">
                      {activeSchedule.assignedMentorIds?.length || 'All Eligible'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeSchedule.isFrozen ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" size="sm">
                        ❄️ Cycle Frozen ({activeSchedule.frozenBy || 'Admin'})
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        leftIcon={<Unlock className="w-3 h-3" />}
                        onClick={handleToggleFreezeSchedule}
                      >
                        Unfreeze
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-sky-700 border-sky-300 hover:bg-sky-50"
                      leftIcon={<Snowflake className="w-3 h-3" />}
                      onClick={handleToggleFreezeSchedule}
                      title="Lock classes and attendance records from further edits"
                    >
                      Freeze Cycle Now
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PRE-FLIGHT UNMARKED CLASSES GUARD */}
        {unmarkedClassesInPeriod.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-amber-50 via-amber-50/70 to-amber-100/50 border border-amber-300 rounded-2xl shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    Pre-Flight Guard: {unmarkedClassesInPeriod.length} Unmarked Class Session{unmarkedClassesInPeriod.length === 1 ? '' : 'es'} Detected
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5 max-w-2xl leading-relaxed">
                    Classes with unverified attendance are <strong>excluded</strong> from payout calculation. The faculty members below will not receive compensation for these sessions unless attendance is resolved before calculating the batch.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-xs"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={handleQuickMarkAllPresent}
                >
                  Quick-Mark All Present
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-amber-300 text-amber-900 text-xs hover:bg-amber-100"
                  onClick={() => setReconcileModalOpen(true)}
                >
                  Review & Reconcile ({unmarkedClassesInPeriod.length})
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isSendingReminders}
                  className="bg-white border-slate-300 text-slate-700 text-xs hover:bg-slate-50"
                  leftIcon={<Send className="w-3.5 h-3.5 text-indigo-600" />}
                  onClick={handleSendAttendanceReminders}
                >
                  Send Reminders to Faculty
                </Button>
              </div>
            </div>

            {/* Affected Mentors Breakdown Pills */}
            <div className="pt-2 border-t border-amber-200/70 flex items-center gap-2 flex-wrap text-[11px] text-amber-900">
              <span className="font-semibold text-amber-950">Affected Faculty:</span>
              {Object.entries(affectedMentorCounts).map(([name, count]) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-amber-300 font-medium"
                >
                  <span>{name}:</span>
                  <strong className="text-amber-950 font-bold">{count} session{count === 1 ? '' : 's'}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Batch Review & Line Items */}
        {activeBatch ? (
          <Card>
            <CardHeader
              title={
                <div className="flex items-center gap-2 flex-wrap">
                  <span>Batch {activeBatch.batchNumber}</span>
                  <Badge
                    variant={
                      activeBatch.status === 'LOCKED' || activeBatch.status === 'APPROVED'
                        ? 'success'
                        : activeBatch.status === 'SUBMITTED'
                        ? 'purple'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {activeBatch.status}
                  </Badge>
                  <span className="text-xs text-slate-400 font-normal">
                    {formatDate(activeBatch.startDate)} to {formatDate(activeBatch.endDate)}
                  </span>
                </div>
              }
              subtitle={`Total Disbursement: ${formatCurrency(activeBatch.totalNet)} across ${activeBatch.totalMentors} faculty member(s)`}
              action={
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Select other existing batch */}
                  {batches.length > 1 && (
                    <select
                      value={selectedBatchId}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} ({b.status}) - {formatCurrency(b.totalNet)}
                        </option>
                      ))}
                    </select>
                  )}

                  {activeBatch.status === 'DRAFT' && (
                    <Button variant="outline" size="sm" onClick={handleSubmitForApproval}>
                      Submit for Approval
                    </Button>
                  )}

                  {isAdmin && activeBatch.status === 'SUBMITTED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      leftIcon={<ShieldCheck className="w-4 h-4" />}
                      onClick={handleApproveBatch}
                    >
                      Approve Batch
                    </Button>
                  )}

                  {isAdmin && activeBatch.status === 'APPROVED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      leftIcon={<Lock className="w-4 h-4" />}
                      onClick={handleLockBatch}
                    >
                      Lock Batch & Generate Payslips
                    </Button>
                  )}

                  {isAdmin && activeBatch.status === 'LOCKED' && activeBatch.paymentStatus !== 'PAID' && (
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<CreditCard className="w-4 h-4 text-emerald-600" />}
                      onClick={() => setShowPaymentInput(true)}
                    >
                      Record Disbursement
                    </Button>
                  )}
                </div>
              }
            />

            <CardContent className="space-y-4">
              {/* Payment input popover */}
              {showPaymentInput && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs">
                  <span className="font-semibold text-emerald-900">Payment Reference:</span>
                  <input
                    type="text"
                    placeholder="e.g. UTR-982341234 or HDFC-NEFT-01"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="p-1.5 bg-white border border-emerald-300 rounded-lg flex-1 outline-none text-xs"
                  />
                  <Button size="sm" variant="primary" onClick={handleRecordPayment}>
                    Confirm Paid
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowPaymentInput(false)}>
                    Cancel
                  </Button>
                </div>
              )}

              {/* Line items table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mentor</TableHead>
                      <TableHead>Compensation Model</TableHead>
                      <TableHead>Eligible Sessions</TableHead>
                      <TableHead>Gross Earnings</TableHead>
                      <TableHead>Penalties</TableHead>
                      <TableHead>Bonuses</TableHead>
                      <TableHead>Net Payable</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeBatch.lineItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-semibold text-slate-900">
                          <div>
                            <p>{item.mentorName}</p>
                            <p className="text-[10px] text-slate-400 font-normal">{item.mentorEmail}</p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="purple" size="sm">
                            {item.compensationModel}
                          </Badge>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{item.planName}</span>
                        </TableCell>

                        <TableCell className="text-xs">
                          {item.eligibleClassesCount} session{item.eligibleClassesCount === 1 ? '' : 's'} (
                          {formatDuration(item.eligibleDurationMinutes)})
                        </TableCell>

                        <TableCell className="text-xs font-semibold text-slate-800">
                          {formatCurrency(item.grossEarnings)}
                        </TableCell>

                        <TableCell className="text-xs">
                          {item.penaltyDeductions > 0 ? (
                            <span className="text-rose-600 font-bold">
                              -{formatCurrency(item.penaltyDeductions)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs">
                          {item.bonusAmount > 0 ? (
                            <span className="text-emerald-600 font-bold">
                              +{formatCurrency(item.bonusAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-sm font-bold text-slate-900">
                          {formatCurrency(item.netPayable)}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                            onClick={() => {
                              const slip = db.getPayslips().find((p) => p.mentorId === item.mentorId);
                              if (slip) setSelectedPayslip(slip);
                              else {
                                setNotification({
                                  type: 'error',
                                  message: 'Official payslip will be available once batch is locked.',
                                });
                              }
                            }}
                          >
                            View Payslip
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">No Active Payroll Batch</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Select a payout schedule cohort (3rd, 5th, or 15th) above and click <strong>Calculate Batch</strong> to evaluate session eligibility and compute compensation.
            </p>
          </Card>
        )}

        {/* Payslip Viewer Modal */}
        {selectedPayslip && (
          <PayslipViewer isOpen={Boolean(selectedPayslip)} payslip={selectedPayslip} onClose={() => setSelectedPayslip(null)} />
        )}

        {/* Reconcile Classes Modal */}
        <ReconcileClassesModal
          isOpen={reconcileModalOpen}
          onClose={() => setReconcileModalOpen(false)}
          unmarkedClasses={unmarkedClassesInPeriod}
          onReconciled={refreshData}
        />
      </div>
    </AppShell>
  );
}
