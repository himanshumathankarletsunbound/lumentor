import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  generateResetToken,
} from "../../../../../lib/auth/crypto";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../../../lib/auth/server";
import { ensureServerPersistence } from "../../../../../lib/db/server-initialization";
import {
  findUserByEmail,
  listMentors,
  listRoles,
  saveUser,
} from "../../../../../lib/db/state-repository";
import { sendPasswordSetupEmail } from "../../../../../lib/email/service";
import { prisma } from "../../../../../lib/db/prisma";
import type { CurrentUser } from "../../../../../lib/types/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mentorId: string }> },
) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "mentors", "view");
  if (denied) return denied;
  const { mentorId } = await params;
  const [user, mentor] = await Promise.all([
    prisma.user.findUnique({
      where: { mentorId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.mentor.findUnique({
      where: { id: mentorId },
      select: { email: true },
    }),
  ]);
  const matchingAccount =
    !user && mentor
      ? await prisma.user.findUnique({
          where: { email: mentor.email.toLowerCase() },
          include: { employee: { select: { id: true, employeeCode: true } } },
        })
      : null;
  const linkableUser =
    matchingAccount && matchingAccount.employee && !matchingAccount.mentorId
      ? {
          id: matchingAccount.id,
          name: matchingAccount.name,
          email: matchingAccount.email,
          employeeCode: matchingAccount.employee.employeeCode,
        }
      : null;
  const activity = user
    ? await prisma.auditEvent.findMany({
        where: { userId: user.id },
        orderBy: { timestamp: "desc" },
        take: 25,
        select: { id: true, action: true, details: true, timestamp: true },
      })
    : [];
  return NextResponse.json({ success: true, user, activity, linkableUser });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mentorId: string }> },
) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "mentors", "edit");
  if (denied) return denied;
  const actor = await getSessionUserAsync(req);
  const { mentorId } = await params;
  const mentor = (await listMentors()).find((item) => item.id === mentorId);
  if (!mentor)
    return NextResponse.json(
      { success: false, error: "Mentor not found." },
      { status: 404 },
    );
  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    password?: string;
    confirmPassword?: string;
  };
  const mode = body.mode || "invite";
  if (!["invite", "password", "link"].includes(mode))
    return NextResponse.json(
      { success: false, error: "Choose invitation or password setup." },
      { status: 400 },
    );
  if (
    mode === "password" &&
    (!body.password ||
      body.password.length < 8 ||
      body.password !== body.confirmPassword)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Password must be at least 8 characters and match confirmation.",
      },
      { status: 400 },
    );
  }
  const existingUser = await findUserByEmail(mentor.email);
  if (existingUser) {
    if (existingUser.mentorId && existingUser.mentorId !== mentorId)
      return NextResponse.json(
        {
          success: false,
          error: "This work email is already linked to another mentor record.",
        },
        { status: 409 },
      );
    if (!existingUser.employeeId && existingUser.role !== "MENTOR")
      return NextResponse.json(
        {
          success: false,
          error:
            "This work email belongs to a non-mentor platform account and cannot be linked automatically.",
        },
        { status: 409 },
      );
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { mentorId },
    });
    await prisma.auditEvent.create({
      data: {
        userId: actor?.id || existingUser.id,
        action: "MENTOR_USER_LINKED",
        entityType: "Mentor",
        entityId: mentorId,
        details: `Linked existing portal user ${existingUser.email} to mentor record.`,
      },
    });
    return NextResponse.json({
      success: true,
      linkedExistingUser: true,
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        status: existingUser.status,
      },
    });
  }
  if (mode === "link")
    return NextResponse.json(
      {
        success: false,
        error:
          "No existing Employee Portal account was found for this work email.",
      },
      { status: 404 },
    );
  const mentorRole = (await listRoles()).find(
    (role) => role.systemRole === "MENTOR",
  );
  const user: CurrentUser = {
    id: `user-${Date.now()}`,
    email: mentor.email,
    name: `${mentor.firstName} ${mentor.lastName}`.trim(),
    role: "MENTOR",
    roleName: mentorRole?.name || "Mentor",
    permissions: mentorRole?.permissions || [],
    assignedBranchIds: [mentor.branchId],
    mentorId,
    status: mode === "invite" ? "SENT_PASSWORD_VERIFICATION" : "ACTIVE",
    passwordHash: "",
    salt: "",
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let setupUrl: string | undefined;
  if (mode === "invite") {
    const token = generateResetToken(1440);
    user.resetToken = token.token;
    user.resetTokenExpiry = token.expiresAt;
    setupUrl = `${req.nextUrl.origin}/reset-password?token=${encodeURIComponent(token.token)}`;
  } else {
    const hashed = hashPassword(body.password || "");
    user.passwordHash = hashed.hash;
    user.salt = hashed.salt;
  }
  const saved = await saveUser(user);
  if (setupUrl) {
    const email = await sendPasswordSetupEmail(
      saved.email,
      saved.name,
      setupUrl,
    );
    if (!email.success)
      return NextResponse.json(
        {
          success: false,
          error: `User created, but the welcome email was not sent: ${email.error || "email service unavailable"}`,
          user: { id: saved.id, email: saved.email },
        },
        { status: 503 },
      );
  }
  await prisma.auditEvent.create({
    data: {
      userId: actor?.id || saved.id,
      action: "MENTOR_USER_CREATED",
      entityType: "Mentor",
      entityId: mentorId,
      details: `Created mentor portal user ${saved.email} using ${mode} mode.`,
    },
  });
  return NextResponse.json({
    success: true,
    user: {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      status: saved.status,
    },
    setupUrl,
  });
}
