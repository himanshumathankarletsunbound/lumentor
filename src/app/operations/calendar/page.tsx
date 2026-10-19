'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { UnifiedCalendar } from '../../../components/calendar/UnifiedCalendar';

export default function CalendarPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Unified Operational Calendar</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time schedule of all classes, marked attendance, mentor assignments, and room bookings across campus branches.
          </p>
        </div>
        <UnifiedCalendar />
      </div>
    </AppShell>
  );
}
