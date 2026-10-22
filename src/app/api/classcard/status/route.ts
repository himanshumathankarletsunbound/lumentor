import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';
import { classcardClient } from '../../../../lib/integrations/classcard/client';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { requireServerSecret } from '../../../../lib/config/server';

export async function GET(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'classcard_integration', 'view');
  if (denied) return denied;
  const config = db.getClasscardConfig();
  // Return masked configuration to protect API key
  const maskedKey = config.apiKey
    ? `${config.apiKey.slice(0, 8)}••••••••${config.apiKey.slice(-4)}`
    : '';

  return NextResponse.json({
    baseUrl: config.baseUrl,
    maskedApiKey: maskedKey,
    isConfigured: config.isConfigured,
    useMockMode: config.useMockMode,
    lastSuccessfulSync: config.lastSuccessfulSync,
    lastFailedSync: config.lastFailedSync,
    lastErrorMessage: config.lastErrorMessage,
    syncIntervalMinutes: config.syncIntervalMinutes,
    endpointsCount: db.getClasscardEndpoints().length,
  });
}

export async function POST(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'classcard_integration', 'manage_settings');
  if (denied) return denied;
  try {
    requireServerSecret('CLASSCARD_API_KEY');

    // Test the new credentials immediately
    const testResult = await classcardClient.testConnection();

    return NextResponse.json({
      success: true,
      testResult,
      message: 'Classcard credentials are configured through the server environment.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Failed to update Classcard configuration: ${errorMsg}` },
      { status: 500 }
    );
  }
}
