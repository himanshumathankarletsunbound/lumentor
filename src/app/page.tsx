'use client';

import React from 'react';
import { AppShell } from '../components/layout/AppShell';
import { ExecutiveDashboardView } from '../components/dashboard/ExecutiveDashboardView';
import { MentorDashboardView } from '../components/dashboard/MentorDashboardView';
import { useAuth } from '../lib/auth/AuthContext';

function DashboardRouter() {
  const { isMentor } = useAuth();
  if (isMentor) {
    return <MentorDashboardView />;
  }
  return <ExecutiveDashboardView />;
}

export default function HomePage() {
  return (
    <AppShell>
      <DashboardRouter />
    </AppShell>
  );
}
