'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { formatTime, formatDate } from '../../lib/utils/formatters';
import Link from 'next/link';
import { ClassEvent } from '../../lib/types/models';

export function OperationsDashboardView() {
  const { selectedBranch } = useAuth();
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);

  const classes = db.getClasses({ branchId: selectedBranch });
  const penalties = db.getPenalties();

  const totalClasses = classes.length;
  const completedClasses = classes.filter((c) => c.status === 'COMPLETED').length;
  const unmarkedClasses = classes.filter((c) => c.attendanceStatusSummary === 'UNMARKED');
  const cancellations = classes.filter((c) => c.status === 'CANCELLED' || c.status === 'LATE_CANCELLED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operations Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Daily scheduling monitor, attendance exceptions, and incident documentation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ShieldAlert className="w-4 h-4 text-rose-600" />}
            onClick={() => setPenaltyModalOpen(true)}
          >
            Submit Incident / Penalty
          </Button>
          <Link href="/operations/calendar">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Open Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Scheduled Sessions"
          value={totalClasses}
          icon={<Calendar className="w-5 h-5" />}
          color="indigo"
          subtitle="Assigned this period"
        />
        <StatCard
          title="Completed & Marked"
          value={completedClasses}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          subtitle="Fully verified"
        />
        <StatCard
          title="Unmarked Discrepancies"
          value={unmarkedClasses.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="amber"
          subtitle="Attendance overdue"
        />
        <StatCard
          title="Cancellations & Exceptions"
          value={cancellations.length}
          icon={<Clock className="w-5 h-5" />}
          color="rose"
          subtitle="Late & normal cancels"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Discrepancies Roster */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Attendance Discrepancies & Pending Sessions"
            subtitle="Past or active sessions missing attendance confirmation"
            action={
              <Link href="/operations/attendance" className="text-xs text-indigo-600 hover:underline">
                Attendance Console
              </Link>
            }
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {unmarkedClasses.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  All sessions have attendance recorded. No exceptions pending!
                </div>
              ) : (
                unmarkedClasses.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{cls.title}</p>
                      <p className="text-slate-500 mt-0.5">
                        {formatDate(cls.startTime)} at {formatTime(cls.startTime)} • {cls.mentorName} • {cls.branchName}
                      </p>
                      <p className="text-amber-700 font-medium text-[11px] mt-0.5">
                        Status: {cls.status} • Attendance Unmarked
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Mark Now
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Operational Shortcuts & Penalties */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Recent Infractions Submitted"
              subtitle="Pending administrator review"
              action={
                <Link href="/finance/penalties" className="text-xs text-indigo-600 hover:underline">
                  All Penalties
                </Link>
              }
            />
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 text-xs">
                {penalties.slice(0, 4).map((pen) => (
                  <div key={pen.id} className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{pen.mentorName}</span>
                      <Badge
                        variant={
                          pen.status === 'APPROVED' ? 'success' : pen.status === 'SUBMITTED' ? 'warning' : 'neutral'
                        }
                        size="sm"
                      >
                        {pen.status}
                      </Badge>
                    </div>
                    <p className="text-slate-500 truncate">{pen.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
