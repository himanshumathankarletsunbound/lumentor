import { NextRequest, NextResponse } from 'next/server';
import { runClasscardSync } from '../../../../lib/integrations/classcard/sync';
import { SyncJobType } from '../../../../lib/types/classcard';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobType: SyncJobType = body.jobType || 'ALL';
    const job = await runClasscardSync(jobType);
    return NextResponse.json(job);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
