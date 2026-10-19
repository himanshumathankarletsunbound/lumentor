'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { StatCard } from '../../../components/ui/StatCard';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DollarSign, Clock, CheckCircle2, ShieldAlert, ArrowRight, Plus } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';
import Link from 'next/link';

export default function PayrollDashboardPage() {
  const batches = db.getPayrollBatches();
  const plans = db.getPayrollPlans();
  const penalties = db.getPenalties();

  const totalDisbursed = batches
    .filter((b) => b.paymentStatus === 'PAID')
    .reduce((acc, b) => acc + b.totalNet, 0);

  const pendingApprovalCount = batches.filter(
    (b) => b.status === 'DRAFT' || b.status === 'SUBMITTED'
  ).length;

  const totalPenaltiesApplied = penalties
    .filter((p) => p.status === 'APPLIED')
    .reduce((acc, p) => acc + p.amount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll & Finance Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1">
              Multi-model compensation engine, cycle approvals, and disbursement management.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/finance/payroll-rules">
              <Button variant="outline" size="sm">
                Configure Plans
              </Button>
            </Link>
            <Link href="/finance/payroll-processing">
              <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                Process New Cycle
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Disbursed"
            value={formatCurrency(totalDisbursed)}
            icon={<DollarSign className="w-5 h-5" />}
            color="emerald"
            subtitle="Verified settlements"
          />
          <StatCard
            title="Batches Awaiting Review"
            value={pendingApprovalCount}
            icon={<Clock className="w-5 h-5" />}
            color="amber"
            subtitle="Pending admin approval"
          />
          <StatCard
            title="Configured Plans"
            value={plans.length}
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="indigo"
            subtitle="6 compensation models"
          />
          <StatCard
            title="Applied Deductions"
            value={formatCurrency(totalPenaltiesApplied)}
            icon={<ShieldAlert className="w-5 h-5" />}
            color="rose"
            subtitle="Authorized penalties"
          />
        </div>

        {/* Recent Batches */}
        <Card>
          <CardHeader
            title="Payroll Batches & Settlement History"
            subtitle="Bi-weekly and monthly mentor compensation cycles"
            action={
              <Link href="/finance/payroll-processing">
                <Button variant="outline" size="sm">
                  Run Calculations
                </Button>
              </Link>
            }
          />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Period & Cycle</TableHead>
                  <TableHead>Mentors / Volume</TableHead>
                  <TableHead>Gross Earnings</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Payable</TableHead>
                  <TableHead>Batch Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <TableEmptyState
                        title="No payroll calculation batches found"
                        description="Run your first compensation cycle calculation after synchronizing classes and mentors from Classcard."
                        action={
                          <Link href="/finance/payroll-processing">
                            <Button variant="primary" size="sm">
                              Process New Cycle
                            </Button>
                          </Link>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono font-bold text-slate-900">{b.batchNumber}</TableCell>
                      <TableCell className="text-xs text-slate-700">
                        <p className="font-semibold">{b.periodName}</p>
                        <p className="text-slate-400 text-[11px]">
                          {formatDate(b.startDate)} - {formatDate(b.endDate)}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {b.totalMentors} mentors ({b.totalEligibleClasses} classes)
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800">
                        {formatCurrency(b.totalGross, b.currency)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-rose-600">
                        -{formatCurrency(b.totalPenalties, b.currency)}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">
                        {formatCurrency(b.totalNet, b.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            b.status === 'LOCKED' || b.status === 'APPROVED'
                              ? 'success'
                              : b.status === 'SUBMITTED'
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                          dot
                        >
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.paymentStatus === 'PAID' ? 'success' : 'neutral'} size="sm">
                          {b.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href="/finance/payroll-processing">
                          <Button variant="outline" size="sm">
                            Inspect
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
