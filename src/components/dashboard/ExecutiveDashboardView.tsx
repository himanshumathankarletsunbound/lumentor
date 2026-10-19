'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { db } from '../../lib/db/store';
import { StatCard } from '../ui/StatCard';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { BarChart } from '../charts/BarChart';
import { DonutChart } from '../charts/DonutChart';
import { CalendarEventModal } from '../calendar/CalendarEventModal';
import { PayslipViewer } from '../payroll/PayslipViewer';
import {
  Users,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  Percent,
  AlertTriangle,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Building2,
  FileText,
} from 'lucide-react';
import { formatCurrency, formatDate, formatTime, formatPercentage } from '../../lib/utils/formatters';
import Link from 'next/link';
import { ClassEvent } from '../../lib/types/models';
import { Payslip } from '../../lib/types/payroll';

export function ExecutiveDashboardView() {
  const { selectedBranch, currentUser } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const branches = db.getBranches();
  const mentors = db.getMentors(selectedBranch);
  const students = db.getStudents(selectedBranch);
  const classes = db.getClasses({ branchId: selectedBranch });
  const penalties = db.getPenalties();
  const batches = db.getPayrollBatches();
  const syncJobs = db.getSyncJobs();
  const auditLogs = db.getAuditLogs(5);
  const payslips = db.getPayslips();

  // Metrics calculation
  const totalStudents = students.length;
  const activeMentors = mentors.filter((m) => m.status === 'ACTIVE').length;
  const totalClasses = classes.length;
  const completedClasses = classes.filter((c) => c.status === 'COMPLETED').length;
  const pendingClasses = classes.filter((c) => c.status === 'SCHEDULED').length;
  const cancelledClasses = classes.filter((c) => c.status === 'CANCELLED' || c.status === 'LATE_CANCELLED').length;
  const lateCancelledClasses = classes.filter((c) => c.status === 'LATE_CANCELLED').length;
  const unmarkedClasses = classes.filter((c) => c.attendanceStatusSummary === 'UNMARKED').length;

  const attendanceRate = totalClasses > 0 ? (completedClasses / totalClasses) * 100 : 96.5;
  const cancellationRate = totalClasses > 0 ? (cancelledClasses / totalClasses) * 100 : 3.5;

  const totalPayrollExpenditure = batches.reduce((acc, b) => acc + b.totalNet, 0);
  const pendingBatches = batches.filter((b) => b.status === 'SUBMITTED' || b.status === 'DRAFT').length;
  const openExceptions = unmarkedClasses + penalties.filter((p) => p.status === 'SUBMITTED').length;

  // Visual Chart Data
  const branchVolumeData = useMemo(() => {
    return branches.map((b) => {
      const count = classes.filter((c) => c.branchId === b.id).length;
      return {
        label: b.code,
        value: count,
        valueLabel: `${count} classes`,
        color: b.id === 'branch-nyc' ? 'bg-indigo-600' : b.id === 'branch-sf' ? 'bg-sky-500' : 'bg-purple-500',
      };
    });
  }, [branches, classes]);

  const compensationSegments = useMemo(() => {
    return [
      { label: 'Hybrid Plan (Base + Bonus)', value: 45, color: '#4f46e5' },
      { label: 'Per-Class Standard', value: 25, color: '#0284c7' },
      { label: 'Duration Hourly ($50/hr)', value: 15, color: '#10b981' },
      { label: 'Per-Student Group', value: 10, color: '#8b5cf6' },
      { label: 'Fixed Salary / Rev Share', value: 5, color: '#f59e0b' },
    ];
  }, []);

  const upcomingClasses = classes
    .filter((c) => c.status === 'SCHEDULED')
    .slice(0, 4);

  const pendingPenalties = penalties
    .filter((p) => p.status === 'SUBMITTED')
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time operations, attendance compliance, and mentor payroll analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="purple" size="md">
            Data Source: Classcard v2 Sync
          </Badge>
          <Link href="/operations/calendar">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Open Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="Total Students"
          value={totalStudents}
          icon={<Users className="w-5 h-5" />}
          color="indigo"
          subtitle="Enrolled active students"
        />
        <StatCard
          title="Active Mentors"
          value={activeMentors}
          icon={<GraduationCap className="w-5 h-5" />}
          color="sky"
          subtitle="Assigned across branches"
        />
        <StatCard
          title="Scheduled Classes"
          value={totalClasses}
          icon={<Calendar className="w-5 h-5" />}
          color="indigo"
          subtitle={`${pendingClasses} upcoming sessions`}
        />
        <StatCard
          title="Attendance Rate"
          value={formatPercentage(attendanceRate)}
          icon={<Percent className="w-5 h-5" />}
          color="emerald"
          trend={{ value: '1.2%', isPositive: true, label: 'vs last cycle' }}
        />
        <StatCard
          title="Cancellation Rate"
          value={formatPercentage(cancellationRate)}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={cancellationRate > 5 ? 'rose' : 'amber'}
          subtitle={`${lateCancelledClasses} late cancellations`}
        />
      </div>

      {/* Secondary Financial & Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          title="Total Mentor Payroll"
          value={formatCurrency(totalPayrollExpenditure)}
          icon={<DollarSign className="w-5 h-5" />}
          color="emerald"
          subtitle="Settled & approved batches"
        />
        <StatCard
          title="Pending Payroll Approvals"
          value={pendingBatches}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          subtitle="Batches awaiting review"
        />
        <StatCard
          title="Outstanding Exceptions"
          value={openExceptions}
          icon={<ShieldAlert className="w-5 h-5" />}
          color="rose"
          subtitle={`${unmarkedClasses} unmarked classes`}
        />
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch-wise Class Volume */}
        <Card>
          <CardHeader
            title="Branch Class Distribution"
            subtitle="Operational volume breakdown across campus locations"
            action={
              <Link href="/analytics/branch-performance" className="text-xs text-indigo-600 hover:underline">
                View Report
              </Link>
            }
          />
          <CardContent>
            <BarChart items={branchVolumeData} height={190} />
          </CardContent>
        </Card>

        {/* Payroll Split by Compensation Model */}
        <Card>
          <CardHeader
            title="Payroll Split by Model"
            subtitle="Compensation model distribution across active faculty"
            action={
              <Link href="/finance/payroll-rules" className="text-xs text-indigo-600 hover:underline">
                Manage Plans
              </Link>
            }
          />
          <CardContent>
            <DonutChart
              segments={compensationSegments}
              centerLabel="Plans"
              centerValue="6 Active"
            />
          </CardContent>
        </Card>
      </div>

      {/* Operational Highlights and Exception Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Classes */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Upcoming Scheduled Sessions"
            subtitle="Next classes awaiting mentor check-in"
            action={
              <Link href="/operations/classes" className="text-xs text-indigo-600 hover:underline">
                All Classes
              </Link>
            }
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {upcomingClasses.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No upcoming classes scheduled today.
                </div>
              ) : (
                upcomingClasses.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-4 hover:bg-slate-50/70 transition-colors cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-xs sm:text-sm">{cls.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatTime(cls.startTime)} • {cls.mentorName} • {cls.branchName}
                      </p>
                    </div>
                    <Badge variant="info" size="sm" dot>
                      Scheduled
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attention Items: Penalties & Unmarked Attendance */}
        <Card>
          <CardHeader
            title="Action Items"
            subtitle="Items requiring administrative review"
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {pendingPenalties.map((pen) => (
                <div key={pen.id} className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{pen.mentorName}</span>
                    <Badge variant="warning" size="sm">
                      Pending Review
                    </Badge>
                  </div>
                  <p className="text-slate-500 truncate">{pen.reason}</p>
                  <p className="text-rose-600 font-bold">{formatCurrency(pen.amount)}</p>
                </div>
              ))}

              {unmarkedClasses > 0 && (
                <div className="p-3.5 bg-amber-50/60 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-amber-900">
                      {unmarkedClasses} Past Class{unmarkedClasses === 1 ? '' : 'es'} Unmarked
                    </p>
                    <p className="text-[11px] text-amber-700">Attendance documentation overdue</p>
                  </div>
                  <Link href="/operations/attendance">
                    <Button variant="outline" size="sm" className="bg-white">
                      Review
                    </Button>
                  </Link>
                </div>
              )}

              {/* Sync Health Status */}
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-slate-800">Classcard Gateway</p>
                    <p className="text-[11px] text-slate-400">
                      {syncJobs[0]?.status === 'COMPLETED' ? 'All sync services operational' : 'Sync pending'}
                    </p>
                  </div>
                </div>
                <Badge variant="success" size="sm" dot>
                  Healthy
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Audit Events Trail */}
      <Card>
        <CardHeader
          title="Recent System Audit Log"
          subtitle="Verifiable timeline of sensitive approvals, syncs, and adjustments"
          action={
            <Link href="/admin/audit-logs" className="text-xs text-indigo-600 hover:underline">
              Full Audit Trail
            </Link>
          }
        />
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {log.action}
                    </Badge>
                    <span className="font-semibold text-slate-800">{log.userName}</span>
                  </div>
                  <p className="text-slate-600">{log.details}</p>
                </div>
                <span className="text-slate-400 text-[11px] whitespace-nowrap">
                  {formatDate(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Class Modal & Payslip Modal */}
      <CalendarEventModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        classEvent={selectedEvent}
        onSave={(updated) => {
          db.updateClass(updated.id, updated);
          setSelectedEvent(null);
        }}
      />

      <PayslipViewer
        isOpen={Boolean(selectedPayslip)}
        onClose={() => setSelectedPayslip(null)}
        payslip={selectedPayslip}
      />
    </div>
  );
}
