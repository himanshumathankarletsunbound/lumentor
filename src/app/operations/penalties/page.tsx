'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Button } from '../../../components/ui/Button';
import { Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { PenaltyModal } from '../../../components/payroll/PenaltyModal';
import { Penalty } from '../../../lib/types/payroll';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';
import { Plus } from 'lucide-react';

export default function SubmitPenaltiesPage() {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = async () => {
    const response = await fetch('/api/penalties');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to load penalties.');
    setPenalties(result);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh().catch(console.error), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Submit Penalties</h1>
            <p className="text-xs text-slate-500 mt-1">Submit operational violations for administrative review.</p>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            Submit Penalty
          </Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Mentor</TableHead><TableHead>Violation Category</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
          <TableBody>
            {penalties.length === 0 ? <TableRow><TableCell colSpan={5}><TableEmptyState title="No penalties submitted" description="Submit a penalty to start the review workflow." /></TableCell></TableRow> :
              penalties.map((penalty) => <TableRow key={penalty.id}><TableCell className="font-semibold">{penalty.mentorName}</TableCell><TableCell><Badge variant="neutral" size="sm">{penalty.category}</Badge></TableCell><TableCell className="font-semibold text-rose-600">-{formatCurrency(penalty.amount)}</TableCell><TableCell><Badge variant="warning" size="sm">{penalty.status}</Badge></TableCell><TableCell className="text-xs text-slate-500">{formatDate(penalty.createdAt)}</TableCell></TableRow>)}
          </TableBody>
        </Table>
        <PenaltyModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => void refresh()} />
      </div>
    </AppShell>
  );
}
