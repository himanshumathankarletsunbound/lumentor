import { NextRequest, NextResponse } from "next/server";
import {
  generateResetToken,
  hashPassword,
} from "../../../../../lib/auth/crypto";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../../../lib/auth/server";
import { ensureServerPersistence } from "../../../../../lib/db/server-initialization";
import {
  findUserByEmail,
  listRoles,
  saveUser,
} from "../../../../../lib/db/state-repository";
import { sendPasswordSetupEmail } from "../../../../../lib/email/service";
import { prisma } from "../../../../../lib/db/prisma";
import type { CurrentUser } from "../../../../../lib/types/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "employee_records", "view");
  if (denied) return denied;
  const { employeeId } = await params;
  const user = await prisma.user.findFirst({
    where: { employee: { id: employeeId } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
    },
  });
  return NextResponse.json({ success: true, user });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "employee_records", "edit");
  if (denied) return denied;
  const actor = await getSessionUserAsync(req);
  const { employeeId } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });
  if (!employee)
    return NextResponse.json(
      { success: false, error: "Employee not found." },
      { status: 404 },
    );

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    password?: string;
    confirmPassword?: string;
  };
  const mode = body.mode || "invite";
  if (!["invite", "password"].includes(mode))
    return NextResponse.json(
      { success: false, error: "Choose invitation or password setup." },
      { status: 400 },
    );
  if (
    mode === "password" &&
    (!body.password ||
      body.password.length < 8 ||
      body.password !== body.confirmPassword)
  )
    return NextResponse.json(
      {
        success: false,
        error: "Password must be at least 8 characters and match confirmation.",
      },
      { status: 400 },
    );
  const existingUser = await findUserByEmail(employee.email);
  if (existingUser) {
    if (existingUser.employeeId && existingUser.employeeId !== employeeId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This work email is already linked to another employee record.",
        },
        { status: 409 },
      );
    }
    if (!existingUser.mentorId && existingUser.role !== "EMPLOYEE") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This work email belongs to a non-employee platform account and cannot be linked automatically.",
        },
        { status: 409 },
      );
    }
    await prisma.employee.update({
      where: { id: employeeId },
      data: { userId: existingUser.id },
    });
    await prisma.auditEvent.create({
      data: {
        userId: actor?.id || existingUser.id,
        action: "EMPLOYEE_USER_LINKED",
        entityType: "Employee",
        entityId: employeeId,
        details: `Linked existing portal user ${existingUser.email} to employee record.`,
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

  const role = (await listRoles()).find(
    (item) => item.systemRole === "EMPLOYEE",
  );
  const user: CurrentUser = {
    id: `user-${Date.now()}`,
    name: `${employee.firstName} ${employee.lastName}`.trim(),
    email: employee.email,
    role: "EMPLOYEE",
    roleName: role?.name || "Employee",
    permissions: role?.permissions || [],
    assignedBranchIds: employee.branchId ? [employee.branchId] : [],
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
  await prisma.employee.update({
    where: { id: employeeId },
    data: { userId: saved.id },
  });
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
          error: `User created, but the invitation email was not sent: ${email.error || "email service unavailable"}`,
          user: {
            id: saved.id,
            name: saved.name,
            email: saved.email,
            status: saved.status,
          },
        },
        { status: 503 },
      );
  }
  await prisma.auditEvent.create({
    data: {
      userId: actor?.id || saved.id,
      action: "EMPLOYEE_USER_CREATED",
      entityType: "Employee",
      entityId: employeeId,
      details: `Created employee portal user ${saved.email} using ${mode} mode.`,
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
