import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db/prisma";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../lib/auth/server";

const approvedStatuses = ["APPROVED", "LOCKED", "PAID"] as const;

type EmployeePayrollInput = {
  variablePercent?: unknown;
  variableAmount?: unknown;
  additionalPayment?: unknown;
};

function nonNegativeNumber(value: unknown, field: string): number {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }
  return number;
}

export async function POST(req: NextRequest) {
  const denied = await authorizationErrorAsync(
    req,
    "payroll_processing",
    "create",
  );
  if (denied) return denied;
  const { month, lines = {}, draft = false } = await req.json();
  if (!/^\d{4}-\d{2}$/.test(month || ""))
    return NextResponse.json(
      { error: "Choose a valid month." },
      { status: 400 },
    );

  const existingBatch = await prisma.employeePayrollBatch.findUnique({
    where: { month },
    select: { status: true },
  });
  if (
    existingBatch &&
    ["APPROVED", "LOCKED", "PAID"].includes(existingBatch.status)
  ) {
    return NextResponse.json(
      {
        error:
          "This employee payroll batch is already approved or paid and cannot be recalculated.",
      },
      { status: 409 },
    );
  }

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
  let create;
  try {
    create = staff.map((employee) => {
      const attendance = employee.monthlyAttendance[0];
      const totalWorkingDays = attendance?.totalWorkingDays || 30;
      const daysWorked = Math.min(
        totalWorkingDays,
        Math.max(0, attendance?.daysWorked || 0),
      );
      const input = (lines[employee.id] || {}) as EmployeePayrollInput;
      const variablePercent = nonNegativeNumber(
        input.variablePercent,
        "Variable percentage",
      );
      if (variablePercent > 100) {
        throw new Error("Variable percentage cannot exceed 100.");
      }
      const variableAmount = nonNegativeNumber(
        input.variableAmount,
        "Variable amount",
      );
      const additionalPayment = nonNegativeNumber(
        input.additionalPayment,
        "Additional payment",
      );
      const fixedSalary = Number(employee.fixedPay);
      const variablePay = Math.round(
        (fixedSalary * variablePercent) / 100 + variableAmount,
      );
      const beforeTds = Math.round(
        (daysWorked / totalWorkingDays) * fixedSalary -
          variablePay -
          additionalPayment,
      );
      const tdsAmount = employee.tdsEnabled
        ? Math.round(
            (Math.max(0, beforeTds) * Number(employee.tdsPercent || 0)) / 100,
          )
        : 0;
      return {
        employeeId: employee.id,
        totalWorkingDays,
        daysWorked,
        leaveDays: totalWorkingDays - daysWorked,
        fixedSalary,
        variablePercent,
        variableAmount,
        additionalPayment,
        tdsPercent: employee.tdsEnabled
          ? Number(employee.tdsPercent || 0)
          : null,
        tdsAmount,
        variablePay,
        totalPayable: Math.max(0, beforeTds - tdsAmount),
      };
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid payroll values.",
      },
      { status: 400 },
    );
  }
  const batch = await prisma.employeePayrollBatch.upsert({
    where: { month },
    update: {
      status: draft ? "DRAFT" : "SUBMITTED",
      submittedAt: draft ? null : new Date(),
      approvedAt: null,
      approvedBy: null,
      lines: { deleteMany: {}, create },
    },
    create: {
      month,
      status: draft ? "DRAFT" : "SUBMITTED",
      submittedAt: draft ? null : new Date(),
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
