'use client';

import React, { useState } from 'react';
import { db } from '../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { formatDateTime } from '../../lib/utils/formatters';

export function SyncHistoryTable() {
  const syncJobs = db.getSyncJobs();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Job ID & Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Execution Time</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Processed / Created / Updated / Failed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {syncJobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <TableEmptyState title="No sync runs recorded" description="Run a manual sync above to import Classcard data." />
              </TableCell>
            </TableRow>
          ) : (
            syncJobs.map((job) => {
              const isExpanded = expandedId === job.id;
              return (
                <React.Fragment key={job.id}>
                  <TableRow className="cursor-pointer" onClick={() => toggleExpand(job.id)}>
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">
                      {job.jobType} Sync ({job.id})
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={job.status === 'COMPLETED' ? 'success' : job.status === 'PARTIAL' ? 'warning' : 'danger'}
                        size="sm"
                        dot
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {formatDateTime(job.startedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      <span className="text-slate-800 font-semibold">{job.recordsProcessed}</span> /{' '}
                      <span className="text-emerald-600 font-semibold">+{job.recordsCreated}</span> /{' '}
                      <span className="text-indigo-600 font-semibold">~{job.recordsUpdated}</span> /{' '}
                      <span className="text-rose-600 font-semibold">!{job.recordsFailed}</span>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Detail Log */}
                  {isExpanded && (
                    <TableRow className="bg-slate-50/70">
                      <TableCell colSpan={6} className="px-6 py-4">
                        <div className="space-y-1.5 text-xs">
                          <p className="font-bold text-slate-700">Detailed Execution Logs:</p>
                          <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
                            {job.logSummary.map((line, idx) => (
                              <div key={idx} className="leading-relaxed">
                                <span className="text-slate-500 mr-2">[{idx + 1}]</span>
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
