'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { SyncStatusCard } from '../../../components/classcard/SyncStatusCard';
import { EndpointMatrix } from '../../../components/classcard/EndpointMatrix';
import { SyncHistoryTable } from '../../../components/classcard/SyncHistoryTable';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { FieldMapping } from '../../../lib/types/classcard';

export default function ClasscardIntegrationPage() {
  const [activeTab, setActiveTab] = useState('endpoints');

  const tabs = [
    { id: 'endpoints', label: 'Documented Endpoints (27)' },
    { id: 'history', label: 'Sync Execution History' },
    { id: 'mappings', label: 'Data Field Mappings' },
  ];

  const fieldMappings: FieldMapping[] = [
    { id: 'm1', sourceEntity: 'ClasscardStudent', sourceField: 'id', targetEntity: 'Student', targetField: 'externalId', isRequired: true },
    { id: 'm2', sourceEntity: 'ClasscardStudent', sourceField: 'email', targetEntity: 'Student', targetField: 'email', isRequired: true },
    { id: 'm3', sourceEntity: 'ClasscardStaff', sourceField: 'id', targetEntity: 'Mentor', targetField: 'externalId', isRequired: true },
    { id: 'm4', sourceEntity: 'ClasscardEvent', sourceField: 'id', targetEntity: 'ClassEvent', targetField: 'externalId', isRequired: true },
    { id: 'm5', sourceEntity: 'ClasscardEvent', sourceField: 'start_time', targetEntity: 'ClassEvent', targetField: 'startTime', isRequired: true },
    { id: 'm6', sourceEntity: 'ClasscardEvent', sourceField: 'duration', targetEntity: 'ClassEvent', targetField: 'durationMinutes', isRequired: true },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Classcard Public API Integration</h1>
          <p className="text-xs text-slate-500 mt-1">
            Server-side integration gateway connecting to https://api.classcardapp.com/api/v2/public/ with api-key authentication.
          </p>
        </div>

        {/* Sync Status & Connection Card */}
        <SyncStatusCard />

        {/* Tabbed Configuration & Status */}
        <div className="space-y-4">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'endpoints' && (
            <Card>
              <CardHeader
                title="Verified Endpoint Inventory"
                subtitle="Live status, HTTP methods, and parameter schemas for documented Classcard endpoints"
              />
              <CardContent className="p-0">
                <EndpointMatrix />
              </CardContent>
            </Card>
          )}

          {activeTab === 'history' && (
            <Card>
              <CardHeader
                title="Sync Batch Audit Trail"
                subtitle="Logs of imported records, deduplication events, and execution runtimes"
              />
              <CardContent className="p-0">
                <SyncHistoryTable />
              </CardContent>
            </Card>
          )}

          {activeTab === 'mappings' && (
            <Card>
              <CardHeader
                title="Field Normalization & Schema Mappings"
                subtitle="Provenance tracking and relational schema adapters"
              />
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source Entity (Classcard)</TableHead>
                      <TableHead>Source Field</TableHead>
                      <TableHead>Target Entity (Local Relational)</TableHead>
                      <TableHead>Target Field</TableHead>
                      <TableHead>Requirement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fieldMappings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs font-semibold text-slate-800">{m.sourceEntity}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">{m.sourceField}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-indigo-700">{m.targetEntity}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">{m.targetField}</TableCell>
                        <TableCell>
                          <Badge variant={m.isRequired ? 'default' : 'neutral'} size="sm">
                            {m.isRequired ? 'Required Identifier' : 'Optional'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
