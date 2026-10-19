'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Search, ShieldAlert, History } from 'lucide-react';
import { formatDate, formatTime } from '../../../lib/utils/formatters';

export default function AuditLogsPage() {
  const [logs] = useState(db.getAuditLogs(100));
  const [search, setSearch] = useState('');

  const filtered = logs.filter((l) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Audit Log</h1>
            <p className="text-xs text-slate-500 mt-1">
              Immutable chronological record of sensitive operations, payroll approvals, and credential adjustments.
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search audit action, user, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-64"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Entity Type & ID</TableHead>
              <TableHead>Operation Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                  <p className="font-semibold">{formatDate(log.timestamp)}</p>
                  <p className="text-[11px] text-slate-400">{formatTime(log.timestamp)}</p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      log.action.includes('APPROVED') || log.action.includes('PAID')
                        ? 'success'
                        : log.action.includes('REVERSED') || log.action.includes('RETURNED')
                        ? 'purple'
                        : log.action.includes('SUBMITTED')
                        ? 'warning'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="font-semibold text-slate-900 text-xs">{log.userName}</p>
                  <p className="text-[10px] text-slate-400">{log.userRole}</p>
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-600">
                  <span className="font-semibold text-slate-800">{log.entityType}</span>
                  <span className="text-slate-400 block text-[10px]">{log.entityId}</span>
                </TableCell>
                <TableCell className="text-xs text-slate-700 leading-relaxed max-w-md">
                  {log.details}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
