'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { ExecutiveDashboardView } from '../../../components/dashboard/ExecutiveDashboardView';

export default function ExecutivePage() {
  return (
    <AppShell>
      <ExecutiveDashboardView />
    </AppShell>
  );
}
