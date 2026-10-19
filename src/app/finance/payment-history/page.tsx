'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';

export default function PaymentHistoryPage() {
  const batches = db.getPayrollBatches().filter((b) => b.paymentStatus === 'PAID');

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment & Disbursement History</h1>
          <p className="text-xs text-slate-500 mt-1">
            Confirmed bank transfers, ACH clearing reference logs, and settled mentor payments.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment Reference</TableHead>
              <TableHead>Batch Number</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Recipient Count</TableHead>
              <TableHead>Total Net Disbursed</TableHead>
              <TableHead>Settlement Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono font-bold text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>{b.paymentReference || 'ACH-DIRECT-SETTLED'}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-700">{b.batchNumber}</TableCell>
                <TableCell className="text-xs text-slate-700">{b.periodName}</TableCell>
                <TableCell className="text-xs text-slate-700 font-semibold">{b.totalMentors} mentors</TableCell>
                <TableCell className="text-xs font-extrabold text-slate-900">
                  {formatCurrency(b.totalNet, b.currency)}
                </TableCell>
                <TableCell className="text-xs text-slate-600">{formatDate(b.paidAt)}</TableCell>
                <TableCell>
                  <Badge variant="success" size="sm" dot>
                    Settled
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
