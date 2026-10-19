'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { SyncStatusCard } from '../../../components/classcard/SyncStatusCard';
import { SyncHistoryTable } from '../../../components/classcard/SyncHistoryTable';
import { EndpointMatrix } from '../../../components/classcard/EndpointMatrix';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';

export default function SyncReportsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Classcard Data Synchronization Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            API Gateway health, ingestion latency, record deduplication logs, and endpoint matrix.
          </p>
        </div>

        <SyncStatusCard />

        <Card>
          <CardHeader
            title="Classcard API Execution History"
            subtitle="Recent synchronization batches and duration logs"
          />
          <CardContent className="p-0">
            <SyncHistoryTable />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Public API v2 Endpoint Gateway Status"
            subtitle="Verified endpoint inventory and data mappings"
          />
          <CardContent className="p-0">
            <EndpointMatrix />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
