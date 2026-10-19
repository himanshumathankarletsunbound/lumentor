'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { CalendarEventModal } from '../../../components/calendar/CalendarEventModal';
import { ClassEvent } from '../../../lib/types/models';
import { CheckSquare, AlertTriangle, Users, CheckCircle2 } from 'lucide-react';
import { formatDate, formatTime } from '../../../lib/utils/formatters';

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassEvent[]>(db.getClasses());
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);

  const filtered = classes.filter((c) => {
    if (onlyUnmarked && c.attendanceStatusSummary !== 'UNMARKED') return false;
    return true;
  });

  const unmarkedCount = classes.filter((c) => c.attendanceStatusSummary === 'UNMARKED').length;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Management</h1>
            <p className="text-xs text-slate-500 mt-1">
              Track student attendance compliance, flag absences, and verify roster participation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyUnmarked(!onlyUnmarked)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                onlyUnmarked
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {onlyUnmarked ? 'Showing Unmarked Only' : `Show Unmarked (${unmarkedCount})`}
            </button>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Attendance Status</TableHead>
              <TableHead>Roster Breakdown</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <TableEmptyState
                    title="No sessions found"
                    description="All session rosters are up to date."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((cls) => (
                <TableRow
                  key={cls.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedEvent(cls)}
                >
                  <TableCell className="font-semibold text-slate-900">
                    <p>{cls.title}</p>
                    <p className="text-[11px] text-slate-400 font-normal">{cls.branchName}</p>
                  </TableCell>
                  <TableCell className="font-medium text-slate-800">{cls.mentorName}</TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {formatDate(cls.startTime)} at {formatTime(cls.startTime)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        cls.attendanceStatusSummary === 'ALL_PRESENT'
                          ? 'success'
                          : cls.attendanceStatusSummary === 'UNMARKED'
                          ? 'warning'
                          : cls.attendanceStatusSummary === 'ALL_ABSENT'
                          ? 'danger'
                          : 'info'
                      }
                      size="sm"
                      dot
                    >
                      {cls.attendanceStatusSummary.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {cls.students.map((s) => (
                      <span
                        key={s.studentId}
                        className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] mr-1.5 mb-1"
                      >
                        {s.studentName}: <strong>{s.attendanceStatus}</strong>
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                      Update
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <CalendarEventModal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          classEvent={selectedEvent}
          onSave={(updated) => {
            db.updateClass(updated.id, updated);
            setClasses(db.getClasses());
            setSelectedEvent(null);
          }}
        />
      </div>
    </AppShell>
  );
}
