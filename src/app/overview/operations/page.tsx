'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { OperationsDashboardView } from '../../../components/dashboard/OperationsDashboardView';

export default function OperationsOverviewPage() {
  return (
    <AppShell>
      <OperationsDashboardView />
    </AppShell>
  );
}
