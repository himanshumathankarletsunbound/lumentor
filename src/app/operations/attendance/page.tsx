'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { CalendarEventModal } from '../../../components/calendar/CalendarEventModal';
import { ClassEvent } from '../../../lib/types/models';
import { formatDate, formatTime } from '../../../lib/utils/formatters';

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassEvent[]>(db.getClasses());
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [mentorFilter, setMentorFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch('/api/dashboard').then((response) => response.json()).then((payload) => {
        if (payload.success && payload.data?.classes) setClasses(payload.data.classes);
      }).catch((error: unknown) => console.error('Failed to load attendance sessions:', error));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const mentors = useMemo(() => Array.from(new Map(classes.map((item) => [item.mentorId, item.mentorName])).entries()), [classes]);
  const subjects = useMemo(() => Array.from(new Map(classes.map((item) => [item.subjectId, item.subjectName])).entries()), [classes]);

  const filtered = classes.filter((c) => {
    if (onlyUnmarked && c.attendanceStatusSummary !== 'UNMARKED') return false;
    if (dateFilter && !c.startTime.startsWith(dateFilter)) return false;
    if (mentorFilter !== 'ALL' && c.mentorId !== mentorFilter) return false;
    if (subjectFilter !== 'ALL' && c.subjectId !== subjectFilter) return false;
    if (search && !`${c.title} ${c.mentorName} ${c.subjectName}`.toLowerCase().includes(search.toLowerCase())) return false;
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

        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search session, mentor, subject..." className="min-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5" />
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter attendance by date" className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5" />
          <select value={mentorFilter} onChange={(event) => setMentorFilter(event.target.value)} aria-label="Filter attendance by mentor" className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"><option value="ALL">All mentors</option>{mentors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} aria-label="Filter attendance by subject" className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"><option value="ALL">All subjects</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
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
          onSave={async (updated) => {
            try {
              const response = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  classId: updated.id,
                  roster: updated.students.map((student) => ({
                    studentId: student.studentId,
                    attendanceStatus: student.attendanceStatus,
                    notes: student.notes,
                  })),
                }),
              });
              const payload = await response.json() as { class?: ClassEvent; error?: string };
              if (!response.ok || !payload.class) {
                throw new Error(payload.error || 'Attendance could not be saved.');
              }
              setClasses((current) => current.map((item) => item.id === updated.id ? payload.class! : item));
              setSelectedEvent(null);
            } catch (error) {
              window.alert(error instanceof Error ? error.message : 'Attendance could not be saved.');
            }
          }}
        />
      </div>
    </AppShell>
  );
}
