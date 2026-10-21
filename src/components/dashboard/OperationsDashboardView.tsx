'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { db } from '../../lib/db/store';
import { StatCard } from '../ui/StatCard';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PenaltyModal } from '../payroll/PenaltyModal';
import { CalendarEventModal } from '../calendar/CalendarEventModal';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  ShieldAlert,
  Activity,
  UserCheck,
  ChevronRight,
  Users,
  Search,
  Check,
  RefreshCw,
} from 'lucide-react';
import { formatTime, formatDate } from '../../lib/utils/formatters';
import Link from 'next/link';
import { ClassEvent, Student, Mentor } from '../../lib/types/models';
import { Penalty } from '../../lib/types/payroll';

export function OperationsDashboardView() {
  const { selectedBranch } = useAuth();
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'discrepancies' | 'schedule' | 'incidents'>('discrepancies');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [classes, setClasses] = useState<ClassEvent[]>(() => db.getClasses({ branchId: selectedBranch }));
  const [penalties, setPenalties] = useState<Penalty[]>(() => db.getPenalties());
  const [students, setStudents] = useState<Student[]>(() => db.getStudents(selectedBranch));
  const [mentors, setMentors] = useState<Mentor[]>(() => db.getMentors(selectedBranch));

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/dashboard?branchId=${encodeURIComponent(selectedBranch)}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.classes) setClasses(json.data.classes);
        if (json.data.penalties) setPenalties(json.data.penalties);
        if (json.data.students) setStudents(json.data.students);
        if (json.data.mentors) setMentors(json.data.mentors);
        if (typeof db.initClient === 'function') {
          db.initClient({ ...db.getSnapshot(), ...json.data });
        }
      }
    } catch (err) {
      console.warn('Failed to refresh operations telemetry:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const totalClasses = classes.length;
  const completedClasses = classes.filter((c) => c.status === 'COMPLETED').length;
  const unmarkedClasses = classes.filter((c) => c.attendanceStatusSummary === 'UNMARKED');
  const cancellations = classes.filter((c) => c.status === 'CANCELLED' || c.status === 'LATE_CANCELLED');

  // Quick 1-click attendance verification
  const handleQuickMarkAllPresent = (cls: ClassEvent) => {
    const updatedStudents = cls.students.map((s) => ({
      ...s,
      attendanceStatus: 'PRESENT' as const,
      markedAt: new Date().toISOString(),
      markedBy: 'Operations Dispatch',
    }));
    db.updateClass(cls.id, {
      students: updatedStudents,
      attendanceStatusSummary: 'ALL_PRESENT',
      status: 'COMPLETED',
    });
  };

  return (
    <div className="space-y-6">
      {/* Operations Desk Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-slate-800 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-semibold border border-sky-500/30">
                <Activity className="w-3.5 h-3.5" />
                Operations Dispatch Center
              </span>
              <span className="text-xs text-slate-400">
                {selectedBranch === 'ALL' ? 'All Campuses' : `Campus Filter: ${selectedBranch}`}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Academic Delivery & Attendance Dispatch
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Monitor active instruction, reconcile roster check-ins, record incidents, and enforce attendance SLAs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              isLoading={isRefreshing}
              className="bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-900/80 border-slate-700 text-rose-300 hover:bg-slate-800"
              leftIcon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
              onClick={() => setPenaltyModalOpen(true)}
            >
              Report Incident / Penalty
            </Button>
            <Link href="/operations/attendance">
              <Button
                variant="primary"
                size="sm"
                className="bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Attendance Console
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Sessions"
          value={totalClasses}
          icon={<Calendar className="w-5 h-5" />}
          color="indigo"
          subtitle="In current period"
        />
        <StatCard
          title="Verified Completed"
          value={completedClasses}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          subtitle="Rosters fully confirmed"
        />
        <StatCard
          title="Attendance Overdue"
          value={unmarkedClasses.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={unmarkedClasses.length > 0 ? 'amber' : 'emerald'}
          subtitle="Pending check-in"
        />
        <StatCard
          title="Cancellations"
          value={cancellations.length}
          icon={<Clock className="w-5 h-5" />}
          color="rose"
          subtitle="Late cancels & drops"
        />
      </div>

      {/* Interactive Operations Dispatch Console */}
      <Card>
        <div className="border-b border-slate-100 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('discrepancies')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'discrepancies'
                  ? 'bg-amber-500/10 text-amber-700 border border-amber-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Overdue Attendance ({unmarkedClasses.length})
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'schedule'
                  ? 'bg-sky-500/10 text-sky-700 border border-sky-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Today's Session Schedule ({classes.length})
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'incidents'
                  ? 'bg-rose-500/10 text-rose-700 border border-rose-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Recorded Penalties ({penalties.length})
            </button>
          </div>

          <Link href="/operations/calendar" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            Open Full Calendar <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <CardContent className="p-0">
          {activeTab === 'discrepancies' && (
            <div className="divide-y divide-slate-100 text-xs">
              {unmarkedClasses.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">All Rosters Reconciled!</p>
                  <p className="text-slate-400 text-xs mt-1">
                    Every scheduled session currently has verified attendance logged.
                  </p>
                </div>
              ) : (
                unmarkedClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="cursor-pointer" onClick={() => setSelectedEvent(cls)}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                          {cls.title}
                        </span>
                        <Badge variant="warning" size="sm">
                          Unmarked
                        </Badge>
                      </div>
                      <p className="text-slate-500 text-xs mt-1">
                        {formatDate(cls.startTime)} at {formatTime(cls.startTime)} • Faculty: {cls.mentorName} • {cls.branchName}
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Students ({cls.students.length}): {cls.students.map((s) => s.studentName).join(', ') || 'None assigned'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        onClick={() => handleQuickMarkAllPresent(cls)}
                      >
                        Confirm All Present
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedEvent(cls)}
                      >
                        Review Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="divide-y divide-slate-100 text-xs">
              {classes.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">No Scheduled Classes</p>
                  <p className="text-slate-400 text-xs mt-1">
                    Demo data has been purged. Synchronize class calendar events from your live Classcard account.
                  </p>
                  <div className="mt-4">
                    <Link href="/admin/classcard-integration">
                      <Button variant="outline" size="sm">
                        Classcard Integration
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                classes.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-4 hover:bg-slate-50/70 transition-colors cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{cls.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">
                        {formatDate(cls.startTime)} at {formatTime(cls.startTime)} ({cls.durationMinutes} mins) • {cls.mentorName} • {cls.branchName}
                      </p>
                    </div>
                    <Badge
                      variant={
                        cls.status === 'COMPLETED'
                          ? 'success'
                          : cls.status === 'CANCELLED' || cls.status === 'LATE_CANCELLED'
                          ? 'danger'
                          : 'info'
                      }
                      size="sm"
                      dot
                    >
                      {cls.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'incidents' && (
            <div className="divide-y divide-slate-100 text-xs">
              {penalties.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">Zero Incidents or Penalties</p>
                  <p className="text-slate-400 text-xs mt-1">
                    No policy infractions or deductions have been logged for this cycle.
                  </p>
                </div>
              ) : (
                penalties.map((pen) => (
                  <div key={pen.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{pen.mentorName}</span>
                        <Badge
                          variant={
                            pen.status === 'APPROVED' || pen.status === 'APPLIED'
                              ? 'success'
                              : pen.status === 'SUBMITTED'
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {pen.status}
                        </Badge>
                      </div>
                      <p className="text-slate-600 mt-1">{pen.reason}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Category: {pen.category.replace(/_/g, ' ')} • Submitted by: {pen.createdByName}
                      </p>
                    </div>
                    <span className="text-rose-600 font-bold text-sm shrink-0">
                      -${pen.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Dialogs */}
      <PenaltyModal
        isOpen={penaltyModalOpen}
        onClose={() => setPenaltyModalOpen(false)}
        onSaved={() => {}}
      />

      <CalendarEventModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        classEvent={selectedEvent}
        onSave={(updated) => {
          db.updateClass(updated.id, updated);
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}
