import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';
import { classcardClient } from '../../../../lib/integrations/classcard/client';

export async function GET() {
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
  try {
    const body = await req.json().catch(() => ({}));
    const { apiKey, baseUrl } = body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'A valid API key must be provided.' },
        { status: 400 }
      );
    }

    const cleanKey = apiKey.trim();
    const cleanBaseUrl = (baseUrl && typeof baseUrl === 'string' && baseUrl.trim().length > 0)
      ? baseUrl.trim()
      : 'https://api.classcardapp.com/api/v2/public/';

    // Update server-side persistent database
    db.updateClasscardConfig({
      apiKey: cleanKey,
      baseUrl: cleanBaseUrl,
      isConfigured: true,
      useMockMode: false,
    });

    // Also update runtime process.env if applicable
    process.env.CLASSCARD_API_KEY = cleanKey;

    // Test the new credentials immediately
    const testResult = await classcardClient.testConnection();

    return NextResponse.json({
      success: true,
      testResult,
      maskedApiKey: `${cleanKey.slice(0, 8)}••••••••${cleanKey.slice(-4)}`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Failed to update Classcard configuration: ${errorMsg}` },
      { status: 500 }
    );
  }
}

