'use client';

import React from 'react';
import { AppShell } from '../components/layout/AppShell';
import { ExecutiveDashboardView } from '../components/dashboard/ExecutiveDashboardView';
import { OperationsDashboardView } from '../components/dashboard/OperationsDashboardView';
import { MentorDashboardView } from '../components/dashboard/MentorDashboardView';
import { useAuth } from '../lib/auth/AuthContext';

function DashboardRouter() {
  const { currentUser, isMentor } = useAuth();
  
  if (isMentor || currentUser.role === 'MENTOR') {
    return <MentorDashboardView />;
  }
  
  if (currentUser.role === 'OPERATIONS') {
    return <OperationsDashboardView />;
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
