import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { getOrganizationSettings, listBranches, listClasses, listDashboardFinance, listMentors, listPenalties, listStudents } from '../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, { limit: 60, windowSeconds: 60, identifierPrefix: 'dashboard-get' });
  if (rateLimitError) return rateLimitError;

  try {
    await ensureServerPersistence();
    const denied = await authorizationErrorAsync(req, 'overview', 'view');
    if (denied) return denied;
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId') || undefined;

    const [branches, mentors, students, classes, penalties, finance, orgSettings] = await Promise.all([
      listBranches(), listMentors(branchId), listStudents(branchId), listClasses({ branchId }), listPenalties(), listDashboardFinance(), getOrganizationSettings().catch(() => ({ orgName: 'LUmentor', currency: 'INR', timezone: 'America/New_York', cutoffDay: 15 })),
    ]);
    const { batches, syncJobs, auditLogs, payslips, invoices, payments } = finance;

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
        orgSettings,
        classcardConfig: { apiKey: '', configured: false },
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
