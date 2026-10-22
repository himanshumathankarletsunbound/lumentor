'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PayslipViewer } from '../../../components/payroll/PayslipViewer';
import { Payslip } from '../../../lib/types/payroll';
import { FileText, Printer, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';

export default function PayslipsPage() {
  const { isMentor, currentUser } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>(
    isMentor ? db.getPayslips(currentUser.mentorId) : db.getPayslips()
  );
  const [selectedSlip, setSelectedSlip] = useState<Payslip | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch(`/api/payslips${isMentor ? `?mentorId=${encodeURIComponent(currentUser.mentorId || '')}` : ''}`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load payslips.');
          setPayslips(result.payslips);
        })
        .catch((error: unknown) => console.error('Failed to load payslips from the database:', error));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUser.mentorId, isMentor]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mentor Payslips Directory</h1>
            <p className="text-xs text-slate-500 mt-1">
              Finalized, immutable monthly compensation records and payment confirmations.
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payslip Number</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead>Cycle & Period</TableHead>
              <TableHead>Applied Plan</TableHead>
              <TableHead>Eligible Classes</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Payable</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payslips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10}>
                  <TableEmptyState
                    title="No payslips generated yet"
                    description="Lock an approved payroll batch to generate official payslips."
                  />
                </TableCell>
              </TableRow>
            ) : (
              payslips.map((slip) => (
                <TableRow
                  key={slip.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedSlip(slip)}
                >
                  <TableCell className="font-mono font-bold text-slate-900">{slip.payslipNumber}</TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-800">{slip.mentorName}</p>
                    <p className="text-[11px] text-slate-400">{slip.branchName}</p>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{slip.periodName}</p>
                    <p className="text-slate-400 text-[11px]">
                      {formatDate(slip.startDate)} - {formatDate(slip.endDate)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="purple" size="sm">
                      {slip.planName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-slate-700">
                    {slip.eligibleClassesCount} classes
                  </TableCell>
                  <TableCell className="text-xs font-mono text-slate-700">
                    {formatCurrency(slip.grossEarnings, slip.currency)}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-rose-600">
                    {slip.totalDeductions > 0 ? `-${formatCurrency(slip.totalDeductions, slip.currency)}` : '-'}
                  </TableCell>
                  <TableCell className="text-xs font-extrabold text-indigo-700">
                    {formatCurrency(slip.netPayable, slip.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={slip.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm" dot>
                      {slip.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" leftIcon={<Printer className="w-3.5 h-3.5" />}>
                      Print / PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PayslipViewer
          isOpen={Boolean(selectedSlip)}
          onClose={() => setSelectedSlip(null)}
          payslip={selectedSlip}
        />
      </div>
    </AppShell>
  );
}
