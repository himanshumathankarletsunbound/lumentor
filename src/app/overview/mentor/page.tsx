'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { MentorDashboardView } from '../../../components/dashboard/MentorDashboardView';

export default function MentorOverviewPage() {
  return (
    <AppShell>
      <MentorDashboardView />
    </AppShell>
  );
}
