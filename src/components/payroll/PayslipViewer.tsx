'use client';

import React from 'react';
import { Payslip } from '../../lib/types/payroll';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Printer, Download, CheckCircle, Clock } from 'lucide-react';
import { formatCurrency, formatDuration, formatDate } from '../../lib/utils/formatters';

export function PayslipViewer({
  isOpen,
  onClose,
  payslip,
}: {
  isOpen: boolean;
  onClose: () => void;
  payslip: Payslip | null;
}) {
  if (!payslip) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title="Official Mentor Payslip"
      subtitle={`Document Reference: ${payslip.payslipNumber}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <Badge variant={payslip.paymentStatus === 'PAID' ? 'success' : 'warning'} dot>
            {payslip.paymentStatus === 'PAID' ? 'Payment Settled' : 'Payment Processing'}
          </Badge>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
            >
              Print / Save PDF
            </Button>
          </div>
        </div>
      }
    >
      <div id="printable-payslip" className="space-y-6 text-slate-800 p-2 sm:p-4">
        {/* Company Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Apex Academy & Mentorship</h2>
            <p className="text-xs text-slate-500 mt-0.5">Educational Services & Scheduling Management System</p>
            <p className="text-xs text-slate-400 mt-1">Branch Campus: {payslip.branchName}</p>
          </div>
          <div className="sm:text-right text-xs space-y-1">
            <p className="font-semibold text-slate-800 text-sm">{payslip.payslipNumber}</p>
            <p className="text-slate-500">Issued: {formatDate(payslip.generatedAt)}</p>
            {payslip.paymentReference && (
              <p className="text-emerald-700 font-mono text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                Ref: {payslip.paymentReference}
              </p>
            )}
          </div>
        </div>

        {/* Mentor & Period Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <p className="font-bold text-slate-900 text-sm">{payslip.mentorName}</p>
            <p className="text-slate-500">{payslip.mentorEmail}</p>
            <p className="text-slate-600 mt-2 font-medium">
              Applied Plan: <span className="text-indigo-600">{payslip.planName} (v{payslip.planVersion})</span>
            </p>
            <p className="text-slate-400 text-[11px]">Model: {payslip.compensationModel}</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <p className="text-slate-500 font-medium">Payroll Cycle</p>
            <p className="font-bold text-slate-900 text-sm">{payslip.periodName}</p>
            <p className="text-slate-600">
              Period: {formatDate(payslip.startDate)} - {formatDate(payslip.endDate)}
            </p>
            <p className="text-slate-500 mt-1">
              Eligible Volume: <strong>{payslip.eligibleClassesCount} classes</strong> ({formatDuration(payslip.eligibleDurationMinutes)})
            </p>
          </div>
        </div>

        {/* Earnings Table */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Earnings Breakdown</h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Component Description</th>
                  <th className="px-4 py-2.5 text-center">Volume / Hours</th>
                  <th className="px-4 py-2.5 text-right">Rate</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payslip.earningsItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{item.description}</td>
                    <td className="px-4 py-2.5 text-center text-slate-500">{item.quantity || '-'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {item.rate ? formatCurrency(item.rate, payslip.currency) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                      {formatCurrency(item.amount, payslip.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-slate-700 text-right">
                    Gross Earnings
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-900">
                    {formatCurrency(payslip.grossEarnings, payslip.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Penalties & Deductions Table */}
        {payslip.penaltyItems.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">
              Itemized Penalties & Authorized Deductions
            </h4>
            <div className="border border-rose-200 rounded-xl overflow-hidden bg-rose-50/30">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-100/60 border-b border-rose-200 text-rose-900 font-semibold">
                  <tr>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Specific Reason / Policy Incident</th>
                    <th className="px-4 py-2 text-right">Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100">
                  {payslip.penaltyItems.map((pen, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 font-medium text-rose-800">{pen.category}</td>
                      <td className="px-4 py-2 text-slate-600">{pen.reason}</td>
                      <td className="px-4 py-2 text-right font-bold text-rose-700">
                        -{formatCurrency(pen.amount, payslip.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-rose-100/40 border-t border-rose-200 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-rose-900 text-right">
                      Total Authorized Deductions
                    </td>
                    <td className="px-4 py-2 text-right text-rose-700">
                      -{formatCurrency(payslip.totalDeductions, payslip.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Net Payable Summary Card */}
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-indigo-900">Net Payable Amount</p>
            <p className="text-xs text-indigo-700 mt-0.5">
              Gross Earnings ({formatCurrency(payslip.grossEarnings, payslip.currency)}) − Deductions ({formatCurrency(payslip.totalDeductions, payslip.currency)})
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-indigo-900">
              {formatCurrency(payslip.netPayable, payslip.currency)}
            </span>
          </div>
        </div>

        {/* Footer Audit Note */}
        <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3 text-center">
          Generated automatically by Apex Educational Management System • Immutable calculation snapshot.
        </div>
      </div>
    </Modal>
  );
}
