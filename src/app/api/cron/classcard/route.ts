import { NextRequest, NextResponse } from 'next/server';
import { getEncryptedSecret } from '../../../../lib/db/secure-storage';
import { prisma } from '../../../../lib/db/prisma';
import { upsertClasscardEventRecord } from '../../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const requestSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!configuredSecret || requestSecret !== configuredSecret) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  const configText = await getEncryptedSecret('classcard.config');
  if (!configText) return NextResponse.json({ success: true, skipped: true, reason: 'Classcard integration is not configured.' });
  const settings = JSON.parse(configText) as { baseUrl: string; apiKey: string; enabled?: boolean; syncIntervalMinutes?: number; lastAutomaticSyncAt?: string };
  if (!settings.enabled) return NextResponse.json({ success: true, skipped: true, reason: 'Automatic sync is disabled.' });
  if (settings.lastAutomaticSyncAt && Date.now() - new Date(settings.lastAutomaticSyncAt).getTime() < (settings.syncIntervalMinutes || 60) * 60_000) {
    return NextResponse.json({ success: true, skipped: true, reason: 'Sync interval has not elapsed.' });
  }
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  const toDate = (date: Date) => date.toISOString().slice(0, 10);
  const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/events?start=${toDate(start)}&end=${toDate(now)}`, { headers: { Accept: 'application/json', 'api-key': settings.apiKey }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return NextResponse.json({ success: false, error: `Classcard API returned ${response.status}.` }, { status: 502 });
  const payload = await response.json() as unknown;
  const rows = Array.isArray(payload) ? payload : (payload && typeof payload === 'object' && Array.isArray((payload as { events?: unknown[] }).events) ? (payload as { events: unknown[] }).events : []);
  let saved = 0;
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const event = item as Record<string, unknown>;
    const externalId = String(event.id || '').trim();
    const startTime = new Date(String(event.start || ''));
    const endTime = new Date(String(event.end || ''));
    if (!externalId || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) continue;
    const staffId = String(event.organizer || '').replace(/^0+/, '');
    const mentor = staffId ? await prisma.mentor.findFirst({ where: { externalId: staffId }, select: { id: true } }) : null;
    await upsertClasscardEventRecord({ externalId, mentorId: mentor?.id, classcardStaffId: staffId, subjectName: String(event.subjectName || ''), subjectExternalId: String(event.subject_id || ''), locationName: String(event.locationName || ''), startTime, endTime, attendanceStatus: String(event.attendance_status || ''), rawPayload: JSON.parse(JSON.stringify(event)) });
    saved++;
  }
  await prisma.encryptedSecret.update({ where: { name: 'classcard.config' }, data: { ciphertext: (await import('../../../../lib/db/secure-storage')).encryptSecret(JSON.stringify({ ...settings, lastAutomaticSyncAt: now.toISOString() })) } });
  await prisma.syncJob.create({ data: { id: crypto.randomUUID(), jobType: 'EVENTS_AUTOMATIC', status: 'COMPLETED', startedAt: now, completedAt: new Date(), recordsProcessed: rows.length, recordsCreated: saved, recordsUpdated: 0, recordsFailed: rows.length - saved, logSummary: [`Automatic Classcard event sync saved ${saved} of ${rows.length} records.`] } });
  return NextResponse.json({ success: true, fetched: rows.length, saved });
}
