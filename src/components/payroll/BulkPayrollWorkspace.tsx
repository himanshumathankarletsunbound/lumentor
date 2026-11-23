"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "../layout/AppShell";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader } from "../ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/Table";
import { Tabs } from "../ui/Tabs";
import { formatCurrency, formatDateTime } from "../../lib/utils/formatters";
import type { ClassEvent, Mentor } from "../../lib/types/models";
import type {
  InitiativeEntry,
  InitiativePlan,
  Penalty,
  PayrollBatch,
  PayrollLineItem,
  PayrollPlan,
} from "../../lib/types/payroll";

const monthRange = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString(),
    end: new Date(
      Date.UTC(year, monthNumber, 0, 23, 59, 59, 999),
    ).toISOString(),
  };
};
const attendanceCount = (
  event: ClassEvent,
  type: "PRESENT" | "ABSENT" | "ABSENT_BILLABLE" | "UNMARKED",
) =>
  event.students.filter(
    (student) =>
      student.attendanceStatus === type ||
      (type === "PRESENT" && student.attendanceStatus === "LATE"),
  ).length;
const statusText = (event: ClassEvent) =>
  event.attendanceStatusSummary === "UNMARKED"
    ? "Unmarked"
    : event.students.some(
          (student) => student.attendanceStatus === "ABSENT_BILLABLE",
        )
      ? "Absent billable"
      : event.students.some(
            (student) =>
              student.attendanceStatus === "PRESENT" ||
              student.attendanceStatus === "LATE",
          )
        ? "Present"
        : event.students.some(
              (student) => student.attendanceStatus === "ABSENT",
            )
          ? "Absent"
          : "Unmarked";

type EmployeePayrollLine = {
  employeeId: string;
  totalWorkingDays: number;
  daysWorked: number;
  leaveDays: number;
  fixedSalary: number;
  variablePercent: number;
  variableAmount: number;
  additionalPayment: number;
  tdsAmount: number;
  totalPayable: number;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    tdsEnabled: boolean;
    tdsPercent: number | null;
  };
};

type EmployeePayrollBatch = {
  id: string;
  status: string;
  lines: EmployeePayrollLine[];
};

type EmployeePayrollInput = {
  variablePercent: string;
  variableAmount: string;
  additionalPayment: string;
};

export function BulkPayrollWorkspace() {
  const [month, setMonth] = useState("2000-01");
  const [tab, setTab] = useState<"mentors" | "employees">("mentors");
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [classes, setClasses] = useState<ClassEvent[]>([]);
  const [batch, setBatch] = useState<PayrollBatch | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [employeeBatch, setEmployeeBatch] =
    useState<EmployeePayrollBatch | null>(null);
  const [employeeIsPreview, setEmployeeIsPreview] = useState(false);
  const [employeeInputs, setEmployeeInputs] = useState<
    Record<string, EmployeePayrollInput>
  >({});
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [excludedClassIds, setExcludedClassIds] = useState<string[]>([]);
  const [classPayrollPlanOverrides, setClassPayrollPlanOverrides] = useState<Record<string, string>>({});
  const [payrollPlans, setPayrollPlans] = useState<PayrollPlan[]>([]);
  const [entries, setEntries] = useState<InitiativeEntry[]>([]);
  const [plans, setPlans] = useState<InitiativePlan[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [adjustmentPlanId, setAdjustmentPlanId] = useState("");
  const [adjustmentName, setAdjustmentName] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [penaltyReason, setPenaltyReason] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const range = useMemo(() => monthRange(month), [month]);
  const selectedMentor = mentors.find(
    (mentor) => mentor.id === selectedMentorId,
  );
  const selectedClasses = classes.filter(
    (event) => event.mentorId === selectedMentorId,
  );
  const selectedLines =
    batch?.lineItems.filter((item) => item.mentorId === selectedMentorId) || [];
  const selectedTotal = selectedLines.reduce(
    (sum, item) => sum + item.netPayable,
    0,
  );

  const employeePreview = (line: EmployeePayrollLine) => {
    const input = employeeInputs[line.employeeId];
    const variablePercent = Number(
      input?.variablePercent ?? line.variablePercent ?? 0,
    );
    const variableAmount = Number(
      input?.variableAmount ?? line.variableAmount ?? 0,
    );
    const additionalPayment = Number(
      input?.additionalPayment ?? line.additionalPayment ?? 0,
    );
    const validPercent = Number.isFinite(variablePercent)
      ? Math.min(100, Math.max(0, variablePercent))
      : 0;
    const validVariableAmount = Number.isFinite(variableAmount)
      ? Math.max(0, variableAmount)
      : 0;
    const validAdditionalPayment = Number.isFinite(additionalPayment)
      ? Math.max(0, additionalPayment)
      : 0;
    const variablePay = Math.round(
      (line.fixedSalary * validPercent) / 100 + validVariableAmount,
    );
    const beforeTds = Math.round(
      (line.daysWorked / line.totalWorkingDays) * line.fixedSalary -
        variablePay -
        validAdditionalPayment,
    );
    const tdsAmount = line.employee.tdsEnabled
      ? Math.round(
          (Math.max(0, beforeTds) * Number(line.employee.tdsPercent || 0)) /
            100,
        )
      : 0;
    return {
      variablePercent: validPercent,
      variableAmount: validVariableAmount,
      additionalPayment: validAdditionalPayment,
      variablePay,
      tdsAmount,
      totalPayable: Math.max(0, beforeTds - tdsAmount),
    };
  };
  const employeeRequestLines = Object.fromEntries(
    Object.entries(employeeInputs).map(([employeeId, input]) => [
      employeeId,
      {
        variablePercent: Number(input.variablePercent || 0),
        variableAmount: Number(input.variableAmount || 0),
        additionalPayment: Number(input.additionalPayment || 0),
      },
    ]),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const date = new Date();
      setMonth(
        `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/mentors");
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.error || "Unable to load mentors.");
        setMentors(data.mentors);
      } catch (error) {
        setNotice({
          type: "error",
          message:
            error instanceof Error ? error.message : "Unable to load mentors.",
        });
      }
    })();
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/payroll-plans");
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to load payroll plans.");
        }
        setPayrollPlans(data.plans);
      } catch (error) {
        setNotice({
          type: "error",
          message:
            error instanceof Error ? error.message : "Unable to load payroll plans.",
        });
      }
    })();
  }, []);
  useEffect(() => {
    if (month === "2000-01") return;
    void (async () => {
      try {
        const response = await fetch(
          `/api/classes?startDate=${encodeURIComponent(range.start)}&endDate=${encodeURIComponent(range.end)}`,
        );
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.error || "Unable to load sessions.");
        setClasses(data.classes);
        setBatch(null);
        setIsPreview(false);
        setEmployeeBatch(null);
        setEmployeeIsPreview(false);
        setEmployeeInputs({});
        setExcludedClassIds([]);
        setClassPayrollPlanOverrides({});
      } catch (error) {
        setNotice({
          type: "error",
          message:
            error instanceof Error ? error.message : "Unable to load sessions.",
        });
      }
    })();
  }, [month, range.end, range.start]);
  useEffect(() => {
    if (!selectedMentorId) return;
    void (async () => {
      const [entryResponse, planResponse, penaltyResponse] = await Promise.all([
        fetch(
          `/api/payroll/initiatives?startDate=${encodeURIComponent(range.start)}&endDate=${encodeURIComponent(range.end)}&mentorId=${encodeURIComponent(selectedMentorId)}`,
        ),
        fetch("/api/payroll/initiatives/plans"),
        fetch(
          `/api/penalties?mentorId=${encodeURIComponent(selectedMentorId)}`,
        ),
      ]);
      const [entryData, planData, penaltyData] = await Promise.all([
        entryResponse.json(),
        planResponse.json(),
        penaltyResponse.json(),
      ]);
      if (entryResponse.ok && entryData.success) setEntries(entryData.entries);
      if (planResponse.ok && planData.success) setPlans(planData.plans);
      if (penaltyResponse.ok) setPenalties(penaltyData);
    })();
  }, [range.end, range.start, selectedMentorId]);

  const calculate = async (persist = false) => {
    setLoading(true);
    try {
      const response = await fetch("/api/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: `bulk-${month}`,
          startDate: range.start,
          endDate: range.end,
          mentorIds: mentors.map((mentor) => mentor.id),
          classPayrollPlanOverrides,
          excludedClassIds,
          persist,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error)
        throw new Error(data.error || "Unable to calculate mentor payouts.");
      setBatch(data);
      setIsPreview(!persist);
      setNotice({
        type: "success",
        message: persist
          ? `Created a draft with ${data.totalMentors} mentor payout line(s).`
          : `Calculated ${data.totalMentors} mentor payout line(s). Review each mentor, then create a draft when ready.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to calculate payroll.",
      });
    } finally {
      setLoading(false);
    }
  };
  const calculateEmployeePayroll = async (persist = false, submit = false) => {
    setLoading(true);
    try {
      const response = await fetch("/api/employee-payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          lines: employeeRequestLines,
          persist,
          submit,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to calculate employee payroll.");
      }
      setEmployeeBatch(data);
      setEmployeeIsPreview(!persist);
      setEmployeeInputs(
        Object.fromEntries(
          data.lines.map((line: EmployeePayrollLine) => [
            line.employeeId,
            {
              variablePercent: String(line.variablePercent || 0),
              variableAmount: String(line.variableAmount || 0),
              additionalPayment: String(line.additionalPayment || 0),
            },
          ]),
        ),
      );
      setNotice({
        type: "success",
        message: submit
          ? "Employee payroll has been submitted for approval."
          : persist
            ? "Employee payroll draft created."
            : `Calculated ${data.lines.length} employee salary line(s). Review and adjust before creating a draft.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to calculate employee payroll.",
      });
    } finally {
      setLoading(false);
    }
  };
  const updateEmployeeInput = (
    employeeId: string,
    field: keyof EmployeePayrollInput,
    value: string,
  ) => {
    setEmployeeInputs((current) => ({
      ...current,
      [employeeId]: {
        variablePercent: current[employeeId]?.variablePercent || "0",
        variableAmount: current[employeeId]?.variableAmount || "0",
        additionalPayment: current[employeeId]?.additionalPayment || "0",
        [field]: value,
      },
    }));
  };
  const discard = async () => {
    if (
      !batch ||
      !window.confirm(
        isPreview
          ? "Discard this calculated preview? No draft has been created."
          : `Discard ${batch.batchNumber}? This deletes the entire generated batch.`,
      )
    )
      return;
    if (isPreview) {
      setBatch(null);
      setIsPreview(false);
      setSelectedMentorId(null);
      setNotice({ type: "success", message: "Calculated preview discarded." });
      return;
    }
    const response = await fetch("/api/payroll/batches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: batch.id }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setNotice({
        type: "error",
        message: data.error || "Unable to discard the batch.",
      });
      return;
    }
    setBatch(null);
    setIsPreview(false);
    setSelectedMentorId(null);
    setNotice({ type: "success", message: "Draft payroll batch discarded." });
  };
  const submitForApproval = async () => {
    if (!batch) return;
    const response = await fetch("/api/payroll/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: batch.id,
        action: "SUBMIT",
        approverId: "current-admin",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice({
        type: "error",
        message: data.error || "Unable to save batch.",
      });
      return;
    }
    setBatch(data);
    setNotice({
      type: "success",
      message: "Payroll batch saved and submitted for approval.",
    });
  };
  const removeDraftForChange = async () => {
    if (!batch) return;
    if (isPreview) {
      setBatch(null);
      setIsPreview(false);
      return;
    }
    if (batch.status !== "DRAFT")
      throw new Error(
        "This payout is already submitted or finalized. Create a new batch before changing it.",
      );
    const response = await fetch("/api/payroll/batches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: batch.id }),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.error || "Unable to clear the draft payout.");
    setBatch(null);
    setIsPreview(false);
  };
  const refreshAdjustments = async () => {
    if (!selectedMentorId) return;
    const [entryResponse, penaltyResponse] = await Promise.all([
      fetch(
        `/api/payroll/initiatives?startDate=${encodeURIComponent(range.start)}&endDate=${encodeURIComponent(range.end)}&mentorId=${encodeURIComponent(selectedMentorId)}`,
      ),
      fetch(`/api/penalties?mentorId=${encodeURIComponent(selectedMentorId)}`),
    ]);
    const [entryData, penaltyData] = await Promise.all([
      entryResponse.json(),
      penaltyResponse.json(),
    ]);
    if (entryResponse.ok && entryData.success) setEntries(entryData.entries);
    if (penaltyResponse.ok) setPenalties(penaltyData);
  };
  const addAdjustment = async () => {
    if (!selectedMentorId) return;
    try {
      const selectedPlan = plans.find((plan) => plan.id === adjustmentPlanId);
      const amount = selectedPlan
        ? selectedPlan.amount
        : Number(adjustmentAmount);
      const name = selectedPlan?.name || adjustmentName.trim();
      if (!name || !Number.isFinite(amount) || amount <= 0)
        throw new Error(
          "Choose a configured type or enter a custom name and positive amount.",
        );
      await removeDraftForChange();
      const response = await fetch("/api/payroll/initiatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorId: selectedMentorId,
          planId: selectedPlan?.id,
          name,
          amount,
          count: 1,
          payoutFactor: selectedPlan?.payoutFactor || 1,
          periodStart: range.start,
          periodEnd: range.end,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Unable to add adjustment.");
      setAdjustmentOpen(false);
      setAdjustmentPlanId("");
      setAdjustmentName("");
      setAdjustmentAmount("");
      await refreshAdjustments();
      await calculate();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to add adjustment.",
      });
    }
  };
  const removeAdjustment = async (entry: InitiativeEntry) => {
    if (
      !selectedMentorId ||
      !window.confirm(`Remove ${entry.name} from this payout?`)
    )
      return;
    try {
      await removeDraftForChange();
      const response = await fetch(
        `/api/payroll/initiatives?id=${encodeURIComponent(entry.id)}&mentorId=${encodeURIComponent(selectedMentorId)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Unable to remove adjustment.");
      await refreshAdjustments();
      await calculate();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to remove adjustment.",
      });
    }
  };
  const addPenalty = async () => {
    if (!selectedMentor || !selectedMentorId) return;
    try {
      const amount = Number(penaltyAmount);
      if (!selectedMentor.branchId)
        throw new Error(
          "This mentor needs a branch before a penalty can be added.",
        );
      if (!penaltyReason.trim() || !Number.isFinite(amount) || amount <= 0)
        throw new Error("Enter a penalty reason and positive amount.");
      await removeDraftForChange();
      const response = await fetch("/api/penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorId: selectedMentorId,
          branchId: selectedMentor.branchId,
          category: "OTHER",
          reason: penaltyReason.trim(),
          amount,
          approveImmediately: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to add penalty.");
      setPenaltyOpen(false);
      setPenaltyReason("");
      setPenaltyAmount("");
      await refreshAdjustments();
      await calculate();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to add penalty.",
      });
    }
  };
  const removePenalty = async (penalty: Penalty) => {
    if (
      !window.confirm(
        `Reverse the approved penalty ${formatCurrency(penalty.amount)}?`,
      )
    )
      return;
    try {
      await removeDraftForChange();
      const response = await fetch(
        `/api/penalties?id=${encodeURIComponent(penalty.id)}&reason=${encodeURIComponent("Removed during bulk payout review")}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Unable to reverse penalty.");
      await refreshAdjustments();
      await calculate();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to reverse penalty.",
      });
    }
  };
  const exportLatest = async () => {
    if (!batch) return;
    try {
      const XLSX = await import("xlsx");
      const summary = mentors.map((mentor) => ({
        "Mentor ID": mentor.id,
        Mentor: `${mentor.firstName} ${mentor.lastName}`,
        Present: countFor(mentor.id, "PRESENT"),
        Absent: countFor(mentor.id, "ABSENT"),
        "Absent billable": countFor(mentor.id, "ABSENT_BILLABLE"),
        Unmarked: countFor(mentor.id, "UNMARKED"),
        "Latest payout": totalFor(mentor.id),
        Status: batch.status,
      }));
      const attendance = classes.flatMap((event) =>
        event.students.length
          ? event.students.map((student) => ({
              "Mentor ID": event.mentorId,
              Class: event.title,
              Subject: event.subjectName || "",
              Date: formatDateTime(event.startTime),
              Student: student.studentName || student.studentId,
              Attendance: student.attendanceStatus,
              Excluded: excludedClassIds.includes(event.id) ? "Yes" : "No",
            }))
          : [
              {
                "Mentor ID": event.mentorId,
                Class: event.title,
                Subject: event.subjectName || "",
                Date: formatDateTime(event.startTime),
                Student: "",
                Attendance: "UNMARKED",
                Excluded: excludedClassIds.includes(event.id) ? "Yes" : "No",
              },
            ],
      );
      const payouts = batch.lineItems.map((item) => ({
        "Mentor ID": item.mentorId,
        "Payout plan": item.planName,
        "Class earnings":
          Number(item.classEarnings) +
          Number(item.durationEarnings) +
          Number(item.studentEarnings) +
          Number(item.revenueShareEarnings),
        "Incentives / fixed payout": Number(item.bonusAmount),
        "Approved penalties": Number(item.penaltyDeductions),
        "Net payout": Number(item.netPayable),
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(summary),
        "Payout summary",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(attendance),
        "Attendance",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(payouts),
        "Adjustments",
      );
      XLSX.writeFile(
        workbook,
        `bulk-payout-${month}-${batch.batchNumber}.xlsx`,
      );
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to export payout.",
      });
    }
  };
  const groupedLines = (mentorId: string) =>
    batch?.lineItems.filter((item) => item.mentorId === mentorId) || [];
  const totalFor = (mentorId: string) =>
    groupedLines(mentorId).reduce((sum, item) => sum + item.netPayable, 0);
  const countFor = (
    mentorId: string,
    status: "PRESENT" | "ABSENT" | "ABSENT_BILLABLE" | "UNMARKED",
  ) =>
    classes
      .filter((event) => event.mentorId === mentorId)
      .reduce((sum, event) => sum + attendanceCount(event, status), 0);
  const fixedEntries = entries.filter(
    (entry) =>
      plans.find((plan) => plan.id === entry.planId)?.planType ===
      "FIXED_PAYOUT",
  );
  const incentiveEntries = entries.filter(
    (entry) => !fixedEntries.includes(entry),
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Process Payroll Batch
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Select a month, review mentor session payouts, then save the
              completed batch for approval.
            </p>
          </div>
          {batch && (
            <Button
              variant="outline"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => void exportLatest()}
            >
              Export latest payout
            </Button>
          )}
        </div>
        {notice && (
          <Alert
            type={notice.type}
            title={notice.type === "success" ? "Success" : "Error"}
            message={notice.message}
          />
        )}
        <Card>
          <CardHeader title="1. Select month" />
          <CardContent className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold text-slate-700">
              Payroll month
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 p-2 font-normal"
              />
            </label>
            <Button
              variant="primary"
              isLoading={loading}
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() =>
                void (tab === "employees"
                  ? calculateEmployeePayroll()
                  : calculate())
              }
            >
              {tab === "employees"
                ? "Calculate employee payroll"
                : "Calculate mentor payouts"}
            </Button>
          </CardContent>
        </Card>
        <Tabs
          tabs={[
            { id: "mentors", label: "Mentors" },
            { id: "employees", label: "Employees" },
          ]}
          activeTab={tab}
          onChange={(value) => setTab(value as "mentors" | "employees")}
        />
        {tab === "employees" ? (
          <Card>
            <CardHeader
              title="2. Employee payroll review"
              subtitle="Uses the recorded monthly working days, fixed salary, optional variable deductions, and the employee's TDS setting. Mentor teaching payouts remain separate."
            />
            <CardContent className="space-y-4 overflow-x-auto">
              {employeeBatch ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Working days</TableHead>
                        <TableHead>Leaves</TableHead>
                        <TableHead>Fixed salary</TableHead>
                        <TableHead>Variable %</TableHead>
                        <TableHead>Variable amount</TableHead>
                        <TableHead>Additional deduction</TableHead>
                        <TableHead>TDS</TableHead>
                        <TableHead>Total payable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeBatch.lines.map((line) => {
                        const preview = employeePreview(line);
                        const input = employeeInputs[line.employeeId];
                        return (
                          <TableRow key={line.employeeId}>
                            <TableCell className="font-medium">
                              {line.employee.employeeCode}
                            </TableCell>
                            <TableCell>
                              {line.employee.firstName} {line.employee.lastName}
                            </TableCell>
                            <TableCell>
                              {line.daysWorked}/{line.totalWorkingDays}
                            </TableCell>
                            <TableCell>{line.leaveDays}</TableCell>
                            <TableCell>
                              {formatCurrency(line.fixedSalary)}
                            </TableCell>
                            <TableCell>
                              <input
                                aria-label={`Variable percentage for ${line.employee.firstName} ${line.employee.lastName}`}
                                className="w-20 rounded border border-slate-300 p-1.5 text-right"
                                min="0"
                                max="100"
                                type="number"
                                value={input?.variablePercent ?? "0"}
                                onChange={(event) =>
                                  updateEmployeeInput(
                                    line.employeeId,
                                    "variablePercent",
                                    event.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                aria-label={`Variable amount for ${line.employee.firstName} ${line.employee.lastName}`}
                                className="w-24 rounded border border-slate-300 p-1.5 text-right"
                                min="0"
                                type="number"
                                value={input?.variableAmount ?? "0"}
                                onChange={(event) =>
                                  updateEmployeeInput(
                                    line.employeeId,
                                    "variableAmount",
                                    event.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                aria-label={`Additional deduction for ${line.employee.firstName} ${line.employee.lastName}`}
                                className="w-24 rounded border border-slate-300 p-1.5 text-right"
                                min="0"
                                type="number"
                                value={input?.additionalPayment ?? "0"}
                                onChange={(event) =>
                                  updateEmployeeInput(
                                    line.employeeId,
                                    "additionalPayment",
                                    event.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              {line.employee.tdsEnabled
                                ? `${line.employee.tdsPercent || 0}% · ${formatCurrency(preview.tdsAmount)}`
                                : "Not applicable"}
                            </TableCell>
                            <TableCell className="font-semibold text-emerald-700">
                              {formatCurrency(preview.totalPayable)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="text-sm text-slate-600">
                      {employeeIsPreview ? "Preview total" : "Draft total"}:{" "}
                      {formatCurrency(
                        employeeBatch.lines.reduce(
                          (sum, line) =>
                            sum + employeePreview(line).totalPayable,
                          0,
                        ),
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        isLoading={loading}
                        onClick={() => void calculateEmployeePayroll()}
                      >
                        Recalculate
                      </Button>
                      {employeeIsPreview ? (
                        <Button
                          variant="primary"
                          isLoading={loading}
                          onClick={() => void calculateEmployeePayroll(true)}
                        >
                          Create draft
                        </Button>
                      ) : employeeBatch.status === "DRAFT" ? (
                        <Button
                          variant="primary"
                          isLoading={loading}
                          onClick={() => void calculateEmployeePayroll(true, true)}
                        >
                          Save for approval
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-sm text-slate-500">
                  Select the month and calculate employee payroll to load the
                  recorded attendance and salary review.
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="2. Mentor payout review"
              subtitle="Review the calculated payout and attendance for every mentor. Open a mentor to review sessions, exclusions, incentives, fixed payouts, and penalties."
            />
            <CardContent>
              {mentors.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mentor</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Absent billable</TableHead>
                      <TableHead>Unmarked</TableHead>
                      <TableHead>Calculated payout</TableHead>
                      <TableHead>Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mentors.map((mentor) => (
                      <TableRow key={mentor.id}>
                        <TableCell className="font-semibold">
                          {mentor.firstName} {mentor.lastName}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {mentor.id}
                        </TableCell>
                        <TableCell>{countFor(mentor.id, "PRESENT")}</TableCell>
                        <TableCell>{countFor(mentor.id, "ABSENT")}</TableCell>
                        <TableCell>
                          {countFor(mentor.id, "ABSENT_BILLABLE")}
                        </TableCell>
                        <TableCell>{countFor(mentor.id, "UNMARKED")}</TableCell>
                        <TableCell className="font-semibold">
                          {batch ? formatCurrency(totalFor(mentor.id)) : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<Eye className="h-4 w-4" />}
                            onClick={() => {
                              setSelectedMentorId(mentor.id);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading mentors…
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {selectedMentor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex flex-none items-center justify-between border-b p-5">
                <div>
                  <h2 className="text-lg font-bold">
                    {selectedMentor.firstName} {selectedMentor.lastName} —
                    payout review
                  </h2>
                  <p className="text-xs text-slate-500">
                    {month} · live review before the batch is saved
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<X className="h-4 w-4" />}
                  onClick={() => setSelectedMentorId(null)}
                >
                  Close
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs">
                        <p>Marked classes</p>
                        <strong className="text-xl">
                          {
                            selectedClasses.filter(
                              (event) =>
                                event.attendanceStatusSummary !== "UNMARKED",
                            ).length
                          }
                        </strong>
                        <p>Attendance completed</p>
                      </div>
                      <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs">
                        <p>Unmarked classes</p>
                        <strong className="text-xl">
                          {
                            selectedClasses.filter(
                              (event) =>
                                event.attendanceStatusSummary === "UNMARKED",
                            ).length
                          }
                        </strong>
                        <p>Attendance needs review</p>
                      </div>
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs">
                        <p>Class payout</p>
                        <strong className="text-xl">
                          {batch
                            ? formatCurrency(
                                selectedLines.reduce(
                                  (sum, item) =>
                                    sum +
                                    item.classEarnings +
                                    item.durationEarnings +
                                    item.studentEarnings +
                                    item.revenueShareEarnings,
                                  0,
                                ),
                              )
                            : "—"}
                        </strong>
                        <p>Session earnings only</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                        <p>Total payout</p>
                        <strong className="text-xl">
                          {batch ? formatCurrency(selectedTotal) : "—"}
                        </strong>
                        <p>After adjustments</p>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Attendance</TableHead>
                          <TableHead>Billable plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClasses.map((event) => {
                          const excluded = excludedClassIds.includes(event.id);
                          const billableAbsence = event.students.some(
                            (student) => student.attendanceStatus === "ABSENT_BILLABLE",
                          );
                          return (
                            <TableRow
                              key={event.id}
                              className={excluded ? "opacity-60" : undefined}
                            >
                              <TableCell>
                                <p className="font-medium">{event.title}</p>
                                <p className="text-xs text-slate-500">
                                  {event.subjectName}
                                </p>
                              </TableCell>
                              <TableCell className="text-xs">
                                {formatDateTime(event.startTime)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  size="sm"
                                  variant={
                                    event.attendanceStatusSummary === "UNMARKED"
                                      ? "warning"
                                      : "success"
                                  }
                                >
                                  {statusText(event)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {billableAbsence ? (
                                  <select
                                    aria-label={`Billable payroll plan for ${event.title}`}
                                    value={classPayrollPlanOverrides[event.id] || ""}
                                    onChange={(changeEvent) => {
                                      const planId = changeEvent.target.value;
                                      setClassPayrollPlanOverrides((current) => {
                                        const next = { ...current };
                                        if (planId) next[event.id] = planId;
                                        else delete next[event.id];
                                        return next;
                                      });
                                      setBatch(null);
                                    }}
                                    className="w-48 rounded-lg border border-slate-300 bg-white p-2 text-xs"
                                  >
                                    <option value="">Select billable plan</option>
                                    {payrollPlans.map((plan) => (
                                      <option key={plan.id} value={plan.id}>
                                        {plan.name} (v{plan.version})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-xs text-slate-400">Not required</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {excluded ? (
                                  <Badge size="sm" variant="warning">
                                    Excluded
                                  </Badge>
                                ) : (
                                  <Badge size="sm" variant="neutral">
                                    {event.status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {event.attendanceStatusSummary === "UNMARKED" &&
                                  (excluded ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      leftIcon={
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      }
                                      onClick={() =>
                                        setExcludedClassIds((current) =>
                                          current.filter(
                                            (id) => id !== event.id,
                                          ),
                                        )
                                      }
                                    >
                                      Restore
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      leftIcon={
                                        <Trash2 className="h-3.5 w-3.5" />
                                      }
                                      onClick={() =>
                                        setExcludedClassIds((current) => [
                                          ...current,
                                          event.id,
                                        ])
                                      }
                                    >
                                      Remove
                                    </Button>
                                  ))}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-4">
                    <Card>
                      <CardHeader title="Incentives & fixed payout" />
                      <CardContent className="space-y-3 text-xs">
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<Plus className="h-3.5 w-3.5" />}
                          onClick={() => setAdjustmentOpen(true)}
                        >
                          Add incentive or fixed payout
                        </Button>
                        <p className="font-semibold text-emerald-700">
                          Incentives
                        </p>
                        {incentiveEntries.length ? (
                          incentiveEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>{entry.name}</span>
                              <span className="flex items-center gap-1">
                                <strong>
                                  +{formatCurrency(entry.totalAmount)}
                                </strong>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void removeAdjustment(entry)}
                                >
                                  Remove
                                </Button>
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-500">
                            No incentives for this period.
                          </p>
                        )}
                        <p className="border-t pt-3 font-semibold text-indigo-700">
                          Fixed payout
                        </p>
                        {fixedEntries.length ? (
                          fixedEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>{entry.name}</span>
                              <span className="flex items-center gap-1">
                                <strong>
                                  +{formatCurrency(entry.totalAmount)}
                                </strong>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void removeAdjustment(entry)}
                                >
                                  Remove
                                </Button>
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-500">
                            No fixed payout entry for this period.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader title="Approved penalties" />
                      <CardContent className="space-y-2 text-xs">
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<Plus className="h-3.5 w-3.5" />}
                          onClick={() => setPenaltyOpen(true)}
                        >
                          Add approved penalty
                        </Button>
                        {penalties.filter(
                          (penalty) => penalty.status === "APPROVED",
                        ).length ? (
                          penalties
                            .filter((penalty) => penalty.status === "APPROVED")
                            .map((penalty) => (
                              <div
                                key={penalty.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <span>{penalty.reason}</span>
                                <span className="flex items-center gap-1">
                                  <strong className="text-rose-700">
                                    -{formatCurrency(penalty.amount)}
                                  </strong>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void removePenalty(penalty)}
                                  >
                                    Remove
                                  </Button>
                                </span>
                              </div>
                            ))
                        ) : (
                          <p className="text-slate-500">
                            No approved penalties.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
              <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-t bg-slate-50 p-5">
                <strong>
                  Total payout:{" "}
                  {batch
                    ? formatCurrency(selectedTotal)
                    : "Calculate payroll first"}
                </strong>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void calculate()}>
                    Recalculate
                  </Button>
                  <Button variant="danger" disabled={!batch} onClick={() => void discard()}>
                    {isPreview ? "Discard preview" : "Discard batch"}
                  </Button>
                  {isPreview ? (
                    <Button
                      variant="primary"
                      disabled={!batch || loading}
                      onClick={() => void calculate(true)}
                    >
                      Create draft
                    </Button>
                  ) : batch?.status === "DRAFT" ? (
                    <Button
                      variant="primary"
                      disabled={!batch || loading}
                      onClick={() => void submitForApproval()}
                    >
                      Save for approval
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
        {adjustmentOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Add incentive or fixed payout</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAdjustmentOpen(false)}
                >
                  Close
                </Button>
              </div>
              <label className="block text-sm font-medium">
                Configured type
                <select
                  value={adjustmentPlanId}
                  onChange={(event) => {
                    const id = event.target.value;
                    const plan = plans.find((item) => item.id === id);
                    setAdjustmentPlanId(id);
                    setAdjustmentName(plan?.name || "");
                    setAdjustmentAmount(plan ? String(plan.amount) : "");
                  }}
                  className="mt-1 w-full rounded-lg border p-2"
                >
                  <option value="">Custom adjustment</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.planType === "FIXED_PAYOUT"
                        ? "Fixed payout"
                        : "Incentive"}{" "}
                      · {plan.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Name
                <input
                  value={adjustmentName}
                  disabled={Boolean(adjustmentPlanId)}
                  onChange={(event) => setAdjustmentName(event.target.value)}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <label className="block text-sm font-medium">
                Amount
                <input
                  type="number"
                  min="0"
                  value={adjustmentAmount}
                  disabled={Boolean(adjustmentPlanId)}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <Button variant="primary" onClick={() => void addAdjustment()}>
                Add and recalculate
              </Button>
            </div>
          </div>
        )}
        {penaltyOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Add approved penalty</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPenaltyOpen(false)}
                >
                  Close
                </Button>
              </div>
              <label className="block text-sm font-medium">
                Reason
                <input
                  value={penaltyReason}
                  onChange={(event) => setPenaltyReason(event.target.value)}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <label className="block text-sm font-medium">
                Amount
                <input
                  type="number"
                  min="0"
                  value={penaltyAmount}
                  onChange={(event) => setPenaltyAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <Button variant="primary" onClick={() => void addPenalty()}>
                Add and recalculate
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
