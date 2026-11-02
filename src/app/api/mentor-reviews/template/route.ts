import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { listMentors } from '../../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'mentor_reviews', 'view');
  if (denied) return denied;
  const mentors = (await listMentors()).filter((mentor) => mentor.status === 'ACTIVE');
  const rows = mentors.map((mentor) => ({ 'Mentor ID': mentor.id, 'Mentor Name': `${mentor.firstName} ${mentor.lastName}`.trim(), 'Audit Rating': 2, Remark: '' }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 45 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mentor Ratings');
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new NextResponse(output, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="mentor-rating-template.xlsx"' } });
}
