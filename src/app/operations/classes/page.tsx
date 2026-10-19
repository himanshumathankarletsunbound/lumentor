'use client';

import React, { useState, useMemo } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { CalendarEventModal } from '../../../components/calendar/CalendarEventModal';
import { ClassEvent } from '../../../lib/types/models';
import { Search, Plus, Filter, Calendar, Users, MapPin, CheckCircle2 } from 'lucide-react';
import { formatDate, formatTime } from '../../../lib/utils/formatters';

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassEvent[]>(db.getClasses());
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');

  const branches = db.getBranches();

  const filtered = useMemo(() => {
    return classes.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (branchFilter !== 'ALL' && c.branchId !== branchFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !c.title.toLowerCase().includes(q) &&
          !c.mentorName.toLowerCase().includes(q) &&
          !c.students.some((s) => s.studentName.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [classes, statusFilter, branchFilter, search]);

  const handleSaveClass = (updated: ClassEvent) => {
    db.updateClass(updated.id, updated);
    setClasses(db.getClasses());
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Classes & Sessions</h1>
            <p className="text-xs text-slate-500 mt-1">
              Directory of scheduled, completed, and cancelled instructional sessions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Showing {filtered.length} of {classes.length} sessions
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search class title, mentor, student..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              aria-label="Filter by Branch Location"
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Class Status"
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="LATE_CANCELLED">Late Cancelled</option>
            </select>
          </div>
        </div>

        {/* Classes Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class / Session Title</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Students / Roster</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provenance</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <TableEmptyState
                    title="No sessions match filter"
                    description="Try adjusting your search criteria or resetting filters."
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
                    <p className="hover:text-indigo-600 transition-colors">{cls.title}</p>
                    <p className="text-[11px] text-slate-400 font-normal">
                      {cls.branchName} {cls.room ? `• ${cls.room}` : ''}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-slate-700">{cls.subjectName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold text-slate-800">{cls.mentorName}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    <p>{formatDate(cls.startTime)}</p>
                    <p className="text-slate-400 text-[11px]">
                      {formatTime(cls.startTime)} ({cls.durationMinutes}m)
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-600">
                      {cls.students.map((s) => s.studentName).join(', ') || 'None'}
                    </span>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    {cls.provenance === 'CLASSCARD_SOURCED' ? (
                      <Badge variant="purple" size="sm">
                        Classcard
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Local
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedEvent(cls)}>
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Modal */}
        <CalendarEventModal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          classEvent={selectedEvent}
          onSave={handleSaveClass}
        />
      </div>
    </AppShell>
  );
}
