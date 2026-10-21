import * as XLSX from 'xlsx';

export interface SheetSchema {
  student_id: string | null;
  student_name: string | null;
  subject: string | null;
  staff: string | null;
  staff_join_date: string | null;
  location: string | null;
  batch: string | null;
  status: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  fees: string | null;
  invoice_no: string | null;
  invoice_status: string | null;
  item_name: string | null;
  marked_by: string | null;
  marked_at: string | null;
}

export type AttendanceStatusBucket = 'Present' | 'Absent' | 'Late' | 'Left Early' | 'Unknown';
export type StudentRiskLevel = 'High Risk' | 'Watch' | 'Healthy';

export interface PreparedSheetRow {
  [key: string]: any;
  _date?: string; // YYYY-MM-DD
  _month?: string; // YYYY-MM
  _weekday?: string;
  _status_bucket: AttendanceStatusBucket;
  _fee_numeric?: number | null;
  _staff_join_date?: string | null;
  _duration_minutes?: number | null;
  _class_session_id: string;
}

export interface SheetKpis {
  records: number;
  students: number;
  staff: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number | null;
}

export interface StudentRiskRow {
  studentKey: string;
  studentName: string;
  studentId?: string;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  attendancePct: number | null;
  risk: StudentRiskLevel;
}

export interface TeacherWorkloadRow {
  staffName: string;
  classSessions: number;
  teachingHours: number;
  attendanceRecords: number;
  students: number;
  subjects: number;
  present: number;
  absent: number;
  late: number;
  studentAttendancePct: number | null;
  firstClassDate?: string | null;
  lastClassDate?: string | null;
  activeSpanDays?: number | null;
  joinDate?: string | null;
}

export interface ColumnQualityMetric {
  column: string;
  type: string;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
}

export interface DataQualityReport {
  totalRows: number;
  totalColumns: number;
  duplicateRows: number;
  cellCompletenessPct: number;
  columns: ColumnQualityMetric[];
}

// ---------------------------------------------------------
// Column Detection Utilities
// ---------------------------------------------------------

export function normCol(s: any): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findCol(columns: string[], candidates: string[]): string | null {
  const normalizedMap: Record<string, string> = {};
  for (const c of columns) {
    normalizedMap[normCol(c)] = c;
  }

  // Exact normalized match first
  for (const x of candidates) {
    const nx = normCol(x);
    if (normalizedMap[nx]) {
      return normalizedMap[nx];
    }
  }

  // Substring match fallback
  for (const c of columns) {
    const nc = normCol(c);
    for (const x of candidates) {
      const nx = normCol(x);
      if (nx && (nc.includes(nx) || nx.includes(nc))) {
        return c;
      }
    }
  }

  return null;
}

export function findExactCol(columns: string[], candidates: string[]): string | null {
  const normalizedMap: Record<string, string> = {};
  for (const c of columns) {
    normalizedMap[normCol(c)] = c;
  }
  for (const candidate of candidates) {
    const match = normalizedMap[normCol(candidate)];
    if (match) return match;
  }
  return null;
}

export function detectSchema(columns: string[]): SheetSchema {
  return {
    student_id: findCol(columns, ['Student ID', 'Student Id', 'Learner ID', 'Learner Id', 'StudentID', 'Enrollment ID']),
    student_name: findCol(columns, ['Student Name', 'Learner Name', 'Student', 'Learner', 'Student Full Name']),
    subject: findCol(columns, ['Subject', 'Course', 'Class', 'Program', 'Subject Name', 'Course Name']),
    staff: findCol(columns, ['Staff Name', 'Teacher Name', 'Tutor', 'Instructor', 'Staff', 'Mentor Name', 'Mentor', 'Faculty']),
    staff_join_date: findExactCol(columns, [
      'Teacher Join Date',
      'Teacher Joining Date',
      'Staff Join Date',
      'Staff Joining Date',
      'Instructor Join Date',
      'Date of Joining',
      'DOJ',
      'Joining Date',
      'Mentor Join Date',
    ]),
    location: findCol(columns, ['Location', 'Mode', 'Venue', 'Branch', 'Center', 'Campus']),
    batch: findCol(columns, ['Batch Name', 'Batch', 'Group', 'Cohort', 'Section']),
    status: findCol(columns, ['Status', 'Attendance Status', 'Attendance', 'AttendanceStatus']),
    date: findCol(columns, ['Date', 'Class Date', 'Session Date', 'Attendance Date', 'SessionDate']),
    start_time: findCol(columns, ['Start Time', 'Class Start Time', 'Session Start', 'StartTime']),
    end_time: findCol(columns, ['End Time', 'Class End Time', 'Session End', 'EndTime']),
    fees: findCol(columns, ['Fees', 'Fee', 'Amount', 'Price', 'Revenue', 'Cost', 'Tuition Fee']),
    invoice_no: findCol(columns, ['Invoice Number', 'Invoice No', 'Invoice #', 'InvoiceNo']),
    invoice_status: findCol(columns, ['Invoice Status', 'Payment Status', 'Billing Status', 'InvoiceStatus']),
    item_name: findCol(columns, ['Item Name', 'Item', 'Service', 'Plan Name', 'Package Name', 'Package']),
    marked_by: findCol(columns, ['Marked By', 'Created By', 'Taken By', 'Recorder']),
    marked_at: findCol(columns, ['Marked At', 'Created At', 'Updated At', 'Recorded At']),
  };
}

// ---------------------------------------------------------
// Parsers & Formatting Helpers
// ---------------------------------------------------------

export function parseMoney(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val)
    .replace(/,/g, '')
    .replace(/[₹$£€]/g, '')
    .trim();
  const match = s.match(/([-+]?\d*\.?\d+)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}

export function statusBucket(val: any): AttendanceStatusBucket {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s || s === 'nan' || s === 'null' || s === 'undefined') return 'Unknown';
  if (s.includes('absent')) return 'Absent';
  if (s.includes('late')) return 'Late';
  if (s.includes('left early') || s.includes('early')) return 'Left Early';
  if (s.includes('present') || s.includes('checked') || s.includes('check-in') || s.includes('check in')) return 'Present';
  return 'Unknown';
}

export function parseDurationMinutes(startTime: any, endTime: any): number | null {
  if (!startTime || !endTime) return null;
  const startStr = String(startTime).trim();
  const endStr = String(endTime).trim();

  // Try parsing simple HH:MM
  const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i;
  const startMatch = startStr.match(timeRegex);
  const endMatch = endStr.match(timeRegex);

  if (startMatch && endMatch) {
    let startH = parseInt(startMatch[1], 10);
    const startM = parseInt(startMatch[2], 10);
    const startAmPm = startMatch[4]?.toLowerCase();
    if (startAmPm === 'pm' && startH < 12) startH += 12;
    if (startAmPm === 'am' && startH === 12) startH = 0;

    let endH = parseInt(endMatch[1], 10);
    const endM = parseInt(endMatch[2], 10);
    const endAmPm = endMatch[4]?.toLowerCase();
    if (endAmPm === 'pm' && endH < 12) endH += 12;
    if (endAmPm === 'am' && endH === 12) endH = 0;

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    let diff = endTotal - startTotal;
    if (diff < 0) diff += 1440; // crosses midnight
    return diff;
  }

  // Fallback to Date object parsing
  const dStart = new Date(`2026-01-01 ${startStr}`);
  const dEnd = new Date(`2026-01-01 ${endStr}`);
  if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
    let diff = (dEnd.getTime() - dStart.getTime()) / 60000;
    if (diff < 0) diff += 1440;
    return diff;
  }

  return null;
}

export function classSessionId(row: any, schema: SheetSchema, index: number): string {
  const parts: string[] = [];
  if (schema.date && row[schema.date]) {
    parts.push(String(row[schema.date]).trim());
  }
  for (const key of ['start_time', 'end_time', 'subject', 'batch', 'location'] as (keyof SheetSchema)[]) {
    const col = schema[key];
    if (col && row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
      parts.push(String(row[col]).trim());
    }
  }
  if (parts.length === 0) {
    return `session-${index}`;
  }
  return parts.join(' | ');
}

// ---------------------------------------------------------
// Preparation Engine
// ---------------------------------------------------------

export function prepareSheetData(
  rawRows: Record<string, any>[],
  schema: SheetSchema
): PreparedSheetRow[] {
  return rawRows.map((row, idx) => {
    const prepared: PreparedSheetRow = {
      ...row,
      _status_bucket: schema.status ? statusBucket(row[schema.status]) : 'Unknown',
      _fee_numeric: schema.fees ? parseMoney(row[schema.fees]) : null,
      _class_session_id: classSessionId(row, schema, idx),
    };

    // Date normalization
    if (schema.date && row[schema.date]) {
      const d = new Date(row[schema.date]);
      if (!isNaN(d.getTime())) {
        prepared._date = d.toISOString().split('T')[0];
        prepared._month = prepared._date.slice(0, 7);
        prepared._weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
      }
    }

    // Staff Join Date
    if (schema.staff_join_date && row[schema.staff_join_date]) {
      const jd = new Date(row[schema.staff_join_date]);
      if (!isNaN(jd.getTime())) {
        prepared._staff_join_date = jd.toISOString().split('T')[0];
      }
    }

    // Duration Minutes
    if (schema.start_time && schema.end_time) {
      prepared._duration_minutes = parseDurationMinutes(row[schema.start_time], row[schema.end_time]);
    }

    return prepared;
  });
}

// ---------------------------------------------------------
// KPI & Metrics Calculations
// ---------------------------------------------------------

export function calculateKpis(rows: PreparedSheetRow[], schema: SheetSchema): SheetKpis {
  let present = 0;
  let absent = 0;
  let late = 0;

  const studentSet = new Set<string>();
  const staffSet = new Set<string>();

  const studentCol = schema.student_name || schema.student_id;
  const staffCol = schema.staff;

  for (const r of rows) {
    if (['Present', 'Late', 'Left Early'].includes(r._status_bucket)) present++;
    if (r._status_bucket === 'Absent') absent++;
    if (r._status_bucket === 'Late') late++;

    if (studentCol && r[studentCol] !== undefined && r[studentCol] !== null && String(r[studentCol]).trim() !== '') {
      studentSet.add(String(r[studentCol]).trim());
    }
    if (staffCol && r[staffCol] !== undefined && r[staffCol] !== null && String(r[staffCol]).trim() !== '') {
      staffSet.add(String(r[staffCol]).trim());
    }
  }

  const denominator = present + absent;
  const attendanceRate = denominator > 0 ? (present / denominator) * 100 : null;

  return {
    records: rows.length,
    students: studentSet.size,
    staff: staffSet.size,
    present,
    absent,
    late,
    attendanceRate,
  };
}

// ---------------------------------------------------------
// Student Risk Table Generator
// ---------------------------------------------------------

export function generateStudentTable(rows: PreparedSheetRow[], schema: SheetSchema): StudentRiskRow[] {
  const studentCol = schema.student_name || schema.student_id;
  if (!studentCol || !schema.status || rows.length === 0) return [];

  const map = new Map<string, {
    name: string;
    id?: string;
    total: number;
    present: number;
    absent: number;
    late: number;
  }>();

  for (const r of rows) {
    const rawVal = r[studentCol];
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') continue;
    const key = String(rawVal).trim();

    if (!map.has(key)) {
      map.set(key, {
        name: schema.student_name && r[schema.student_name] ? String(r[schema.student_name]).trim() : key,
        id: schema.student_id && r[schema.student_id] ? String(r[schema.student_id]).trim() : undefined,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
      });
    }

    const item = map.get(key)!;
    item.total++;
    if (['Present', 'Late', 'Left Early'].includes(r._status_bucket)) item.present++;
    if (r._status_bucket === 'Absent') item.absent++;
    if (r._status_bucket === 'Late') item.late++;
  }

  const result: StudentRiskRow[] = [];
  for (const [key, v] of map.entries()) {
    const denom = v.present + v.absent;
    const pct = denom > 0 ? (v.present / denom) * 100 : null;
    let risk: StudentRiskLevel = 'Healthy';
    if (pct === null || pct < 75) {
      risk = 'High Risk';
    } else if (pct < 90) {
      risk = 'Watch';
    }

    result.push({
      studentKey: key,
      studentName: v.name,
      studentId: v.id,
      totalRecords: v.total,
      present: v.present,
      absent: v.absent,
      late: v.late,
      attendancePct: pct,
      risk,
    });
  }

  // Sort lowest attendance first, highest absence secondary
  return result.sort((a, b) => {
    const rateA = a.attendancePct ?? 0;
    const rateB = b.attendancePct ?? 0;
    if (rateA !== rateB) return rateA - rateB;
    return b.absent - a.absent;
  });
}

// ---------------------------------------------------------
// Teacher Workload & Analytics Generator
// ---------------------------------------------------------

export function generateTeacherTable(
  filteredRows: PreparedSheetRow[],
  schema: SheetSchema,
  baselineRows?: PreparedSheetRow[]
): TeacherWorkloadRow[] {
  const staffCol = schema.staff;
  if (!staffCol || filteredRows.length === 0) return [];

  const baseline = baselineRows && baselineRows.length > 0 ? baselineRows : filteredRows;

  // Compute baseline dates per teacher
  const teacherDates = new Map<string, { firstDate: string; lastDate: string; joinDate?: string }>();
  for (const r of baseline) {
    const staffName = r[staffCol];
    if (!staffName) continue;
    const name = String(staffName).trim();
    const curr = teacherDates.get(name) || { firstDate: '9999', lastDate: '0000' };

    if (r._date) {
      if (r._date < curr.firstDate) curr.firstDate = r._date;
      if (r._date > curr.lastDate) curr.lastDate = r._date;
    }
    if (r._staff_join_date && !curr.joinDate) {
      curr.joinDate = r._staff_join_date;
    }
    teacherDates.set(name, curr);
  }

  // Group filtered rows by teacher
  const group = new Map<string, {
    sessions: Map<string, number | null>; // session_id -> duration
    attendanceRecords: number;
    students: Set<string>;
    subjects: Set<string>;
    present: number;
    absent: number;
    late: number;
  }>();

  const studentCol = schema.student_name || schema.student_id;
  const subjectCol = schema.subject;

  for (const r of filteredRows) {
    const staffName = r[staffCol];
    if (!staffName) continue;
    const name = String(staffName).trim();

    if (!group.has(name)) {
      group.set(name, {
        sessions: new Map(),
        attendanceRecords: 0,
        students: new Set(),
        subjects: new Set(),
        present: 0,
        absent: 0,
        late: 0,
      });
    }

    const t = group.get(name)!;
    t.attendanceRecords++;
    if (!t.sessions.has(r._class_session_id)) {
      t.sessions.set(r._class_session_id, r._duration_minutes || 60); // default 60 min if unspecified
    }

    if (['Present', 'Late', 'Left Early'].includes(r._status_bucket)) t.present++;
    if (r._status_bucket === 'Absent') t.absent++;
    if (r._status_bucket === 'Late') t.late++;

    if (studentCol && r[studentCol]) t.students.add(String(r[studentCol]).trim());
    if (subjectCol && r[subjectCol]) t.subjects.add(String(r[subjectCol]).trim());
  }

  const out: TeacherWorkloadRow[] = [];

  for (const [name, t] of group.entries()) {
    let totalMinutes = 0;
    for (const dur of t.sessions.values()) {
      totalMinutes += dur || 0;
    }

    const denom = t.present + t.absent;
    const studentAttendancePct = denom > 0 ? (t.present / denom) * 100 : null;

    const dates = teacherDates.get(name);
    let firstDate: string | null = null;
    let lastDate: string | null = null;
    let activeSpanDays: number | null = null;

    if (dates && dates.firstDate !== '9999' && dates.lastDate !== '0000') {
      firstDate = dates.firstDate;
      lastDate = dates.lastDate;
      const d1 = new Date(firstDate).getTime();
      const d2 = new Date(lastDate).getTime();
      activeSpanDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
    }

    out.push({
      staffName: name,
      classSessions: t.sessions.size,
      teachingHours: totalMinutes / 60,
      attendanceRecords: t.attendanceRecords,
      students: t.students.size,
      subjects: t.subjects.size,
      present: t.present,
      absent: t.absent,
      late: t.late,
      studentAttendancePct,
      firstClassDate: firstDate,
      lastClassDate: lastDate,
      activeSpanDays,
      joinDate: dates?.joinDate || null,
    });
  }

  return out.sort((a, b) => {
    if (b.classSessions !== a.classSessions) return b.classSessions - a.classSessions;
    return b.attendanceRecords - a.attendanceRecords;
  });
}

// ---------------------------------------------------------
// Data Quality Auditor
// ---------------------------------------------------------

export function auditDataQuality(rawRows: Record<string, any>[]): DataQualityReport {
  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      totalColumns: 0,
      duplicateRows: 0,
      cellCompletenessPct: 100,
      columns: [],
    };
  }

  const columns = Object.keys(rawRows[0] || {});
  const totalRows = rawRows.length;
  const totalCols = columns.length;
  const totalCells = totalRows * totalCols;

  let missingCells = 0;
  const rowSignatures = new Set<string>();
  let duplicates = 0;

  for (const r of rawRows) {
    const sig = columns.map((c) => String(r[c] ?? '')).join('|||');
    if (rowSignatures.has(sig)) {
      duplicates++;
    } else {
      rowSignatures.add(sig);
    }
  }

  const columnMetrics: ColumnQualityMetric[] = columns.map((c) => {
    let missingCount = 0;
    const uniqueValues = new Set<string>();
    let inferredType = 'string';

    for (const r of rawRows) {
      const val = r[c];
      if (val === null || val === undefined || String(val).trim() === '' || String(val).toLowerCase() === 'nan') {
        missingCount++;
      } else {
        uniqueValues.add(String(val).trim());
      }
    }

    missingCells += missingCount;

    // Check if numeric or date
    const sample = Array.from(uniqueValues).slice(0, 5);
    if (sample.length > 0 && sample.every((v) => !isNaN(Number(v)))) {
      inferredType = 'numeric';
    } else if (sample.length > 0 && sample.every((v) => !isNaN(Date.parse(v)) && isNaN(Number(v)))) {
      inferredType = 'date';
    }

    return {
      column: c,
      type: inferredType,
      missingCount,
      missingPct: totalRows > 0 ? (missingCount / totalRows) * 100 : 0,
      uniqueCount: uniqueValues.size,
    };
  });

  const cellCompletenessPct = totalCells > 0 ? ((totalCells - missingCells) / totalCells) * 100 : 100;

  return {
    totalRows,
    totalColumns: totalCols,
    duplicateRows: duplicates,
    cellCompletenessPct,
    columns: columnMetrics.sort((a, b) => b.missingPct - a.missingPct),
  };
}

// ---------------------------------------------------------
// CSV Parsing & Export Helpers
// ---------------------------------------------------------

export async function readSpreadsheetFile(file: File): Promise<{
  rows: Record<string, any>[];
  columns: string[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON array of objects
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  if (rawRows.length === 0) {
    return { rows: [], columns: [] };
  }

  // Normalize column headers
  const columns = Object.keys(rawRows[0]).map((c) => c.trim());
  const normalizedRows = rawRows.map((r) => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) {
      clean[k.trim()] = v;
    }
    return clean;
  });

  return { rows: normalizedRows, columns };
}

export function exportToCsv(filename: string, rows: Record<string, any>[]): void {
  if (rows.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------------------------------------------------------
// Sample Benchmark Dataset Generator
// ---------------------------------------------------------

export function generateSampleSheetData(): { rows: Record<string, any>[]; columns: string[] } {
  const mentors = [
    { name: 'Dr. Sarah Mitchell', joinDate: '2025-01-15' },
    { name: 'Marcus Chen', joinDate: '2025-03-01' },
    { name: 'Elena Rostova', joinDate: '2025-06-10' },
    { name: 'David Kim', joinDate: '2025-09-01' },
    { name: 'Amina Al-Mansoor', joinDate: '2025-11-20' },
  ];

  const subjects = ['Advanced Mathematics', 'Quantum Physics', 'AP Chemistry', 'English Literature', 'Computer Science'];
  const locations = ['Main Campus (Hall A)', 'Online Virtual Lab', 'North Campus Suite', 'Downtown Learning Hub'];
  const batches = ['Alpha Batch 2026', 'Beta Evening Cohort', 'Gamma Weekend Intensive', 'Delta Honors Group'];

  const students = [
    { id: 'STU-101', name: 'Sophia Taylor' },
    { id: 'STU-102', name: 'Lucas Martin' },
    { id: 'STU-103', name: 'Zainab Ahmed' },
    { id: 'STU-104', name: 'Ethan Garcia' },
    { id: 'STU-105', name: 'Chloe Dubois' },
    { id: 'STU-106', name: 'Aarav Sharma' },
    { id: 'STU-107', name: 'Emma Wilson' },
    { id: 'STU-108', name: 'Liam O\'Connor' },
    { id: 'STU-109', name: 'Yuki Takahashi' },
    { id: 'STU-110', name: 'Maya Patel' },
    { id: 'STU-111', name: 'Alexander Wright' },
    { id: 'STU-112', name: 'Isabella Rossi' },
  ];

  const statuses: AttendanceStatusBucket[] = ['Present', 'Present', 'Present', 'Present', 'Present', 'Late', 'Absent', 'Left Early'];
  const invoiceStatuses = ['Paid', 'Paid', 'Paid', 'Overdue', 'Pending', 'Paid'];

  const rows: Record<string, any>[] = [];
  const baseDate = new Date('2026-08-01');

  for (let day = 0; day < 70; day++) {
    const curDate = new Date(baseDate);
    curDate.setDate(curDate.getDate() + day);
    // skip Sundays
    if (curDate.getDay() === 0) continue;

    const dateStr = curDate.toISOString().split('T')[0];

    // 2-3 sessions per day
    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const mentor = mentors[(day + sIdx) % mentors.length];
      const subject = subjects[(day * 2 + sIdx) % subjects.length];
      const location = locations[(day + sIdx) % locations.length];
      const batch = batches[(day + sIdx) % batches.length];
      const startH = 9 + sIdx * 3;
      const startTime = `${String(startH).padStart(2, '0')}:00`;
      const endTime = `${String(startH + 1).padStart(2, '0')}:30`;

      // 3-5 students attend this session
      const numStudents = 3 + ((day + sIdx) % 3);
      for (let stuIdx = 0; stuIdx < numStudents; stuIdx++) {
        const student = students[(day * 3 + stuIdx) % students.length];
        // student 104 and 108 have higher absence rate for realistic risk testing
        let status = statuses[(day + stuIdx + sIdx) % statuses.length];
        if (student.id === 'STU-104' && (day % 3 === 0)) status = 'Absent';
        if (student.id === 'STU-108' && (day % 2 === 0)) status = 'Absent';

        const fee = 120 + ((day * 7) % 80);
        const invStatus = invoiceStatuses[(day + stuIdx) % invoiceStatuses.length];

        rows.push({
          'Student ID': student.id,
          'Student Name': student.name,
          'Subject': subject,
          'Staff Name': mentor.name,
          'Staff Join Date': mentor.joinDate,
          'Location': location,
          'Batch Name': batch,
          'Status': status,
          'Date': dateStr,
          'Start Time': startTime,
          'End Time': endTime,
          'Fees': `$${fee}.00`,
          'Invoice Number': `INV-2026-${String(rows.length + 1001).padStart(5, '0')}`,
          'Invoice Status': invStatus,
          'Item Name': `${subject} Standard Session`,
          'Marked By': 'System Admin',
          'Marked At': `${dateStr} ${endTime}:00`,
        });
      }
    }
  }

  const columns = Object.keys(rows[0] || {});
  return { rows, columns };
}
