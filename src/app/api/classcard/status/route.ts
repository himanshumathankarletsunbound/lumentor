import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';

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
