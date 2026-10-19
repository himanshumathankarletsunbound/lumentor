import { NextResponse } from 'next/server';
import { classcardClient } from '../../../../lib/integrations/classcard/client';

export async function POST() {
  try {
    const result = await classcardClient.testConnection();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message: `Connection test error: ${errorMsg}`, isMock: false },
      { status: 500 }
    );
  }
}
