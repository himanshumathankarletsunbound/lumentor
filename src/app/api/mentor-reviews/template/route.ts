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
  const headers = ['Mentor ID', 'Mentor Name', 'Audit Rating', 'Operations Rating', 'Remark'];
  const rows = mentors.map((mentor) => [
    mentor.id,
    `${mentor.firstName} ${mentor.lastName}`.trim(),
    '',
    2,
    '',
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 45 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mentor Ratings');
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new NextResponse(output, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="mentor-rating-template.xlsx"' } });
}
