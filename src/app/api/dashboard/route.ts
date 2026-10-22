import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';
import { enforceRateLimit } from '../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';

export async function GET(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, { limit: 60, windowSeconds: 60, identifierPrefix: 'dashboard-get' });
  if (rateLimitError) return rateLimitError;

  try {
    await ensureServerPersistence();
    const denied = await authorizationErrorAsync(req, 'overview', 'view');
    if (denied) return denied;
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId') || undefined;

    // Ensure store is fresh from disk
    db.reloadIfModified();

    const branches = db.getBranches();
    const mentors = db.getMentors(branchId);
    const students = db.getStudents(branchId);
    const classes = db.getClasses({ branchId });
    const penalties = db.getPenalties();
    const batches = db.getPayrollBatches();
    const syncJobs = db.getSyncJobs();
    const auditLogs = db.getAuditLogs(10);
    const payslips = db.getPayslips();
    const invoices = db.getInvoices();
    const payments = db.getPayments();
    const classcardConfig = db.getClasscardConfig();

    // Aggregations
    const totalStudents = students.length;
    const classcardSyncedStudents = students.filter((s) => s.provenance === 'CLASSCARD_SOURCED').length;
    const activeMentors = mentors.filter((m) => m.status === 'ACTIVE').length;
    const totalClasses = classes.length;
    const completedClasses = classes.filter((c) => c.status === 'COMPLETED').length;
    const totalInvoices = invoices.length;
    const totalRevenue = payments.reduce((acc, p) => acc + (p.status === 'SUCCESS' ? p.amount : 0), 0);
    const totalPayrollExpenditure = batches.reduce((acc, b) => acc + b.totalNet, 0);

    return NextResponse.json({
      success: true,
      data: {
        branches,
        mentors,
        students,
        classes,
        penalties,
        batches,
        syncJobs,
        auditLogs,
        payslips,
        invoices,
        payments,
        classcardConfig: {
          ...classcardConfig,
          apiKey: classcardConfig.apiKey
            ? `${classcardConfig.apiKey.slice(0, 8)}••••••••${classcardConfig.apiKey.slice(-4)}`
            : '',
        },
        stats: {
          totalStudents,
          classcardSyncedStudents,
          activeMentors,
          totalClasses,
          completedClasses,
          totalInvoices,
          totalRevenue,
          totalPayrollExpenditure,
        },
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
