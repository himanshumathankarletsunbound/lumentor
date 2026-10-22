import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';

export async function GET(req: NextRequest) {
  try {
    await ensureServerPersistence();
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Database initialization failed.' }, { status: 503 });
  }
  const denied = await authorizationErrorAsync(req, 'settings', 'view');
  if (denied) return denied;
  try {
    db.reloadIfModified();
    const orgSettings = db.getOrgSettings();
    return NextResponse.json({ success: true, orgSettings });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch organization settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureServerPersistence();
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Database initialization failed.' }, { status: 503 });
  }
  const denied = await authorizationErrorAsync(req, 'settings', 'manage_settings');
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    db.reloadIfModified();

    const orgName = String(body.orgName || '').trim();
    const currency = String(body.currency || 'INR').trim();
    const timezone = String(body.timezone || 'America/New_York').trim();
    const cutoffDay = Number(body.cutoffDay) || 15;

    const updated = db.saveOrgSettings({
      orgName: orgName || undefined,
      currency,
      timezone,
      cutoffDay,
    });

    db.logAudit({
      userId: 'user-admin',
      userName: 'Administrator',
      userRole: 'ADMINISTRATOR',
      action: 'ORG_SETTINGS_UPDATED',
      entityType: 'OrganizationSettings',
      entityId: 'org-settings',
      details: `Updated organizational preferences (Name: ${updated.orgName}, Currency: ${currency})`,
    });

    return NextResponse.json({
      success: true,
      orgSettings: updated,
      message: 'Organization preferences saved successfully.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to save organization settings' },
      { status: 500 }
    );
  }
}
