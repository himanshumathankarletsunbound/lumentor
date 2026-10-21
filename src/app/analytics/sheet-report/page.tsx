'use client';

import React, { useState, useMemo, useRef } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { StatCard } from '../../../components/ui/StatCard';
import { DonutChart } from '../../../components/charts/DonutChart';
import { BarChart, BarChartItem } from '../../../components/charts/BarChart';
import {
  SheetSchema,
  PreparedSheetRow,
  detectSchema,
  prepareSheetData,
  calculateKpis,
  generateStudentTable,
  generateTeacherTable,
  auditDataQuality,
  readSpreadsheetFile,
  exportToCsv,
  generateSampleSheetData,
} from '../../../lib/analytics/sheetEngine';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  GraduationCap,
  Calendar,
  Clock,
  DollarSign,
  ShieldAlert,
  Search,
  Sparkles,
  BarChart3,
  Layers,
  ChevronRight,
  TrendingDown,
  RefreshCw,
  FileCheck,
  Building2,
  BookOpen,
} from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

export default function SheetReportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raw dataset state
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'executive' | 'students' | 'staff' | 'operations' | 'finance' | 'quality' | 'data'>('executive');

  // Filter States
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Selected Teacher for Staff Tab Deep Dive
  const [teacherDetailSelected, setTeacherDetailSelected] = useState<string>('');

  // Student table search
  const [studentSearch, setStudentSearch] = useState<string>('');

  // 1. Schema Detection
  const schema: SheetSchema = useMemo(() => {
    if (columns.length === 0) {
      return {
        student_id: null,
        student_name: null,
        subject: null,
        staff: null,
        staff_join_date: null,
        location: null,
        batch: null,
        status: null,
        date: null,
        start_time: null,
        end_time: null,
        fees: null,
        invoice_no: null,
        invoice_status: null,
        item_name: null,
        marked_by: null,
        marked_at: null,
      };
    }
    return detectSchema(columns);
  }, [columns]);

  // 2. Prepared Baseline Dataset
  const baselinePrepared: PreparedSheetRow[] = useMemo(() => {
    if (rawRows.length === 0) return [];
    return prepareSheetData(rawRows, schema);
  }, [rawRows, schema]);

  // Available Filter Options
  const filterOptions = useMemo(() => {
    if (baselinePrepared.length === 0) {
      return { students: [], staff: [], subjects: [], batches: [], locations: [], minDate: '', maxDate: '' };
    }

    const students = new Set<string>();
    const staff = new Set<string>();
    const subjects = new Set<string>();
    const batches = new Set<string>();
    const locations = new Set<string>();
    let minDate = '9999-12-31';
    let maxDate = '0000-01-01';

    const stuCol = schema.student_name || schema.student_id;
    for (const r of baselinePrepared) {
      if (stuCol && r[stuCol]) students.add(String(r[stuCol]).trim());
      if (schema.staff && r[schema.staff]) staff.add(String(r[schema.staff]).trim());
      if (schema.subject && r[schema.subject]) subjects.add(String(r[schema.subject]).trim());
      if (schema.batch && r[schema.batch]) batches.add(String(r[schema.batch]).trim());
      if (schema.location && r[schema.location]) locations.add(String(r[schema.location]).trim());
      if (r._date) {
        if (r._date < minDate) minDate = r._date;
        if (r._date > maxDate) maxDate = r._date;
      }
    }

    return {
      students: Array.from(students).sort(),
      staff: Array.from(staff).sort(),
      subjects: Array.from(subjects).sort(),
      batches: Array.from(batches).sort(),
      locations: Array.from(locations).sort(),
      minDate: minDate !== '9999-12-31' ? minDate : '',
      maxDate: maxDate !== '0000-01-01' ? maxDate : '',
    };
  }, [baselinePrepared, schema]);

  // 3. Filtered Dataset
  const filteredData: PreparedSheetRow[] = useMemo(() => {
    if (baselinePrepared.length === 0) return [];

    return baselinePrepared.filter((r) => {
      // Date filter
      if (dateRange.start && r._date && r._date < dateRange.start) return false;
      if (dateRange.end && r._date && r._date > dateRange.end) return false;

      // Dimension filters
      const stuCol = schema.student_name || schema.student_id;
      if (selectedStudent && stuCol && String(r[stuCol]).trim() !== selectedStudent) return false;
      if (selectedStaff && schema.staff && String(r[schema.staff]).trim() !== selectedStaff) return false;
      if (selectedSubject && schema.subject && String(r[schema.subject]).trim() !== selectedSubject) return false;
      if (selectedBatch && schema.batch && String(r[schema.batch]).trim() !== selectedBatch) return false;
      if (selectedLocation && schema.location && String(r[schema.location]).trim() !== selectedLocation) return false;

      return true;
    });
  }, [baselinePrepared, schema, dateRange, selectedStudent, selectedStaff, selectedSubject, selectedBatch, selectedLocation]);

  // Executive KPIs
  const kpis = useMemo(() => {
    return calculateKpis(filteredData, schema);
  }, [filteredData, schema]);

  // Student Risk Table
  const studentRiskList = useMemo(() => {
    return generateStudentTable(filteredData, schema);
  }, [filteredData, schema]);

  const filteredStudentRiskList = useMemo(() => {
    if (!studentSearch.trim()) return studentRiskList;
    const q = studentSearch.toLowerCase();
    return studentRiskList.filter(
      (s) => s.studentName.toLowerCase().includes(q) || (s.studentId && s.studentId.toLowerCase().includes(q))
    );
  }, [studentRiskList, studentSearch]);

  // Teacher Workload Table
  const teacherWorkloadList = useMemo(() => {
    return generateTeacherTable(filteredData, schema, baselinePrepared);
  }, [filteredData, schema, baselinePrepared]);

  // Set default teacher for details view
  React.useEffect(() => {
    if (teacherWorkloadList.length > 0 && !teacherDetailSelected) {
      setTeacherDetailSelected(teacherWorkloadList[0].staffName);
    }
  }, [teacherWorkloadList, teacherDetailSelected]);

  // Data Quality Audit
  const qualityAudit = useMemo(() => {
    return auditDataQuality(rawRows);
  }, [rawRows]);

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadError(null);

    try {
      const res = await readSpreadsheetFile(file);
      if (res.rows.length === 0) {
        setUploadError('The uploaded file contains no data rows.');
      } else {
        setRawRows(res.rows);
        setColumns(res.columns);
        setFileName(file.name);
        setDateRange({ start: '', end: '' });
        setSelectedStudent('');
        setSelectedStaff('');
        setSelectedSubject('');
        setSelectedBatch('');
        setSelectedLocation('');
      }
    } catch (err: any) {
      setUploadError(`Failed to parse file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadSample = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const sample = generateSampleSheetData();
      setRawRows(sample.rows);
      setColumns(sample.columns);
      setFileName('sample_attendance_operations_report.xlsx');
      setUploadError(null);
      setIsProcessing(false);
      setDateRange({ start: '', end: '' });
      setSelectedStudent('');
      setSelectedStaff('');
      setSelectedSubject('');
      setSelectedBatch('');
      setSelectedLocation('');
    }, 150);
  };

  const handleClearData = () => {
    setRawRows([]);
    setColumns([]);
    setFileName('');
    setUploadError(null);
  };

  const clearFilters = () => {
    setDateRange({ start: '', end: '' });
    setSelectedStudent('');
    setSelectedStaff('');
    setSelectedSubject('');
    setSelectedBatch('');
    setSelectedLocation('');
  };

  const activeFilterCount =
    (dateRange.start ? 1 : 0) +
    (dateRange.end ? 1 : 0) +
    (selectedStudent ? 1 : 0) +
    (selectedStaff ? 1 : 0) +
    (selectedSubject ? 1 : 0) +
    (selectedBatch ? 1 : 0) +
    (selectedLocation ? 1 : 0);

  // Status breakdown for Donut Chart
  const statusSegments = useMemo(() => {
    if (filteredData.length === 0) return [];
    let p = 0;
    let l = 0;
    let le = 0;
    let a = 0;
    let u = 0;
    for (const r of filteredData) {
      if (r._status_bucket === 'Present') p++;
      else if (r._status_bucket === 'Late') l++;
      else if (r._status_bucket === 'Left Early') le++;
      else if (r._status_bucket === 'Absent') a++;
      else u++;
    }
    const segs = [];
    if (p > 0) segs.push({ label: 'Present', value: p, color: '#10b981' });
    if (l > 0) segs.push({ label: 'Late', value: l, color: '#f59e0b' });
    if (le > 0) segs.push({ label: 'Left Early', value: le, color: '#06b6d4' });
    if (a > 0) segs.push({ label: 'Absent', value: a, color: '#ef4444' });
    if (u > 0) segs.push({ label: 'Unknown / Other', value: u, color: '#94a3b8' });
    return segs;
  }, [filteredData]);

  // Monthly Activity Trend
  const monthlyActivityItems = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredData) {
      if (r._month) {
        map.set(r._month, (map.get(r._month) || 0) + 1);
      }
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([month, count]): BarChartItem => ({
      label: month,
      value: count,
      valueLabel: `${count} records`,
      color: 'bg-indigo-600',
    }));
  }, [filteredData]);

  // Teacher Workload Bar Chart Items
  const teacherWorkloadBarItems = useMemo(() => {
    return teacherWorkloadList.slice(0, 10).map((t): BarChartItem => ({
      label: t.staffName.split(' ')[0],
      value: t.classSessions,
      valueLabel: `${t.classSessions} sessions (${t.teachingHours.toFixed(1)}h)`,
      color: 'bg-emerald-600',
    }));
  }, [teacherWorkloadList]);

  // Subject Breakdown
  const subjectBreakdown = useMemo(() => {
    if (!schema.subject) return [];
    const map = new Map<string, { total: number; present: number; absent: number }>();
    for (const r of filteredData) {
      const subj = r[schema.subject];
      if (!subj) continue;
      const key = String(subj).trim();
      const curr = map.get(key) || { total: 0, present: 0, absent: 0 };
      curr.total++;
      if (['Present', 'Late', 'Left Early'].includes(r._status_bucket)) curr.present++;
      if (r._status_bucket === 'Absent') curr.absent++;
      map.set(key, curr);
    }
    return Array.from(map.entries())
      .map(([subj, v]) => {
        const denom = v.present + v.absent;
        const rate = denom > 0 ? (v.present / denom) * 100 : null;
        return { subject: subj, records: v.total, rate };
      })
      .sort((a, b) => b.records - a.records);
  }, [filteredData, schema.subject]);

  // Batch Breakdown
  const batchBreakdown = useMemo(() => {
    if (!schema.batch) return [];
    const map = new Map<string, { total: number; present: number; absent: number }>();
    for (const r of filteredData) {
      const b = r[schema.batch];
      if (!b) continue;
      const key = String(b).trim();
      const curr = map.get(key) || { total: 0, present: 0, absent: 0 };
      curr.total++;
      if (['Present', 'Late', 'Left Early'].includes(r._status_bucket)) curr.present++;
      if (r._status_bucket === 'Absent') curr.absent++;
      map.set(key, curr);
    }
    return Array.from(map.entries())
      .map(([batch, v]) => {
        const denom = v.present + v.absent;
        const rate = denom > 0 ? (v.present / denom) * 100 : null;
        return { batch, records: v.total, rate };
      })
      .sort((a, b) => b.records - a.records);
  }, [filteredData, schema.batch]);

  // Location Breakdown
  const locationBreakdown = useMemo(() => {
    if (!schema.location) return [];
    const map = new Map<string, { total: number; present: number; absent: number }>();
    for (const r of filteredData) {
      const loc = r[schema.location];
      if (!loc) continue;
      const key = String(loc).trim();
      const curr = map.get(key) || { total: 0, present: 0, absent: 0 };
      curr.total++;
      if (['Present', 'Late', 'Left Early'].includes(r._status_bucket)) curr.present++;
      if (r._status_bucket === 'Absent') curr.absent++;
      map.set(key, curr);
    }
    return Array.from(map.entries())
      .map(([location, v]) => {
        const denom = v.present + v.absent;
        const rate = denom > 0 ? (v.present / denom) * 100 : null;
        return { location, records: v.total, rate };
      })
      .sort((a, b) => b.records - a.records);
  }, [filteredData, schema.location]);

  // Finance Metrics
  const financeSignals = useMemo(() => {
    let overdueCount = 0;
    let totalFees = 0;
    let feeCount = 0;
    const invoiceStatusMap = new Map<string, number>();

    for (const r of filteredData) {
      if (schema.invoice_status && r[schema.invoice_status]) {
        const statusStr = String(r[schema.invoice_status]).trim();
        invoiceStatusMap.set(statusStr, (invoiceStatusMap.get(statusStr) || 0) + 1);
        if (statusStr.toLowerCase().includes('overdue')) overdueCount++;
      }
      if (r._fee_numeric !== null && r._fee_numeric !== undefined && !isNaN(r._fee_numeric)) {
        totalFees += r._fee_numeric;
        feeCount++;
      }
    }

    const statuses = Array.from(invoiceStatusMap.entries()).map(([status, count]) => ({
      status,
      count,
      pct: filteredData.length > 0 ? (count / filteredData.length) * 100 : 0,
    }));

    return {
      overdueCount,
      totalFees,
      feeCount,
      avgFee: feeCount > 0 ? totalFees / feeCount : 0,
      invoiceStatuses: statuses.sort((a, b) => b.count - a.count),
    };
  }, [filteredData, schema.invoice_status]);

  // Selected Teacher Deep Dive Profile
  const selectedTeacherProfile = useMemo(() => {
    if (!teacherDetailSelected || !schema.staff) return null;
    const detailRows = filteredData.filter((r) => String(r[schema.staff!]).trim() === teacherDetailSelected);
    if (detailRows.length === 0) return null;

    const teacherSummary = generateTeacherTable(detailRows, schema, baselinePrepared)[0];

    // Subjects taught
    const subjectsMap = new Map<string, number>();
    for (const r of detailRows) {
      if (schema.subject && r[schema.subject]) {
        const sName = String(r[schema.subject]).trim();
        subjectsMap.set(sName, (subjectsMap.get(sName) || 0) + 1);
      }
    }
    const subjectsTaught = Array.from(subjectsMap.entries()).map(([name, count]) => ({ name, count }));

    return {
      summary: teacherSummary,
      rows: detailRows,
      subjectsTaught,
    };
  }, [teacherDetailSelected, filteredData, schema, baselinePrepared]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Smart Sheet Report Analytics</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated spreadsheet intelligence: attendance trends, faculty workload, student risk, and data quality.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls,.tsv"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Spreadsheet
            </Button>

            {rawRows.length === 0 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleLoadSample}
                className="text-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Load Sample Report
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearData}
                className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Clear Report
              </Button>
            )}
          </div>
        </div>

        {/* Upload Error Banner */}
        {uploadError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Empty State / Drag & Drop Hero */}
        {rawRows.length === 0 && (
          <Card className="border-2 border-dashed border-slate-200 bg-gradient-to-b from-slate-50/50 to-white">
            <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Upload an Attendance or Operations Report</h2>
              <p className="text-xs text-slate-500 max-w-lg mt-1.5 mb-6 leading-relaxed">
                Supports CSV, XLSX, XLS, and TSV files. Automatically detects columns, deduplicates group sessions, identifies student attrition risk, tracks mentor workload, and audits data quality.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  Select File from Computer
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLoadSample}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Try Benchmark Demo Report
                </Button>
              </div>

              {/* Supported Columns Badge List */}
              <div className="mt-8 pt-6 border-t border-slate-100 w-full max-w-2xl">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Auto-Detected Report Dimensions
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 text-[11px] text-slate-600">
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">Learner / Student ID & Name</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">Attendance Status</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">Teacher / Mentor</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">Subject / Course</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">Batch / Cohort</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">Date & Time Duration</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">Campus Location</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">Fees & Invoice Status</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Content View */}
        {rawRows.length > 0 && (
          <div className="space-y-6">
            {/* Report Metadata & Filter Ribbon */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      Active Dataset:
                    </span>
                    <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded">
                      {fileName}
                    </span>
                    <Badge variant="neutral" className="text-[10px]">
                      {filteredData.length.toLocaleString()} of {rawRows.length.toLocaleString()} rows
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium transition-colors"
                      >
                        Reset Filters ({activeFilterCount})
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Controls Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  {/* Date Range Start */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.start}
                      min={filterOptions.minDate}
                      max={filterOptions.maxDate}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Date Range End */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.end}
                      min={filterOptions.minDate}
                      max={filterOptions.maxDate}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Filter: Student */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Student
                    </label>
                    <select
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">All Students</option>
                      {filterOptions.students.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter: Staff / Teacher */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Staff / Mentor
                    </label>
                    <select
                      value={selectedStaff}
                      onChange={(e) => setSelectedStaff(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">All Faculty</option>
                      {filterOptions.staff.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter: Subject */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Subject
                    </label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">All Subjects</option>
                      {filterOptions.subjects.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter: Location */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Location / Branch
                    </label>
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">All Locations</option>
                      {filterOptions.locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto space-x-1 text-xs">
              {[
                { id: 'executive', label: '🏠 Executive Overview' },
                { id: 'students', label: '👨‍🎓 Students & Risk' },
                { id: 'staff', label: '👨‍🏫 Staff & Faculty' },
                { id: 'operations', label: '📚 Operations Dimensions' },
                { id: 'finance', label: '💰 Finance Signals' },
                { id: 'quality', label: '🧹 Data Quality Audit' },
                { id: 'data', label: '🔎 Filtered Raw Data' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'py-2.5 px-4 font-semibold whitespace-nowrap border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: EXECUTIVE OVERVIEW */}
            {activeTab === 'executive' && (
              <div className="space-y-6">
                {/* 6 Executive Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard
                    title="Total Records"
                    value={kpis.records.toLocaleString()}
                    icon={<FileSpreadsheet className="w-4 h-4" />}
                    color="indigo"
                  />
                  <StatCard
                    title="Unique Students"
                    value={kpis.students.toLocaleString()}
                    icon={<Users className="w-4 h-4" />}
                    color="sky"
                  />
                  <StatCard
                    title="Active Faculty"
                    value={kpis.staff.toLocaleString()}
                    icon={<GraduationCap className="w-4 h-4" />}
                    color="emerald"
                  />
                  <StatCard
                    title="Attendance Rate"
                    value={kpis.attendanceRate !== null ? `${kpis.attendanceRate.toFixed(1)}%` : 'N/A'}
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    color={
                      kpis.attendanceRate === null
                        ? 'indigo'
                        : kpis.attendanceRate >= 90
                        ? 'emerald'
                        : kpis.attendanceRate >= 75
                        ? 'amber'
                        : 'rose'
                    }
                  />
                  <StatCard
                    title="Total Absent"
                    value={kpis.absent.toLocaleString()}
                    icon={<XCircle className="w-4 h-4" />}
                    color="rose"
                  />
                  <StatCard
                    title="Late Check-Ins"
                    value={kpis.late.toLocaleString()}
                    icon={<Clock className="w-4 h-4" />}
                    color="amber"
                  />
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Attendance Status Donut */}
                  <Card>
                    <CardHeader
                      title="Attendance Status Distribution"
                      subtitle="Classified breakdown of presence, lateness, and absences"
                    />
                    <CardContent>
                      {statusSegments.length > 0 ? (
                        <DonutChart
                          segments={statusSegments}
                          centerLabel="Attendance"
                          centerValue={kpis.attendanceRate !== null ? `${kpis.attendanceRate.toFixed(1)}%` : '--'}
                        />
                      ) : (
                        <p className="text-xs text-slate-400 py-8 text-center">No status column detected in report.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Monthly Activity Timeline */}
                  <Card>
                    <CardHeader
                      title="Monthly Activity Volume"
                      subtitle="Total class records recorded per calendar month"
                    />
                    <CardContent>
                      {monthlyActivityItems.length > 0 ? (
                        <BarChart items={monthlyActivityItems} height={180} />
                      ) : (
                        <p className="text-xs text-slate-400 py-8 text-center">No usable date column detected.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Management Observations Card */}
                <Card className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
                  <CardHeader
                    title="Executive Management Observations"
                    subtitle="Real-time operational alerts synthesized from spreadsheet records"
                  />
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold mt-0.5">•</span>
                      <span>
                        Current filtered selection encompasses{' '}
                        <strong className="text-white">{filteredData.length.toLocaleString()} session records</strong> across{' '}
                        <strong className="text-white">{kpis.students} learners</strong> and{' '}
                        <strong className="text-white">{kpis.staff} instructors</strong>.
                      </span>
                    </div>

                    {kpis.attendanceRate !== null && (
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold mt-0.5">•</span>
                        <span>
                          Overall participation benchmark is{' '}
                          <strong className={kpis.attendanceRate >= 90 ? 'text-emerald-300' : 'text-amber-300'}>
                            {kpis.attendanceRate.toFixed(1)}%
                          </strong>{' '}
                          across classifiable present and absent records, with{' '}
                          <strong className="text-rose-300">{kpis.absent.toLocaleString()} documented absences</strong>.
                        </span>
                      </div>
                    )}

                    {financeSignals.overdueCount > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold mt-0.5">•</span>
                        <span>
                          <strong className="text-rose-300">
                            {financeSignals.overdueCount.toLocaleString()} session records
                          </strong>{' '}
                          are flagged with an <strong>Overdue Invoice</strong> status requiring accounts follow-up.
                        </span>
                      </div>
                    )}

                    {studentRiskList.filter((s) => s.risk === 'High Risk').length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold mt-0.5">•</span>
                        <span>
                          <strong className="text-amber-300">
                            {studentRiskList.filter((s) => s.risk === 'High Risk').length} learners
                          </strong>{' '}
                          fall into the <strong>High Risk (&lt;75% Attendance)</strong> band and require proactive student success intervention.
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 2: STUDENTS & RISK */}
            {activeTab === 'students' && (
              <div className="space-y-6">
                {/* Risk Distribution Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">High Risk (&lt;75%)</p>
                      <p className="text-2xl font-bold text-rose-900 mt-1">
                        {studentRiskList.filter((s) => s.risk === 'High Risk').length}
                      </p>
                      <p className="text-[11px] text-rose-600 mt-0.5">Critical intervention required</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-rose-500 opacity-80" />
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Watch (75%–89%)</p>
                      <p className="text-2xl font-bold text-amber-900 mt-1">
                        {studentRiskList.filter((s) => s.risk === 'Watch').length}
                      </p>
                      <p className="text-[11px] text-amber-600 mt-0.5">Monitor attendance trend</p>
                    </div>
                    <Clock className="w-8 h-8 text-amber-500 opacity-80" />
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Healthy (≥90%)</p>
                      <p className="text-2xl font-bold text-emerald-900 mt-1">
                        {studentRiskList.filter((s) => s.risk === 'Healthy').length}
                      </p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">Consistent participation</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
                  </div>
                </div>

                {/* Student Risk Table */}
                <Card>
                  <CardHeader
                    title="Student Attendance & Attrition Risk Roster"
                    subtitle="Ranked with highest absence rate and lowest attendance percentage first"
                    action={
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search learner..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportToCsv('student_risk_report.csv', studentRiskList)}
                          className="text-xs flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export CSV
                        </Button>
                      </div>
                    }
                  />
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Learner / Student</th>
                            <th className="py-2.5 px-3 text-right">Total Sessions</th>
                            <th className="py-2.5 px-3 text-right">Present</th>
                            <th className="py-2.5 px-3 text-right text-rose-600">Absent</th>
                            <th className="py-2.5 px-3 text-right text-amber-600">Late</th>
                            <th className="py-2.5 px-4 text-center">Attendance %</th>
                            <th className="py-2.5 px-4 text-center">Risk Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredStudentRiskList.slice(0, 50).map((s) => (
                            <tr key={s.studentKey} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-4 font-semibold text-slate-800">
                                <div>{s.studentName}</div>
                                {s.studentId && <div className="text-[10px] text-slate-400 font-mono">{s.studentId}</div>}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-700">{s.totalRecords}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-emerald-600">{s.present}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-rose-600">{s.absent}</td>
                              <td className="py-2.5 px-3 text-right text-amber-600">{s.late}</td>
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2 max-w-[160px] mx-auto">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        'h-full rounded-full',
                                        s.attendancePct === null
                                          ? 'bg-slate-300'
                                          : s.attendancePct >= 90
                                          ? 'bg-emerald-500'
                                          : s.attendancePct >= 75
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      )}
                                      style={{ width: `${Math.min(100, Math.max(0, s.attendancePct || 0))}%` }}
                                    />
                                  </div>
                                  <span className="font-semibold text-slate-800 w-11 text-right">
                                    {s.attendancePct !== null ? `${s.attendancePct.toFixed(1)}%` : 'N/A'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <Badge
                                  variant={
                                    s.risk === 'High Risk'
                                      ? 'danger'
                                      : s.risk === 'Watch'
                                      ? 'warning'
                                      : 'success'
                                  }
                                >
                                  {s.risk}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 3: STAFF & FACULTY */}
            {activeTab === 'staff' && (
              <div className="space-y-6">
                {/* Faculty Overview Table */}
                <Card>
                  <CardHeader
                    title="Faculty Teaching Workload & Punctuality Summary"
                    subtitle="Class Sessions deduplicates group batches so a group class is counted once rather than once per student attendance row"
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToCsv('teacher_workload_summary.csv', teacherWorkloadList)}
                        className="text-xs flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export Teacher Summary
                      </Button>
                    }
                  />
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Instructor / Mentor</th>
                            <th className="py-2.5 px-3">Join / First Date</th>
                            <th className="py-2.5 px-3">Last Active</th>
                            <th className="py-2.5 px-3 text-right">Active Span</th>
                            <th className="py-2.5 px-3 text-right font-bold text-indigo-700">Class Sessions</th>
                            <th className="py-2.5 px-3 text-right">Teaching Hours</th>
                            <th className="py-2.5 px-3 text-right">Attendance Rows</th>
                            <th className="py-2.5 px-3 text-right">Students</th>
                            <th className="py-2.5 px-3 text-right">Subjects</th>
                            <th className="py-2.5 px-4 text-center">Student Attendance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {teacherWorkloadList.map((t) => (
                            <tr key={t.staffName} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-4 font-semibold text-slate-800">{t.staffName}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {t.joinDate || t.firstClassDate || '--'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {t.lastClassDate || '--'}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600">
                                {t.activeSpanDays !== null && t.activeSpanDays !== undefined
                                  ? `${t.activeSpanDays}d`
                                  : '--'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-600">{t.classSessions}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                                {t.teachingHours.toFixed(1)}h
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-500">{t.attendanceRecords}</td>
                              <td className="py-2.5 px-3 text-right text-slate-700">{t.students}</td>
                              <td className="py-2.5 px-3 text-right text-slate-700">{t.subjects}</td>
                              <td className="py-2.5 px-4 text-center">
                                <span
                                  className={cn(
                                    'font-semibold',
                                    t.studentAttendancePct === null
                                      ? 'text-slate-400'
                                      : t.studentAttendancePct >= 90
                                      ? 'text-emerald-600'
                                      : t.studentAttendancePct >= 75
                                      ? 'text-amber-600'
                                      : 'text-rose-600'
                                  )}
                                >
                                  {t.studentAttendancePct !== null ? `${t.studentAttendancePct.toFixed(1)}%` : 'N/A'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Workload Visual Chart */}
                <Card>
                  <CardHeader
                    title="Top Instructors by Class Sessions Taught"
                    subtitle="Operational measure of class delivery volume"
                  />
                  <CardContent>
                    {teacherWorkloadBarItems.length > 0 ? (
                      <BarChart items={teacherWorkloadBarItems} height={180} />
                    ) : (
                      <p className="text-xs text-slate-400 py-6 text-center">No instructor data available.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Individual Teacher Deep-Dive Section */}
                <Card className="border-indigo-100 bg-gradient-to-b from-indigo-50/20 to-white">
                  <CardHeader
                    title="Instructor Deep-Dive Profile"
                    subtitle="Select a faculty member to inspect individual schedules, courses taught, and complete attendance history"
                    action={
                      <select
                        value={teacherDetailSelected}
                        onChange={(e) => setTeacherDetailSelected(e.target.value)}
                        className="px-3 py-1.5 border border-indigo-200 bg-white rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {teacherWorkloadList.map((t) => (
                          <option key={t.staffName} value={t.staffName}>
                            {t.staffName} ({t.classSessions} sessions)
                          </option>
                        ))}
                      </select>
                    }
                  />
                  <CardContent className="space-y-6">
                    {selectedTeacherProfile ? (
                      <>
                        {/* 6 Teacher KPI Stat Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Class Sessions</p>
                            <p className="text-xl font-bold text-indigo-700 mt-1">
                              {selectedTeacherProfile.summary.classSessions}
                            </p>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Teaching Hours</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">
                              {selectedTeacherProfile.summary.teachingHours.toFixed(1)}h
                            </p>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Students</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">
                              {selectedTeacherProfile.summary.students}
                            </p>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Subjects</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">
                              {selectedTeacherProfile.summary.subjects}
                            </p>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Attendance Rows</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">
                              {selectedTeacherProfile.summary.attendanceRecords}
                            </p>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Student Attendance</p>
                            <p className="text-xl font-bold text-emerald-600 mt-1">
                              {selectedTeacherProfile.summary.studentAttendancePct !== null
                                ? `${selectedTeacherProfile.summary.studentAttendancePct.toFixed(1)}%`
                                : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Dates Span Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                              First Observed Activity
                            </span>
                            <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                              {selectedTeacherProfile.summary.firstClassDate || 'N/A'}
                            </span>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Last Class in Dataset
                            </span>
                            <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                              {selectedTeacherProfile.summary.lastClassDate || 'N/A'}
                            </span>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Observed Active Span
                            </span>
                            <span className="font-semibold text-indigo-700 text-sm mt-0.5 block">
                              {selectedTeacherProfile.summary.activeSpanDays || 0} Days
                            </span>
                          </div>
                        </div>

                        {/* Subjects Taught List */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                            Subjects Taught by {teacherDetailSelected}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedTeacherProfile.subjectsTaught.map((sub) => (
                              <span
                                key={sub.name}
                                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 shadow-2xs"
                              >
                                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                {sub.name}
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                  {sub.count} sessions
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Complete Class & Attendance Records for this Teacher */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                              Class Attendance Log for {teacherDetailSelected}
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                exportToCsv(
                                  `${teacherDetailSelected.replace(/\s+/g, '_')}_details.csv`,
                                  selectedTeacherProfile.rows
                                )
                              }
                              className="text-xs flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              Download Log
                            </Button>
                          </div>

                          <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                                <tr>
                                  <th className="py-2 px-3">Date</th>
                                  <th className="py-2 px-3">Time</th>
                                  <th className="py-2 px-3">Subject</th>
                                  <th className="py-2 px-3">Student</th>
                                  <th className="py-2 px-3 text-center">Status</th>
                                  <th className="py-2 px-3">Location</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {selectedTeacherProfile.rows.slice(0, 50).map((r, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 font-mono text-slate-600">
                                      {schema.date ? r[schema.date] : '--'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-500">
                                      {schema.start_time ? r[schema.start_time] : '--'}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-slate-800">
                                      {schema.subject ? r[schema.subject] : '--'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-700">
                                      {schema.student_name ? r[schema.student_name] : '--'}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <Badge
                                        variant={
                                          r._status_bucket === 'Present'
                                            ? 'success'
                                            : r._status_bucket === 'Absent'
                                            ? 'danger'
                                            : 'warning'
                                        }
                                      >
                                        {r._status_bucket}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-3 text-slate-500">
                                      {schema.location ? r[schema.location] : '--'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-6">Select a faculty member above.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 4: OPERATIONS DIMENSIONS */}
            {activeTab === 'operations' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Subject Breakdown */}
                  <Card>
                    <CardHeader title="Subject / Course" subtitle="Activity volume & attendance %" />
                    <CardContent className="space-y-2 p-0">
                      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                        {subjectBreakdown.map((s) => (
                          <div key={s.subject} className="p-3 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-slate-800 truncate">{s.subject}</p>
                              <p className="text-[11px] text-slate-400">{s.records} session rows</p>
                            </div>
                            <span
                              className={cn(
                                'font-bold text-xs shrink-0',
                                s.rate === null
                                  ? 'text-slate-400'
                                  : s.rate >= 90
                                  ? 'text-emerald-600'
                                  : s.rate >= 75
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              )}
                            >
                              {s.rate !== null ? `${s.rate.toFixed(1)}%` : 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Batch Breakdown */}
                  <Card>
                    <CardHeader title="Batch / Cohort" subtitle="Roster participation" />
                    <CardContent className="space-y-2 p-0">
                      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                        {batchBreakdown.map((b) => (
                          <div key={b.batch} className="p-3 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-slate-800 truncate">{b.batch}</p>
                              <p className="text-[11px] text-slate-400">{b.records} session rows</p>
                            </div>
                            <span
                              className={cn(
                                'font-bold text-xs shrink-0',
                                b.rate === null
                                  ? 'text-slate-400'
                                  : b.rate >= 90
                                  ? 'text-emerald-600'
                                  : b.rate >= 75
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              )}
                            >
                              {b.rate !== null ? `${b.rate.toFixed(1)}%` : 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Location Breakdown */}
                  <Card>
                    <CardHeader title="Campus Location" subtitle="Physical vs online distribution" />
                    <CardContent className="space-y-2 p-0">
                      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                        {locationBreakdown.map((l) => (
                          <div key={l.location} className="p-3 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-slate-800 truncate">{l.location}</p>
                              <p className="text-[11px] text-slate-400">{l.records} session rows</p>
                            </div>
                            <span
                              className={cn(
                                'font-bold text-xs shrink-0',
                                l.rate === null
                                  ? 'text-slate-400'
                                  : l.rate >= 90
                                  ? 'text-emerald-600'
                                  : l.rate >= 75
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              )}
                            >
                              {l.rate !== null ? `${l.rate.toFixed(1)}%` : 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* TAB 5: FINANCE SIGNALS */}
            {activeTab === 'finance' && (
              <div className="space-y-6">
                {/* Overdue Warning Alert */}
                {financeSignals.overdueCount > 0 && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-rose-900">
                        Attention: {financeSignals.overdueCount.toLocaleString()} Overdue Invoices Detected
                      </p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Billing records indicate outstanding student invoices requiring administrative follow-up.
                      </p>
                    </div>
                  </div>
                )}

                {/* 3 Fee Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard
                    title="Total Documented Fees"
                    value={`$${financeSignals.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={<DollarSign className="w-5 h-5" />}
                    color="emerald"
                    subtitle="Aggregated from spreadsheet fee columns"
                  />
                  <StatCard
                    title="Average Fee per Row"
                    value={`$${financeSignals.avgFee.toFixed(2)}`}
                    icon={<BarChart3 className="w-5 h-5" />}
                    color="indigo"
                    subtitle={`Calculated across ${financeSignals.feeCount} rows with fees`}
                  />
                  <StatCard
                    title="Invoiced Session Rows"
                    value={financeSignals.feeCount.toLocaleString()}
                    icon={<FileSpreadsheet className="w-5 h-5" />}
                    color="sky"
                    subtitle="Records containing parseable currency values"
                  />
                </div>

                {/* Invoice Status Distribution */}
                <Card>
                  <CardHeader title="Invoice & Billing Status Breakdown" subtitle="Distribution of payment settlement flags" />
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Billing Status</th>
                            <th className="py-2.5 px-4 text-right">Records Count</th>
                            <th className="py-2.5 px-4 text-right">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {financeSignals.invoiceStatuses.map((st) => (
                            <tr key={st.status} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-semibold text-slate-800">
                                <Badge
                                  variant={
                                    st.status.toLowerCase().includes('paid')
                                      ? 'success'
                                      : st.status.toLowerCase().includes('overdue')
                                      ? 'danger'
                                      : 'warning'
                                  }
                                >
                                  {st.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                                {st.count.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                                {st.pct.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 6: DATA QUALITY AUDIT */}
            {activeTab === 'quality' && (
              <div className="space-y-6">
                {/* 4 Quality Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Rows</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {qualityAudit.totalRows.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Columns</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{qualityAudit.totalColumns}</p>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Duplicate Rows</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">
                      {qualityAudit.duplicateRows.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Cell Completeness</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {qualityAudit.cellCompletenessPct.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Column-by-Column Completeness Table */}
                <Card>
                  <CardHeader
                    title="Column-by-Column Completeness Analysis"
                    subtitle="Audits missing values, null cells, and inferred data types"
                  />
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Column Header</th>
                            <th className="py-2.5 px-3">Inferred Type</th>
                            <th className="py-2.5 px-3 text-right">Missing Cells</th>
                            <th className="py-2.5 px-4 text-center">Missing %</th>
                            <th className="py-2.5 px-4 text-right">Unique Values</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {qualityAudit.columns.map((col) => (
                            <tr key={col.column} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-semibold text-slate-800">{col.column}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                  {col.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600">
                                {col.missingCount.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2 max-w-[140px] mx-auto">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        'h-full rounded-full',
                                        col.missingPct > 20
                                          ? 'bg-rose-500'
                                          : col.missingPct > 5
                                          ? 'bg-amber-500'
                                          : 'bg-emerald-500'
                                      )}
                                      style={{ width: `${Math.min(100, col.missingPct)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[11px] text-slate-600 w-10 text-right">
                                    {col.missingPct.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-right font-medium text-slate-800">
                                {col.uniqueCount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Auto-Detected Schema Mapping Table */}
                <Card>
                  <CardHeader
                    title="Auto-Detected Analytics Schema Mappings"
                    subtitle="Shows which report columns map to core LUmentor dimensions"
                  />
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Standard Analytics Dimension</th>
                            <th className="py-2.5 px-4">Detected Column Header</th>
                            <th className="py-2.5 px-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(schema).map(([dimension, mappedCol]) => (
                            <tr key={dimension} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{dimension}</td>
                              <td className="py-2.5 px-4 text-slate-700">
                                {mappedCol ? (
                                  <span className="font-semibold text-indigo-700">{mappedCol}</span>
                                ) : (
                                  <span className="text-slate-400 italic">Not found in uploaded sheet</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                {mappedCol ? (
                                  <Badge variant="success">Mapped</Badge>
                                ) : (
                                  <Badge variant="neutral">Optional / Missing</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 7: FILTERED RAW DATA */}
            {activeTab === 'data' && (
              <Card>
                <CardHeader
                  title="Filtered Spreadsheet Records"
                  subtitle={`Displaying ${filteredData.length.toLocaleString()} matching records (excluding internal computation fields)`}
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const clean = filteredData.map((r) => {
                          const c: Record<string, any> = {};
                          for (const [k, v] of Object.entries(r)) {
                            if (!k.startsWith('_')) c[k] = v;
                          }
                          return c;
                        });
                        exportToCsv('filtered_report_export.csv', clean);
                      }}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Filtered CSV
                    </Button>
                  }
                />
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                        <tr>
                          {columns.map((c) => (
                            <th key={c} className="py-2.5 px-3 whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                        {filteredData.slice(0, 100).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            {columns.map((c) => (
                              <td key={c} className="py-2 px-3 whitespace-nowrap text-slate-700">
                                {String(r[c] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredData.length > 100 && (
                    <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 border-t border-slate-200">
                      Showing preview of first 100 of {filteredData.length.toLocaleString()} rows. Use "Download Filtered CSV" to view complete dataset.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
