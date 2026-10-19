'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Package } from '../../../lib/types/models';
import { Package as PackageIcon } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils/formatters';

export default function PackagesPage() {
  const [packages] = useState<Package[]>(db.getPackages());

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Packages & Enrolments</h1>
            <p className="text-xs text-slate-500 mt-1">
              Tuition package offerings, session allowances, validity periods, and pricing.
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Included Sessions</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead>Tuition Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-bold text-slate-900">
                  <div className="flex items-center gap-2">
                    <PackageIcon className="w-4 h-4 text-indigo-600" />
                    <span>{p.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs font-semibold text-slate-700">{p.code}</TableCell>
                <TableCell className="text-xs font-semibold text-slate-800">{p.totalSessions} sessions</TableCell>
                <TableCell className="text-xs text-slate-600">{p.validityDays} days</TableCell>
                <TableCell className="text-xs font-bold text-slate-900">
                  {formatCurrency(p.price, p.currency)}
                </TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? 'success' : 'neutral'} size="sm" dot>
                    {p.isActive ? 'Active' : 'Archived'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={p.provenance === 'CLASSCARD_SOURCED' ? 'purple' : 'neutral'} size="sm">
                    {p.provenance === 'CLASSCARD_SOURCED' ? 'Classcard' : 'Local'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
