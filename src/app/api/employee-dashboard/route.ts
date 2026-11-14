import { NextRequest, NextResponse } from "next/server";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../lib/auth/server";
import { prisma } from "../../../lib/db/prisma";
import { ensureServerPersistence } from "../../../lib/db/server-initialization";

const approvedStatuses = ["APPROVED", "LOCKED", "PAID"] as const;

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  return { start, end };
}

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "employee_records", "view");
  if (denied) return denied;
  const user = await getSessionUserAsync(req);
  const employee = user?.employeeId
    ? await prisma.employee.findUnique({
        where: { id: user.employeeId },
        include: { leaveRequests: { orderBy: { createdAt: "desc" }, take: 5 } },
      })
    : user
      ? await prisma.employee.findUnique({
          where: { userId: user.id },
          include: {
            leaveRequests: { orderBy: { createdAt: "desc" }, take: 5 },
          },
        })
      : null;
  if (!employee)
    return NextResponse.json({
      success: true,
      employee: null,
      components: [],
      totalPayable: 0,
    });

  const requestedMonth =
    req.nextUrl.searchParams.get("month") ||
    new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(requestedMonth))
    return NextResponse.json(
      { success: false, error: "Month must use YYYY-MM." },
      { status: 400 },
    );
  const { start, end } = monthRange(requestedMonth);
  const mentorId = user?.mentorId;

  const [employeeLine, mentorLines, attendance] = await Promise.all([
    prisma.employeePayrollLine.findFirst({
      where: {
        employeeId: employee.id,
        batch: { month: requestedMonth, status: { in: [...approvedStatuses] } },
      },
      include: {
        batch: {
          select: { id: true, month: true, status: true, approvedAt: true },
        },
      },
      orderBy: { batch: { approvedAt: "desc" } },
    }),
    mentorId
      ? prisma.payrollLineItem.findMany({
          where: {
            mentorId,
            batch: {
              status: { in: [...approvedStatuses] },
              startDate: { gte: start, lt: end },
            },
          },
          include: {
            batch: {
              select: {
                id: true,
                periodName: true,
                status: true,
                approvedAt: true,
                startDate: true,
                endDate: true,
              },
            },
          },
          orderBy: { batch: { approvedAt: "desc" } },
        })
      : [],
    prisma.employeeAttendance.count({
      where: {
        employeeId: employee.id,
        date: { gte: start, lt: end },
        status: "PRESENT",
      },
    }),
  ]);

  const components = [
    ...(employeeLine
      ? [
          {
            type: "EMPLOYMENT" as const,
            label: "Employment salary",
            period: employeeLine.batch.month,
            status: employeeLine.batch.status,
            gross:
              Number(employeeLine.fixedSalary) -
              Number(employeeLine.variablePay),
            deductions: Number(employeeLine.tdsAmount),
            net: Number(employeeLine.totalPayable),
            details: {
              daysWorked: employeeLine.daysWorked,
              totalWorkingDays: employeeLine.totalWorkingDays,
              tdsApplied: employeeLine.tdsPercent !== null,
            },
          },
        ]
      : []),
    ...mentorLines.map((line) => ({
      type: "MENTOR" as const,
      label: "Mentor teaching payout",
      period: line.batch.periodName,
      status: line.batch.status,
      gross: Number(line.grossEarnings),
      deductions: Number(line.penaltyDeductions),
      net: Number(line.netPayable),
      details: {
        eligibleClasses: line.eligibleClassesCount,
        planName: line.planName,
      },
    })),
  ];
  const totalPayable = components.reduce(
    (total, component) => total + component.net,
    0,
  );
  return NextResponse.json({
    success: true,
    month: requestedMonth,
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      tdsEnabled: employee.tdsEnabled,
      tdsPercent: employee.tdsPercent,
      leaveRequests: employee.leaveRequests,
    },
    dualRole: Boolean(mentorId),
    attendance: {
      present: attendance,
      leave: employee.leaveRequests.filter((item) => item.status === "APPROVED")
        .length,
    },
    components,
    totalPayable,
    pendingMessage:
      components.length === 0
        ? "No approved employment salary or mentor payout is available for this month yet."
        : null,
  });
}
