'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { db } from '../../lib/db/store';
import { payrollEngine } from '../../lib/payroll/engine';
import { StatCard } from '../ui/StatCard';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { CalendarEventModal } from '../calendar/CalendarEventModal';
import { PayslipViewer } from '../payroll/PayslipViewer';
import {
  Calendar,
  Clock,
  DollarSign,
  ShieldAlert,
  FileText,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  GraduationCap,
  Sparkles,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { formatCurrency, formatDuration, formatDate, formatTime } from '../../lib/utils/formatters';
import { ClassEvent } from '../../lib/types/models';
import { Payslip } from '../../lib/types/payroll';

export function MentorDashboardView() {
  const { currentUser } = useAuth();
  const mentor = db.getMentors().find((m) => m.id === currentUser.mentorId) || db.getMentors()[0] || null;
  const plans = db.getPayrollPlans();
  const mentorPlan = mentor ? (plans.find((p) => p.id === mentor.payrollPlanId) || plans[0]) : plans[0];

  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTargetId, setDisputeTargetId] = useState('');
  const [disputeNote, setDisputeNote] = useState('');

  // Mentor's classes
  const classes = mentor ? db.getClasses({ mentorId: mentor.id }) : [];
  const completedClasses = classes.filter((c) => c.status === 'COMPLETED');
  const upcomingClasses = classes.filter((c) => c.status === 'SCHEDULED');

  // Current Cycle Estimate (Oct 16 - Oct 31, 2026)
  const currentEstimate = useMemo(() => {
    if (!mentor) {
      return {
        grossEarnings: 0,
        netPayable: 0,
        eligibleDurationMinutes: 0,
        appliedPenaltyTotal: 0,
        appliedPenaltyIds: [],
        breakdown: [],
      };
    }
    return payrollEngine.calculateMentorPayroll(
      mentor,
      mentorPlan,
      classes,
      '2026-10-16',
      '2026-10-31',
      'batch-preview'
    );
  }, [mentor, mentorPlan, classes]);

  // Mentor's penalties and disputes
  const penalties = mentor ? db.getPenalties(mentor.id) : [];
  const disputes = penalties.filter((p) => p.disputeStatus === 'DISPUTED');

  // Mentor's finalized payslips
  const payslips = mentor ? db.getPayslips(mentor.id) : [];
  const latestPayslip = payslips[0] || null;

  const handleOpenDispute = (penId: string) => {
    setDisputeTargetId(penId);
    setDisputeModalOpen(true);
  };

  const handleSubmitDispute = () => {
    if (!disputeNote.trim()) return;
    db.disputePenalty(disputeTargetId, disputeNote);
    db.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: 'MENTOR',
      action: 'PENALTY_DISPUTED',
      entityType: 'Penalty',
      entityId: disputeTargetId,
      details: `Mentor raised dispute: ${disputeNote}`,
    });
    setDisputeModalOpen(false);
    setDisputeNote('');
  };

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-slate-800 p-6 sm:p-7 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-emerald-900/40 shrink-0">
              {mentor ? `${mentor.firstName[0]}${mentor.lastName[0]}` : 'F'}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">
                  Faculty Member Portal
                </span>
                <Badge variant="success" size="sm">
                  {mentorPlan?.name || 'Standard Plan'}
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {mentor ? `Welcome back, ${mentor.firstName}!` : 'Faculty Member Portal'}
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                {mentor ? `Primary Campus: ${mentor.branchName || 'Manhattan Campus'} • Contract Model: ${mentorPlan.compensationModel}` : 'Sync your Classcard staff roster to populate assigned faculty members.'}
              </p>
            </div>
          </div>

          {latestPayslip && (
            <div className="shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-md backdrop-blur-xs"
                leftIcon={<FileText className="w-4 h-4 text-emerald-400" />}
                onClick={() => setSelectedPayslip(latestPayslip)}
              >
                View Latest Payslip ({latestPayslip.payslipNumber})
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Current Cycle Estimate Notice */}
      <Alert
        type="info"
        title="Current Cycle Status: October 2026 - Cycle 2 (Oct 16 - Oct 31)"
        message="Figures shown below reflect completed classes and active bookings to date. Final compensation will be officially calculated and finalized upon payroll cutoff on October 31."
      />

      {/* Cycle KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Completed Classes"
          value={completedClasses.length}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          subtitle="This billing period"
        />
        <StatCard
          title="Instruction Time"
          value={formatDuration(currentEstimate.eligibleDurationMinutes || 120)}
          icon={<Clock className="w-5 h-5" />}
          color="indigo"
          subtitle="Eligible verified time"
        />
        <StatCard
          title="Estimated Gross"
          value={formatCurrency(currentEstimate.grossEarnings)}
          icon={<DollarSign className="w-5 h-5" />}
          color="indigo"
          subtitle="Before deductions"
        />
        <StatCard
          title="Estimated Net Payable"
          value={formatCurrency(currentEstimate.netPayable)}
          icon={<DollarSign className="w-5 h-5" />}
          color="emerald"
          subtitle="Settlement on Oct 31"
        />
      </div>

      {/* Main Split: Schedule & Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Classes / Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="My Teaching Schedule"
            subtitle="Upcoming instructional sessions requiring student attendance verification"
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {upcomingClasses.length === 0 ? (
                <div className="p-10 text-center text-slate-500">
                  You have no pending classes scheduled this week.
                </div>
              ) : (
                upcomingClasses.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-4 hover:bg-slate-50/70 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                        {cls.title}
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        {formatDate(cls.startTime)} at {formatTime(cls.startTime)} ({cls.durationMinutes} mins) • {cls.branchName}
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Students: {cls.students.map((s) => s.studentName).join(', ') || 'Roster pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="text-xs">
                        Mark Attendance
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Penalties, Disputes & Compensation Breakdown */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Applied Deductions & Adjustments"
              subtitle="Authorized deductions impacting current payroll"
            />
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 text-xs">
                {penalties.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    No penalties or infractions recorded. Excellent work!
                  </div>
                ) : (
                  penalties.map((pen) => (
                    <div key={pen.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {pen.category.replace(/_/g, ' ')}
                        </span>
                        <span className="font-bold text-rose-600">-{formatCurrency(pen.amount)}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">{pen.reason}</p>
                      <div className="flex items-center justify-between pt-1">
                        <Badge
                          variant={
                            pen.status === 'APPROVED' || pen.status === 'APPLIED'
                              ? 'danger'
                              : pen.status === 'REVERSED'
                              ? 'purple'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {pen.status}
                        </Badge>
                        {pen.status !== 'REVERSED' && pen.disputeStatus !== 'DISPUTED' && (
                          <button
                            onClick={() => handleOpenDispute(pen.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-[11px] underline font-medium"
                          >
                            Dispute Deduction
                          </button>
                        )}
                        {pen.disputeStatus === 'DISPUTED' && (
                          <span className="text-amber-600 text-[11px] font-semibold">Dispute Under Review</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Finalized Payslips History */}
          <Card>
            <CardHeader
              title="Official Payslip Archive"
              subtitle="Certified payment receipts"
            />
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 text-xs">
                {payslips.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">No finalized payslips available yet.</div>
                ) : (
                  payslips.map((slip) => (
                    <div
                      key={slip.id}
                      onClick={() => setSelectedPayslip(slip)}
                      className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{slip.periodName}</p>
                        <p className="text-slate-400 text-[11px]">Ref: {slip.payslipNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatCurrency(slip.netPayable)}</p>
                        <Badge variant="success" size="sm">
                          {slip.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dispute Modal */}
      {disputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Raise Deduction Dispute</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Provide your explanation or supporting evidence. An administrator will review your statement prior to final payroll lock.
            </p>
            <textarea
              rows={3}
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
              placeholder="State your reasons or details for dispute..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setDisputeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitDispute}
                disabled={!disputeNote.trim()}
              >
                Submit Dispute
              </Button>
            </div>
          </div>
        </div>
      )}

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
