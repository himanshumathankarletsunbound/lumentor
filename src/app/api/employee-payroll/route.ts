import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db/prisma";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../lib/auth/server";

const approvedStatuses = ["APPROVED", "LOCKED", "PAID"] as const;

export async function POST(req: NextRequest) {
  const denied = await authorizationErrorAsync(
    req,
    "payroll_processing",
    "create",
  );
  if (denied) return denied;
  const { month, lines = {} } = await req.json();
  if (!/^\d{4}-\d{2}$/.test(month || ""))
    return NextResponse.json(
      { error: "Choose a valid month." },
      { status: 400 },
    );

  const [year, monthNumber] = month.split("-").map(Number);
  const periodStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const periodEnd = new Date(Date.UTC(year, monthNumber, 1));
  const [staff, mentorLines] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      include: {
        monthlyAttendance: { where: { month } },
        user: { select: { mentorId: true } },
      },
    }),
    prisma.payrollLineItem.findMany({
      where: {
        batch: {
          status: { in: [...approvedStatuses] },
          startDate: { gte: periodStart, lt: periodEnd },
        },
      },
      select: { mentorId: true, netPayable: true },
    }),
  ]);
  const mentorPayoutByMentor = new Map<string, number>();
  mentorLines.forEach((line) =>
    mentorPayoutByMentor.set(
      line.mentorId,
      (mentorPayoutByMentor.get(line.mentorId) || 0) + Number(line.netPayable),
    ),
  );
  const create = staff.map((employee) => {
    const attendance = employee.monthlyAttendance[0];
    const totalWorkingDays = attendance?.totalWorkingDays || 30;
    const daysWorked = attendance?.daysWorked || 0;
    const variablePercent = Number(lines[employee.id]?.variablePercent || 0);
    const fixedSalary = Number(employee.fixedPay);
    const variablePay = (fixedSalary * variablePercent) / 100;
    const beforeTds = Math.round(
      (daysWorked / totalWorkingDays) * fixedSalary - variablePay,
    );
    const tdsAmount = employee.tdsEnabled
      ? Math.round((beforeTds * Number(employee.tdsPercent || 0)) / 100)
      : 0;
    return {
      employeeId: employee.id,
      totalWorkingDays,
      daysWorked,
      leaveDays: totalWorkingDays - daysWorked,
      fixedSalary,
      variablePercent,
      variableAmount: 0,
      additionalPayment: 0,
      tdsPercent: employee.tdsEnabled ? Number(employee.tdsPercent || 0) : null,
      tdsAmount,
      variablePay,
      totalPayable: beforeTds - tdsAmount,
    };
  });
  const batch = await prisma.employeePayrollBatch.upsert({
    where: { month },
    update: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      lines: { deleteMany: {}, create },
    },
    create: {
      month,
      status: "SUBMITTED",
      submittedAt: new Date(),
      lines: { create },
    },
    include: {
      lines: {
        include: {
          employee: { include: { user: { select: { mentorId: true } } } },
        },
      },
    },
  });
  return NextResponse.json({
    ...batch,
    lines: batch.lines.map((line) => ({
      ...line,
      mentorPayout: line.employee.user?.mentorId
        ? mentorPayoutByMentor.get(line.employee.user.mentorId) || 0
        : 0,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await authorizationErrorAsync(
    req,
    "payroll_processing",
    "approve",
  );
  if (denied) return denied;
  const { month } = await req.json();
  if (!/^\d{4}-\d{2}$/.test(month || "")) {
    return NextResponse.json(
      { error: "Choose a valid month." },
      { status: 400 },
    );
  }
  const actor = await getSessionUserAsync(req);
  const batch = await prisma.employeePayrollBatch.update({
    where: { month },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: actor?.id || null,
    },
  });
  return NextResponse.json({ success: true, batch });
}
