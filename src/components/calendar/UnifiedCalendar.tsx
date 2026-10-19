'use client';

import React, { useState, useMemo } from 'react';
import { ClassEvent } from '../../lib/types/models';
import { CalendarViewMode, CalendarSummaryMetrics } from '../../lib/types/calendar';
import { CalendarFilterBar } from './CalendarFilterBar';
import { CalendarEventModal } from './CalendarEventModal';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { db } from '../../lib/db/store';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays,
} from 'date-fns';
import { Clock, MapPin, Users, Calendar as CalendarIcon, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { formatTime } from '../../lib/utils/formatters';

export function UnifiedCalendar({ initialClasses }: { initialClasses?: ClassEvent[] }) {
  const [classes, setClasses] = useState<ClassEvent[]>(initialClasses || db.getClasses());
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const list = initialClasses || db.getClasses();
    if (list.length > 0) {
      return new Date(list[0].startTime);
    }
    return new Date('2026-10-15T00:00:00Z');
  });
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedMentor, setSelectedMentor] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  React.useEffect(() => {
    const now = new Date();
    setToday(now);
    if (!initialClasses && db.getClasses().length === 0) {
      setCurrentDate(now);
    }
  }, [initialClasses]);

  const branches = db.getBranches();
  const subjects = db.getSubjects();
  const mentors = db.getMentors();

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (selectedBranch !== 'ALL' && c.branchId !== selectedBranch) return false;
      if (selectedSubject !== 'ALL' && c.subjectId !== selectedSubject) return false;
      if (selectedMentor !== 'ALL' && c.mentorId !== selectedMentor) return false;
      if (selectedStatus !== 'ALL' && c.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesMentor = c.mentorName.toLowerCase().includes(q);
        const matchesStudent = c.students.some((s) => s.studentName.toLowerCase().includes(q));
        if (!matchesTitle && !matchesMentor && !matchesStudent) return false;
      }
      return true;
    });
  }, [classes, selectedBranch, selectedSubject, selectedMentor, selectedStatus, searchQuery]);

  // Summary Metrics
  const metrics: CalendarSummaryMetrics = useMemo(() => {
    let total = 0;
    let completed = 0;
    let scheduled = 0;
    let cancelled = 0;
    let lateCancelled = 0;
    let unmarked = 0;

    for (const c of filteredClasses) {
      total++;
      if (c.status === 'COMPLETED') completed++;
      else if (c.status === 'SCHEDULED') scheduled++;
      else if (c.status === 'CANCELLED') cancelled++;
      else if (c.status === 'LATE_CANCELLED') lateCancelled++;

      if (c.attendanceStatusSummary === 'UNMARKED') unmarked++;
    }

    return { total, completed, scheduled, cancelled, lateCancelled, unmarked };
  }, [filteredClasses]);

  const handleSaveClass = (updated: ClassEvent) => {
    db.updateClass(updated.id, updated);
    setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const getEventBadgeClass = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
      case 'SCHEDULED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100';
      case 'LATE_CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100';
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 line-through';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Month grid generator
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  return (
    <div className="space-y-4">
      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Sessions</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{metrics.total}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase">Completed</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5">{metrics.completed}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
          <p className="text-[11px] font-semibold text-indigo-600 uppercase">Scheduled</p>
          <p className="text-xl font-bold text-indigo-700 mt-0.5">{metrics.scheduled}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
          <p className="text-[11px] font-semibold text-rose-600 uppercase">Late Cancelled</p>
          <p className="text-xl font-bold text-rose-700 mt-0.5">{metrics.lateCancelled}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Cancelled</p>
          <p className="text-xl font-bold text-slate-600 mt-0.5">{metrics.cancelled}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
          <p className="text-[11px] font-semibold text-amber-600 uppercase">Unmarked</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5">{metrics.unmarked}</p>
        </div>
      </div>

      {/* Filter and Navigation Bar */}
      <CalendarFilterBar
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        branches={branches}
        subjects={subjects}
        mentors={mentors}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        selectedSubject={selectedSubject}
        onSubjectChange={setSelectedSubject}
        selectedMentor={selectedMentor}
        onMentorChange={setSelectedMentor}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Calendar Views */}
      <Card className="overflow-hidden">
        {/* --- 1. MONTH VIEW --- */}
        {viewMode === 'month' && (
          <div>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider py-2.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50/30">
              {monthDays.map((day, idx) => {
                const dayClasses = filteredClasses.filter((c) => isSameDay(new Date(c.startTime), day));
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = today ? isSameDay(day, today) : false;

                return (
                  <div
                    key={idx}
                    className={`min-h-[110px] sm:min-h-[130px] p-2 flex flex-col justify-between transition-colors ${
                      isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-indigo-600 text-white'
                            : isCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayClasses.length > 0 && (
                        <span className="text-[10px] font-medium text-slate-400">
                          {dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'}
                        </span>
                      )}
                    </div>

                    {/* Classes in day */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                      {dayClasses.map((cls) => (
                        <button
                          key={cls.id}
                          onClick={() => setSelectedEvent(cls)}
                          className={`w-full text-left px-1.5 py-1 rounded-md border text-[11px] leading-tight truncate block cursor-pointer transition-colors ${getEventBadgeClass(
                            cls.status
                          )}`}
                          title={`${cls.title} - ${formatTime(cls.startTime)} (${cls.mentorName})`}
                        >
                          <span className="font-semibold block truncate">
                            {formatTime(cls.startTime)} {cls.title}
                          </span>
                          <span className="text-[10px] opacity-80 block truncate">
                            {cls.mentorName} • {cls.students[0]?.studentName || 'Group'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 2. AGENDA VIEW --- */}
        {viewMode === 'agenda' && (
          <div className="divide-y divide-slate-100">
            {filteredClasses.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No classes match the selected filters or date range.
              </div>
            ) : (
              filteredClasses
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{cls.title}</span>
                        <Badge
                          variant={
                            cls.status === 'COMPLETED'
                              ? 'success'
                              : cls.status === 'SCHEDULED'
                              ? 'info'
                              : cls.status === 'LATE_CANCELLED'
                              ? 'danger'
                              : 'neutral'
                          }
                          size="sm"
                          dot
                        >
                          {cls.status}
                        </Badge>
                        {cls.provenance === 'CLASSCARD_SOURCED' && (
                          <Badge variant="purple" size="sm">
                            Classcard
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                          {format(new Date(cls.startTime), 'EEE, MMM d, yyyy')} • {formatTime(cls.startTime)} - {formatTime(cls.endTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {cls.students.map((s) => s.studentName).join(', ') || 'No students'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {cls.branchName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                        {cls.mentorName}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* --- 3. WEEK & DAY VIEWS (Fallback to agenda format for responsiveness) --- */}
        {(viewMode === 'week' || viewMode === 'day') && (
          <div className="p-6 text-center space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              {viewMode === 'week' ? 'Week View Schedule' : 'Daily Hourly Schedule'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Viewing classes for {format(currentDate, 'MMMM d, yyyy')}. Click on any session below to mark attendance or manage exceptions.
            </p>
            <div className="divide-y divide-slate-100 max-w-3xl mx-auto text-left mt-4 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {filteredClasses.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No sessions scheduled for this period.
                </div>
              ) : (
                filteredClasses.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 text-xs sm:text-sm">{cls.title}</p>
                      <p className="text-xs text-slate-500">
                        {formatTime(cls.startTime)} - {formatTime(cls.endTime)} • {cls.mentorName} • {cls.branchName}
                      </p>
                    </div>
                    <Badge
                      variant={
                        cls.status === 'COMPLETED'
                          ? 'success'
                          : cls.status === 'SCHEDULED'
                          ? 'info'
                          : cls.status === 'LATE_CANCELLED'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {cls.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Interactive Class Modal */}
      <CalendarEventModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        classEvent={selectedEvent}
        onSave={handleSaveClass}
      />
    </div>
  );
}
