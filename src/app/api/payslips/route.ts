import { NextRequest, NextResponse } from "next/server";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../lib/auth/server";
import { ensureServerPersistence } from "../../../lib/db/server-initialization";
import { listPayslips } from "../../../lib/db/state-repository";

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req);
  if (denied) return denied;
  const user = await getSessionUserAsync(req);
  const requestedMentorId =
    req.nextUrl.searchParams.get("mentorId") || undefined;
  const mentorId = user?.mentorId || requestedMentorId;
  if (user?.mentorId && !mentorId) {
    return NextResponse.json({ success: true, payslips: [] });
  }
  return NextResponse.json({
    success: true,
    payslips: await listPayslips(mentorId),
  });
}
