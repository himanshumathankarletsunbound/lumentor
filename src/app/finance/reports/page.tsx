'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import { Download, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { formatCurrency, formatDuration } from '../../../lib/utils/formatters';

export default function PayrollReportsPage() {
  const batches = db.getPayrollBatches();
  const latestBatch = batches[0];

  const handleExportCSV = () => {
    if (!latestBatch) return;
    const headers = ['Mentor', 'Branch', 'Plan', 'Classes', 'Duration_Mins', 'Gross', 'Penalties', 'Net'];
    const rows = latestBatch.lineItems.map((item) => [
      `"${item.mentorName}"`,
      `"${item.branchName}"`,
      `"${item.planName}"`,
      item.eligibleClassesCount,
      item.eligibleDurationMinutes,
      item.grossEarnings,
      item.penaltyDeductions,
      item.netPayable,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payroll-report-${latestBatch.batchNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll Financial Reports</h1>
            <p className="text-xs text-slate-500 mt-1">
              Exportable audit spreadsheets, compensation aggregates, and historical breakdowns.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            Export Batch CSV
          </Button>
        </div>

        {latestBatch && (
          <Card>
            <CardHeader
              title={`Report Summary: ${latestBatch.batchNumber}`}
              subtitle={`${latestBatch.periodName} (${latestBatch.totalMentors} faculty members)`}
            />
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Eligible Volume</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestBatch.lineItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-semibold text-slate-900">{i.mentorName}</TableCell>
                      <TableCell className="text-xs text-slate-600">{i.branchName}</TableCell>
                      <TableCell className="text-xs text-slate-600">{i.compensationModel}</TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {i.eligibleClassesCount} classes ({formatDuration(i.eligibleDurationMinutes)})
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800">
                        {formatCurrency(i.grossEarnings)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-rose-600">
                        {i.penaltyDeductions > 0 ? `-${formatCurrency(i.penaltyDeductions)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-900 text-right">
                        {formatCurrency(i.netPayable)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
