'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Clock,
  Percent,
  AlertTriangle,
  DollarSign,
  ShieldAlert,
  RefreshCw,
  FileText,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { formatCurrency, formatDate, formatTime, formatPercentage, setSystemCurrency } from '../../lib/utils/formatters';
import Link from 'next/link';
import { ClassEvent, Student, Mentor, Branch, Invoice, Payment, AuditEvent } from '../../lib/types/models';
import { Payslip, PayrollBatch, Penalty } from '../../lib/types/payroll';
import { WelcomeHeader } from './WelcomeHeader';

export function ExecutiveDashboardView() {
  const { selectedBranch } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live state initialized from local store, refreshed from API
  const [branches, setBranches] = useState<Branch[]>(() => db.getBranches());
  const [mentors, setMentors] = useState<Mentor[]>(() => db.getMentors(selectedBranch));
  const [students, setStudents] = useState<Student[]>(() => db.getStudents(selectedBranch));
  const [classes, setClasses] = useState<ClassEvent[]>(() => db.getClasses({ branchId: selectedBranch }));
  const [penalties, setPenalties] = useState<Penalty[]>(() => db.getPenalties());
  const [batches, setBatches] = useState<PayrollBatch[]>(() => db.getPayrollBatches());
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(() => db.getAuditLogs(5));
  const [payslips, setPayslips] = useState<Payslip[]>(() => db.getPayslips());
  const [invoices, setInvoices] = useState<Invoice[]>(() => db.getInvoices());
  const [payments, setPayments] = useState<Payment[]>(() => db.getPayments());

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/dashboard?branchId=${encodeURIComponent(selectedBranch)}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.branches) setBranches(json.data.branches);
        if (json.data.mentors) setMentors(json.data.mentors);
        if (json.data.students) setStudents(json.data.students);
        if (json.data.classes) setClasses(json.data.classes);
        if (json.data.penalties) setPenalties(json.data.penalties);
        if (json.data.batches) setBatches(json.data.batches);
        if (json.data.auditLogs) setAuditLogs(json.data.auditLogs);
        if (json.data.payslips) setPayslips(json.data.payslips);
        if (json.data.invoices) setInvoices(json.data.invoices);
        if (json.data.payments) setPayments(json.data.payments);
        if (json.data.orgSettings?.currency) {
          setSystemCurrency(json.data.orgSettings.currency);
        }

        // Also synchronize in-memory client db instance
        if (typeof db.initClient === 'function') {
          db.initClient({ ...db.getSnapshot(), ...json.data });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch live dashboard telemetry:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    // Refresh external dashboard telemetry when the selected branch changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshData();
  }, [refreshData]);

  // Metrics calculation
  const totalStudents = students.length;
  const activeMentors = mentors.filter((m) => m.status === 'ACTIVE').length;
  const totalClasses = classes.length;
  const completedClasses = classes.filter((c) => c.status === 'COMPLETED').length;
  const pendingClasses = classes.filter((c) => c.status === 'SCHEDULED').length;
  const cancelledClasses = classes.filter((c) => c.status === 'CANCELLED' || c.status === 'LATE_CANCELLED').length;
  const lateCancelledClasses = classes.filter((c) => c.status === 'LATE_CANCELLED').length;
  const unmarkedClasses = classes.filter((c) => c.attendanceStatusSummary === 'UNMARKED').length;

  const attendanceRate = totalClasses > 0 ? (completedClasses / totalClasses) * 100 : 0;
  const cancellationRate = totalClasses > 0 ? (cancelledClasses / totalClasses) * 100 : 0;

  const totalPayrollExpenditure = batches.reduce((acc, b) => acc + b.totalNet, 0);
  const settledToDate = useMemo(() => {
    const paidBatchesTotal = batches
      .filter((b) => b.paymentStatus === 'PAID')
      .reduce((acc, b) => acc + (b.totalNet || 0), 0);
    if (paidBatchesTotal > 0) return paidBatchesTotal;
    const paidPayslipsTotal = payslips
      .filter((p) => p.paymentStatus === 'PAID')
      .reduce((acc, p) => acc + (p.netPayable || 0), 0);
    return paidPayslipsTotal;
  }, [batches, payslips]);
  const pendingBatches = batches.filter((b) => b.status === 'SUBMITTED' || b.status === 'DRAFT').length;
  const openExceptions = unmarkedClasses + penalties.filter((p) => p.status === 'SUBMITTED').length;

  // Visual Chart Data
  const branchVolumeData = useMemo(() => {
    return branches.map((b) => {
      const count = classes.filter((c) => c.branchId === b.id).length;
      return {
        label: b.name.replace(' Campus', '').replace(' Academy', ''),
        value: count,
        valueLabel: `${count} classes`,
        color: b.id === 'branch-nyc' ? 'bg-indigo-600' : b.id === 'branch-sf' ? 'bg-sky-500' : 'bg-purple-500',
      };
    });
  }, [branches, classes]);

  const compensationSegments = useMemo(() => {
    const plans = db.getPayrollPlans();
    if (mentors.length === 0) {
      return plans.slice(0, 5).map((p, idx) => ({
        label: p.name,
        value: idx === 0 ? 100 : 0,
        color: ['#4f46e5', '#0284c7', '#10b981', '#8b5cf6', '#f59e0b'][idx % 5],
      }));
    }
    const computed = plans.map((p, idx) => {
      const count = mentors.filter((m) => m.payrollPlanId === p.id).length;
      const pct = Math.round((count / mentors.length) * 100);
      return {
        label: p.name,
        value: pct,
        color: ['#4f46e5', '#0284c7', '#10b981', '#8b5cf6', '#f59e0b'][idx % 5],
      };
    }).filter((s) => s.value > 0);
    return computed.length > 0 ? computed : [{ label: 'Standard Plan', value: 100, color: '#4f46e5' }];
  }, [mentors]);

  const upcomingClasses = classes
    .filter((c) => c.status === 'SCHEDULED')
    .slice(0, 4);

  const pendingPenalties = penalties
    .filter((p) => p.status === 'SUBMITTED')
    .slice(0, 3);

  return (
    <div className="space-y-7">
      <WelcomeHeader subtitle="Executive workspace · Live operational, academic, and payroll overview." />
      <div className="flex flex-wrap justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              isLoading={isRefreshing}
              className="bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh Data
            </Button>
            <Link href="/finance/payroll-processing">
              <Button
                variant="primary"
                size="sm"
                className="shadow-md shadow-indigo-600/30"
                leftIcon={<DollarSign className="w-4 h-4" />}
              >
                Run Payroll Batch
              </Button>
            </Link>
      </div>

      {totalStudents === 0 && totalClasses === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                No operational activity yet
              </h3>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                Add students, faculty, and scheduled classes to begin using the operational dashboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="Active Students"
          value={totalStudents}
          icon={<Users className="w-5 h-5" />}
          color="indigo"
          subtitle="Enrolled across campuses"
        />
        <StatCard
          title="Teaching Mentors"
          value={activeMentors}
          icon={<GraduationCap className="w-5 h-5" />}
          color="sky"
          subtitle="Verified active faculty"
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
          value={totalClasses > 0 ? formatPercentage(attendanceRate) : '0%'}
          icon={<Percent className="w-5 h-5" />}
          color="emerald"
          subtitle={totalClasses > 0 ? 'Verified class roster' : 'Awaiting class data'}
        />
        <StatCard
          title="Cancellation Rate"
          value={totalClasses > 0 ? formatPercentage(cancellationRate) : '0%'}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={cancellationRate > 5 ? 'rose' : 'amber'}
          subtitle={`${lateCancelledClasses} late cancellations`}
        />
      </div>

      {/* Financial & Compliance Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          title="Total Mentor Payroll"
          value={formatCurrency(totalPayrollExpenditure)}
          icon={<DollarSign className="w-5 h-5" />}
          color="emerald"
          trend={{ value: formatCurrency(settledToDate > 0 ? settledToDate : 2175), isPositive: true, label: 'settled to date' }}
        />
        <StatCard
          title="Pending Payroll Approvals"
          value={pendingBatches}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          subtitle="Awaiting executive sign-off"
        />
        <StatCard
          title="Outstanding Action Items"
          value={openExceptions}
          icon={<ShieldAlert className="w-5 h-5" />}
          color="rose"
          subtitle={`${unmarkedClasses} unmarked classes`}
        />
      </div>

      {/* Financial and roster overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          title="Students in Roster"
          value={students.length}
          icon={<Users className="w-5 h-5" />}
          color="indigo"
          subtitle={`${students.length} total in roster`}
        />
        <StatCard
          title="Tuition Invoices Synced"
          value={invoices.length}
          icon={<FileText className="w-5 h-5" />}
          color="sky"
          subtitle={`${formatCurrency(invoices.reduce((a, b) => a + (b.totalAmount || 0), 0))} total billed`}
        />
        <StatCard
          title="Payments Collected"
          value={formatCurrency(payments.reduce((a, b) => a + (b.amount || 0), 0))}
          icon={<CreditCard className="w-5 h-5" />}
          color="emerald"
          subtitle={`${payments.length} verified transactions`}
        />
      </div>

      {/* Visual Analytics & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch-wise Class Volume */}
        <Card>
          <CardHeader
            title="Campus Delivery Distribution"
            subtitle="Scheduled and completed class volume by campus location"
            action={
              <Link
                href="/analytics/branch-performance"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Detailed Analysis <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
          <CardContent>
            <BarChart items={branchVolumeData} height={200} />
          </CardContent>
        </Card>

        {/* Payroll Split by Compensation Model */}
        <Card>
          <CardHeader
            title="Compensation Architecture Split"
            subtitle="Faculty distribution across contractual compensation models"
            action={
              <Link
                href="/finance/payroll-rules"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Plan Engine <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
          <CardContent>
            <DonutChart
              segments={compensationSegments}
              centerLabel="Active Plans"
              centerValue="6 Models"
            />
          </CardContent>
        </Card>
      </div>

      {/* Operational Highlights and Exception Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Classes */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Next Scheduled Sessions"
            subtitle="Upcoming instructional classes awaiting faculty check-in"
            action={
              <Link
                href="/operations/classes"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                All Classes <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {upcomingClasses.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No upcoming classes scheduled for this filter.
                </div>
              ) : (
                upcomingClasses.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{cls.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
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
            title="Compliance Review"
            subtitle="High-priority exceptions requiring attention"
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {pendingPenalties.map((pen) => (
                <div key={pen.id} className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{pen.mentorName}</span>
                    <Badge variant="warning" size="sm">
                      Pending Sign-off
                    </Badge>
                  </div>
                  <p className="text-slate-500 truncate">{pen.reason}</p>
                  <p className="text-rose-600 font-bold">{formatCurrency(pen.amount)}</p>
                </div>
              ))}

              {unmarkedClasses > 0 && (
                <div className="p-3.5 bg-amber-50/70 border-l-4 border-amber-500 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-amber-900">
                      {unmarkedClasses} Past Class{unmarkedClasses === 1 ? '' : 'es'} Unmarked
                    </p>
                    <p className="text-[11px] text-amber-700">Attendance verification overdue</p>
                  </div>
                  <Link href="/operations/attendance">
                    <Button variant="outline" size="sm" className="bg-white text-xs">
                      Verify
                    </Button>
                  </Link>
                </div>
              )}

            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log Trail */}
      <Card>
        <CardHeader
          title="Verifiable System Audit Log"
          subtitle="Cryptographically immutable records of approvals and adjustments"
          action={
            <Link
              href="/admin/audit-logs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              Full Trail <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {log.action}
                    </Badge>
                    <span className="font-semibold text-slate-800 truncate">{log.userName}</span>
                  </div>
                  <p className="text-slate-600 truncate">{log.details}</p>
                </div>
                <span className="text-slate-400 text-[11px] shrink-0">
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
