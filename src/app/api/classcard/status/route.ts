import { NextRequest, NextResponse } from 'next/server';
import { classcardClient } from '../../../../lib/integrations/classcard/client';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { requireServerSecret, isDemoMode } from '../../../../lib/config/server';
import { CLASSCARD_ENDPOINTS_REGISTRY } from '../../../../lib/db/seedData';

export async function GET(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'classcard_integration', 'view');
  if (denied) return denied;
  const apiKey = process.env.CLASSCARD_API_KEY?.trim() || '';
  const baseUrl = process.env.CLASSCARD_BASE_URL?.trim() || 'https://api.classcardapp.com/api/v2/public/';
  // Return masked configuration to protect API key
  const maskedKey = apiKey
    ? `${apiKey.slice(0, 8)}••••••••${apiKey.slice(-4)}`
    : '';

  return NextResponse.json({
    baseUrl,
    maskedApiKey: maskedKey,
    isConfigured: Boolean(apiKey),
    useMockMode: isDemoMode,
    endpointsCount: CLASSCARD_ENDPOINTS_REGISTRY.length,
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
