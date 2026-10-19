'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { StatCard } from '../../../components/ui/StatCard';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { BarChart } from '../../../components/charts/BarChart';
import { DonutChart } from '../../../components/charts/DonutChart';
import { DollarSign, TrendingUp, Calculator, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils/formatters';

export default function PayrollAnalyticsPage() {
  const batches = db.getPayrollBatches();
  const totalNet = batches.reduce((acc, b) => acc + b.totalNet, 0);
  const totalGross = batches.reduce((acc, b) => acc + b.totalGross, 0);
  const totalPenalties = batches.reduce((acc, b) => acc + b.totalPenalties, 0);
  const totalBonuses = batches.reduce((acc, b) => acc + b.totalAdjustments, 0);

  const spendByPeriod = [
    { label: 'Sep Cycle 1', value: 5800, valueLabel: '$5,800' },
    { label: 'Sep Cycle 2', value: 6100, valueLabel: '$6,100' },
    { label: 'Oct Cycle 1', value: 6345, valueLabel: '$6,345' },
    { label: 'Oct Cycle 2 (Proj)', value: 6600, valueLabel: '$6,600' },
  ];

  const costBreakdown = [
    { label: 'Base Salaries', value: 42, color: '#4f46e5' },
    { label: 'Class / Hourly Pay', value: 46, color: '#0284c7' },
    { label: 'Bonuses & Incentives', value: 8, color: '#10b981' },
    { label: 'Deductions (Offset)', value: 4, color: '#f43f5e' },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll & Financial Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Faculty expenditure trends, component breakdown, and cost-per-class optimization.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Payroll Spend"
            value={formatCurrency(totalNet)}
            icon={<DollarSign className="w-5 h-5" />}
            color="emerald"
            trend={{ value: '3.8%', isPositive: true }}
          />
          <StatCard
            title="Gross Earnings"
            value={formatCurrency(totalGross)}
            icon={<TrendingUp className="w-5 h-5" />}
            color="indigo"
            subtitle="Pre-deduction volume"
          />
          <StatCard
            title="Penalties Deducted"
            value={formatCurrency(totalPenalties)}
            icon={<Calculator className="w-5 h-5" />}
            color="rose"
            subtitle="Applied policy offsets"
          />
          <StatCard
            title="Approved Bonuses"
            value={formatCurrency(totalBonuses)}
            icon={<ShieldCheck className="w-5 h-5" />}
            color="sky"
            subtitle="Retention & merit bonuses"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader
              title="Payroll Expenditure by Cycle"
              subtitle="Net disbursed compensation progression"
            />
            <CardContent>
              <BarChart items={spendByPeriod} height={200} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Compensation Component Distribution"
              subtitle="Base vs variable class earnings"
            />
            <CardContent>
              <DonutChart
                segments={costBreakdown}
                centerLabel="Total Net"
                centerValue={formatCurrency(totalNet)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
