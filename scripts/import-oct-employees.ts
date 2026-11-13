import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
}

async function main() {
  const csv = readFileSync('Oct.csv', 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const parse = (line: string) => Array.from(line.matchAll(/(?:^|,)(?:"([^"]*)"|([^,]*))/g), (match) => (match[1] ?? match[2] ?? '').trim());
  const [, ...records] = csv.map(parse);
  const { prisma } = await import('../src/lib/db/prisma');
  let created = 0; let skipped = 0;
  for (const [firstName, lastName, emailRaw, daysWorkedRaw, stipendRaw, variableRaw] of records) {
    const email = emailRaw.toLowerCase();
    let employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) { employee = await prisma.employee.create({ data: { employeeCode: `LU-EMP-${new Date().getUTCFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`, firstName, lastName, email, fixedPay: Number(stipendRaw.replace(/[^0-9.-]/g, '')) || 0, variablePay: Number(variableRaw.replace(/[^0-9.-]/g, '')) || 0 } }); created++; } else skipped++;
    await prisma.employeeMonthlyAttendance.upsert({ where: { employeeId_month: { employeeId: employee.id, month: '2026-10' } }, update: { totalWorkingDays: 30, daysWorked: Number(daysWorkedRaw) || 0 }, create: { employeeId: employee.id, month: '2026-10', totalWorkingDays: 30, daysWorked: Number(daysWorkedRaw) || 0 } });
  }
  console.log(JSON.stringify({ records: records.length, created, skipped }));
  await prisma.$disconnect();
}
void main();
