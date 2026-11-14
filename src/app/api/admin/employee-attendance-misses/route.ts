import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db/prisma';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
export async function GET(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'employee_records', 'view'); if (denied) return denied;
  const misses = await prisma.employeeAttendance.findMany({ where: { status: 'MISSED' }, include: { employee: true }, orderBy: { date: 'desc' } });
  return NextResponse.json({ success: true, misses });
}
export async function PATCH(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'employee_records', 'edit'); if (denied) return denied;
  const { id, action } = await req.json();
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  return NextResponse.json(await prisma.employeeAttendance.update({ where: { id }, data: { status: action === 'approve' ? 'EXCUSED' : 'REJECTED' } }));
}
