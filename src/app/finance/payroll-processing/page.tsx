'use client';

import React, { useState } from 'react';
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
import { Calculator, CheckCircle2, Lock, CreditCard, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDuration, formatDate } from '../../../lib/utils/formatters';
import { PayrollBatch, PayrollLineItem, Payslip } from '../../../lib/types/payroll';

export default function PayrollProcessingPage() {
  const { currentUser, isAdmin } = useAuth();
  const periods = db.getPayrollPeriods();
  const branches = db.getBranches();
  const batches = db.getPayrollBatches();

  // Active / Selected Batch
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || '');
  const activeBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];

  // Calculation parameters
  const [selectedPeriodId, setSelectedPeriodId] = useState(periods[1]?.id || periods[0]?.id || '');
  const [selectedBranchId, setSelectedBranchId] = useState('ALL');
  const [isCalculating, setIsCalculating] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCalculateNewBatch = () => {
    setIsCalculating(true);
    setNotification(null);
    try {
      const period = periods.find((p) => p.id === selectedPeriodId) || periods[0];
      const batch = payrollEngine.generateBatch({
        periodId: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
        branchId: selectedBranchId,
      });
      setSelectedBatchId(batch.id);
      setNotification({
        type: 'success',
        message: `Calculated new batch ${batch.batchNumber} with ${batch.totalMentors} mentors ($${batch.totalNet} total net).`,
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
      details: `Recorded disbursement of $${activeBatch.totalNet} with reference ${paymentRef}`,
    });

    setShowPaymentInput(false);
    setNotification({
      type: 'success',
      message: `Disbursement confirmed via ${paymentRef}. All payslips marked as PAID.`,
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll Processing Engine</h1>
            <p className="text-xs text-slate-500 mt-1">
              End-to-end calculation, review, administrative approval, batch locking, and payment confirmation.
            </p>
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
            subtitle="Select payroll period and target branch to evaluate session eligibility"
          />
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payroll Cycle *</label>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

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

              <div className="flex items-end">
                <Button
                  variant="primary"
                  className="w-full"
                  isLoading={isCalculating}
                  leftIcon={<Calculator className="w-4 h-4" />}
                  onClick={handleCalculateNewBatch}
                >
                  Calculate Payroll Batch
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Batch Review & Line Items */}
        {activeBatch && (
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
                        ? 'warning'
                        : 'neutral'
                    }
                    dot
                  >
                    {activeBatch.status}
                  </Badge>
                  <Badge variant={activeBatch.paymentStatus === 'PAID' ? 'success' : 'neutral'}>
                    Payment: {activeBatch.paymentStatus}
                  </Badge>
                </div>
              }
              subtitle={`${activeBatch.periodName} (${formatDate(activeBatch.startDate)} - ${formatDate(activeBatch.endDate)})`}
              action={
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Select other batch */}
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="text-xs p-1.5 border border-slate-200 rounded-lg bg-slate-50 font-medium"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} ({b.status})
                      </option>
                    ))}
                  </select>

                  {/* Actions according to workflow state */}
                  {activeBatch.status === 'DRAFT' && (
                    <Button variant="outline" size="sm" onClick={handleSubmitForApproval}>
                      Submit for Review
                    </Button>
                  )}

                  {isAdmin && activeBatch.status === 'SUBMITTED' && (
                    <Button
                      variant="success"
                      size="sm"
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
                      leftIcon={<Lock className="w-4 h-4" />}
                      onClick={handleLockBatch}
                    >
                      Lock & Generate Payslips
                    </Button>
                  )}

                  {isAdmin && activeBatch.status === 'LOCKED' && activeBatch.paymentStatus !== 'PAID' && (
                    <Button
                      variant="success"
                      size="sm"
                      leftIcon={<CreditCard className="w-4 h-4" />}
                      onClick={() => setShowPaymentInput(true)}
                    >
                      Record Disbursement
                    </Button>
                  )}
                </div>
              }
            />

            {/* Payment Input Form */}
            {showPaymentInput && (
              <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-emerald-950">Record Actual Disbursement</p>
                  <p className="text-emerald-800 text-[11px]">
                    Enter ACH, Wire, or Bank Transfer confirmation reference code to settle batch.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. ACH-BATCH-994208"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="p-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setShowPaymentInput(false)}>
                    Cancel
                  </Button>
                  <Button variant="success" size="sm" onClick={handleRecordPayment} disabled={!paymentRef.trim()}>
                    Confirm Payment
                  </Button>
                </div>
              </div>
            )}

            {/* Line Items Table */}
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Applied Plan (v)</TableHead>
                    <TableHead>Eligible Classes / Hrs</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Class & Dur. Pay</TableHead>
                    <TableHead>Bonuses</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Gross Earnings</TableHead>
                    <TableHead>Net Payable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeBatch.lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold text-slate-900">
                        <p>{item.mentorName}</p>
                        <p className="text-[11px] text-slate-400 font-normal">{item.branchName}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="purple" size="sm">
                          {item.planName} (v{item.planVersion})
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {item.eligibleClassesCount} classes ({formatDuration(item.eligibleDurationMinutes)})
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {item.baseSalaryAmount > 0 ? formatCurrency(item.baseSalaryAmount) : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {formatCurrency(item.classEarnings + item.durationEarnings + item.studentEarnings + item.revenueShareEarnings)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-emerald-600">
                        {item.bonusAmount > 0 ? `+${formatCurrency(item.bonusAmount)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-rose-600">
                        {item.penaltyDeductions > 0 ? `-${formatCurrency(item.penaltyDeductions)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-800">
                        {formatCurrency(item.grossEarnings)}
                      </TableCell>
                      <TableCell className="text-xs font-extrabold text-indigo-700">
                        {formatCurrency(item.netPayable)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <PayslipViewer
          isOpen={Boolean(selectedPayslip)}
          onClose={() => setSelectedPayslip(null)}
          payslip={selectedPayslip}
        />
      </div>
    </AppShell>
  );
}
