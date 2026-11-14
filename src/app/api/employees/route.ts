import { NextRequest, NextResponse } from "next/server";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../lib/auth/server";
import { prisma } from "../../../lib/db/prisma";
import { ensureServerPersistence } from "../../../lib/db/server-initialization";
import { findUserByEmail } from "../../../lib/db/state-repository";

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "employee_records", "view");
  if (denied) return denied;
  const user = await getSessionUserAsync(req);
  const employees = await prisma.employee.findMany({
    where: user?.role === "EMPLOYEE" ? { userId: user.id } : undefined,
    include: { branch: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return NextResponse.json({ success: true, employees });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(
    req,
    "employee_records",
    "create",
  );
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!firstName || !lastName || !email.includes("@"))
    return NextResponse.json(
      {
        success: false,
        error: "First name, last name, and a valid email are required.",
      },
      { status: 400 },
    );
  if (
    await prisma.employee.findUnique({ where: { email }, select: { id: true } })
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "An employee record already exists for this work email.",
      },
      { status: 409 },
    );
  }
  if (body.login && (await findUserByEmail(email))) {
    return NextResponse.json(
      {
        success: false,
        error:
          "A platform user already exists for this work email. Create the employee without portal access, then review the existing account.",
      },
      { status: 409 },
    );
  }
  try {
    const employeeCode = `LU-EMP-${new Date().getUTCFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        firstName,
        lastName,
        email,
        phone: String(body.phone || "").trim() || null,
        department: String(body.department || "").trim() || null,
        jobTitle: String(body.jobTitle || "").trim() || null,
        branchId: body.branchId || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        fixedPay: Number(body.fixedPay || 0),
        variablePay: Number(body.variablePay || 0),
        tdsEnabled: Boolean(body.tdsEnabled),
        tdsPercent: body.tdsEnabled ? Number(body.tdsPercent || 0) : null,
      },
      include: { branch: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, employee }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to create employee.",
      },
      { status: 400 },
    );
  }
}
