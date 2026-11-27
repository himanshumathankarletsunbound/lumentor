import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "../../../lib/rate-limit/limiter";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../lib/auth/server";
import { ensureServerPersistence } from "../../../lib/db/server-initialization";
import { createPenalty, listPenalties } from "../../../lib/db/state-repository";
import { prisma } from "../../../lib/db/prisma";
import { normalizePenaltyCategory } from "../../../lib/payroll/penalty-category";

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "penalties", "view");
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, {
    limit: 60,
    windowSeconds: 60,
    identifierPrefix: "penalties-get",
  });
  if (rateLimitError) return rateLimitError;

  const searchParams = req.nextUrl.searchParams;
  const mentorId = searchParams.get("mentorId") || undefined;
  const penalties = await listPenalties(mentorId);
  return NextResponse.json(penalties);
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "penalties", "create");
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, {
    limit: 20,
    windowSeconds: 60,
    identifierPrefix: "penalties-post",
  });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const {
      mentorId,
      branchId,
      category,
      reason,
      amount,
      evidenceNote,
      approveImmediately,
      policyId,
    } = body;

    if (!reason || !amount || !mentorId || !branchId) {
      return NextResponse.json(
        { error: "Missing mandatory fields" },
        { status: 400 },
      );
    }

    const user = await getSessionUserAsync(req);
    if (approveImmediately && user?.role !== "ADMINISTRATOR") {
      return NextResponse.json(
        { error: "Only administrators can add an approved payroll deduction." },
        { status: 403 },
      );
    }
    const policy = policyId
      ? await prisma.penaltyPolicy.findUnique({ where: { id: String(policyId) } })
      : null;
    if (policyId && (!policy || !policy.isActive)) {
      return NextResponse.json(
        { error: "The selected penalty type is unavailable." },
        { status: 400 },
      );
    }
    const pen = await createPenalty({
      mentorId,
      branchId,
      category: normalizePenaltyCategory(policy?.code, category, policy?.name, reason),
      reason,
      amount: parseFloat(amount),
      evidenceNote,
      createdBy: user?.id || "system",
      classId: body.classId,
      status: approveImmediately ? "APPROVED" : "SUBMITTED",
      approvedBy: approveImmediately ? user?.id : undefined,
      approvedAt: approveImmediately ? new Date() : undefined,
    });
    return NextResponse.json(pen);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

/** A payroll deduction is financial history, so removal is a reversal, not a destructive delete. */
export async function DELETE(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "penalties", "approve");
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, {
    limit: 15,
    windowSeconds: 60,
    identifierPrefix: "penalties-reverse",
  });
  if (rateLimitError) return rateLimitError;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const reason =
      searchParams.get("reason")?.trim() || "Removed during payroll review";
    if (!id)
      return NextResponse.json(
        { error: "Penalty ID is required." },
        { status: 400 },
      );
    const user = await getSessionUserAsync(req);
    if (!user)
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 },
      );
    const penalty = await prisma.$transaction(async (transaction) => {
      const item = await transaction.penalty.findUnique({ where: { id } });
      if (!item) throw new Error("Penalty was not found.");
      if (item.status !== "APPROVED")
        throw new Error(
          "Only an approved, unapplied penalty can be removed from this payout review.",
        );
      if (item.appliedPayrollBatchId)
        throw new Error(
          "This penalty is already part of a finalized payout and cannot be reversed here.",
        );
      await transaction.penalty.update({
        where: { id },
        data: {
          status: "REVERSED",
          reversedBy: user.id,
          reversedAt: new Date(),
          reversalReason: reason,
        },
      });
      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          action: "PAYROLL_PENALTY_REVERSED",
          entityType: "Penalty",
          entityId: id,
          details: `Reversed approved penalty before payroll finalization: ${reason}`,
        },
      });
      return item;
    });
    return NextResponse.json({ success: true, id: penalty.id });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unable to reverse penalty.",
      },
      { status: 400 },
    );
  }
}
