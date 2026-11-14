import type { Employee } from "@prisma/client";
import type { CurrentUser } from "../types/auth";
import { prisma } from "../db/prisma";

/**
 * Resolves the Employee record that belongs to a signed-in account.
 *
 * A user can be created before the employee record is explicitly connected.
 * In that case, an exact work-email match is safe because both User.email and
 * Employee.email are unique. We only repair a blank link; another user's
 * existing link is never replaced.
 */
export async function resolveEmployeeForUser(
  user: CurrentUser | undefined,
): Promise<Employee | null> {
  if (!user) return null;

  if (user.employeeId) {
    const linkedEmployee = await prisma.employee.findUnique({
      where: { id: user.employeeId },
    });
    if (linkedEmployee) return linkedEmployee;
  }

  const directlyLinkedEmployee = await prisma.employee.findUnique({
    where: { userId: user.id },
  });
  if (directlyLinkedEmployee) return directlyLinkedEmployee;

  const mentorEmail = user.mentorId
    ? (
        await prisma.mentor.findUnique({
          where: { id: user.mentorId },
          select: { email: true },
        })
      )?.email
    : undefined;
  const candidateEmails = [...new Set([user.email, mentorEmail]
    .filter((email): email is string => Boolean(email))
    .map((email) => email.trim().toLowerCase()))];

  for (const email of candidateEmails) {
    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) continue;
    if (employee.userId === user.id) return employee;
    if (!employee.userId) {
      return prisma.employee.update({
        where: { id: employee.id },
        data: { userId: user.id },
      });
    }
  }

  return null;
}

export async function employeeLinkDiagnostics(user: CurrentUser | undefined) {
  const mentorEmail = user?.mentorId
    ? (
        await prisma.mentor.findUnique({
          where: { id: user.mentorId },
          select: { email: true },
        })
      )?.email
    : undefined;
  return {
    accountEmail: user?.email || null,
    mentorEmail: mentorEmail || null,
    reason: "No Employee Record was found for this signed-in account's work email.",
  };
}
