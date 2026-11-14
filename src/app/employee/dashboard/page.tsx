"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, IndianRupee, Plane } from "lucide-react";
import { AppShell } from "../../../components/layout/AppShell";
import { WelcomeHeader } from "../../../components/dashboard/WelcomeHeader";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { StatCard } from "../../../components/ui/StatCard";

type Leave = { id: string; leaveType: string; status: string; startDate?: string; endDate?: string };
type DashboardData = { employee: { leaveRequests: Leave[] } | null; components: unknown[]; totalPayable: number };

const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function leaveBadge(status: string) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "DRAFT") return "neutral" as const;
  return "warning" as const;
}

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [checkInState, setCheckInState] = useState<"ready" | "saving" | "checked-in">("ready");
  const [checkInMessage, setCheckInMessage] = useState("Mark your attendance for today.");

  useEffect(() => {
    // The dashboard structure is intentionally available immediately. This
    // request only refreshes the employee-specific values in its cards.
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 1);
    const previousPeriod = date.toISOString().slice(0, 7);
    void fetch(`/api/employee-dashboard?month=${encodeURIComponent(previousPeriod)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (payload?.success !== false && payload) setData(payload); })
      .catch(() => undefined);
  }, []);

  const markAttendance = async () => {
    setCheckInState("saving");
    try {
      const response = await fetch("/api/employee-self-service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attendance" }) });
      if (!response.ok) throw new Error("Unable to record attendance.");
      setCheckInState("checked-in");
      setCheckInMessage(`Attendance posted at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`);
    } catch {
      setCheckInState("ready");
      setCheckInMessage("Attendance could not be posted. Please try again.");
    }
  };

  const leaveRequests = data?.employee?.leaveRequests || [];
  const latestLeave = leaveRequests[0];
  const lastMonthPayout = data?.totalPayable || 0;

  return <AppShell><div className="space-y-6">
    <WelcomeHeader subtitle="Employee workspace · Attendance, payout, and leave at a glance." />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Previous month payout" value={money(lastMonthPayout)} icon={<IndianRupee className="h-5 w-5" />} color="emerald" subtitle="Previous payroll period" />
      <StatCard title="Leave requests" value={leaveRequests.length} icon={<Plane className="h-5 w-5" />} color="sky" subtitle={latestLeave ? `Latest: ${latestLeave.status.toLowerCase()}` : "No leave requests"} />
      <StatCard title="Today" value={checkInState === "checked-in" ? "Present" : "Not marked"} icon={<CheckCircle2 className="h-5 w-5" />} color={checkInState === "checked-in" ? "emerald" : "amber"} subtitle="Use the check-in card below" />
      <StatCard title="Payout status" value={data?.components?.length ? "Approved" : "Awaiting"} icon={<CalendarDays className="h-5 w-5" />} color={data?.components?.length ? "indigo" : "amber"} subtitle="Previous payroll period" />
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader title="Post attendance" subtitle="Check in once at the start of your workday." /><CardContent><div className="flex flex-col gap-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm"><Clock3 className="h-5 w-5" /></div><div><p className="font-semibold text-slate-900">Today&apos;s attendance</p><p className="text-sm text-slate-600">{checkInMessage}</p></div></div><Button variant={checkInState === "checked-in" ? "success" : "primary"} onClick={() => void markAttendance()} isLoading={checkInState === "saving"} disabled={checkInState === "checked-in"} leftIcon={<CheckCircle2 className="h-4 w-4" />}>{checkInState === "checked-in" ? "Checked in" : "Check in"}</Button></div></CardContent></Card>
      <Card><CardHeader title="Previous month payout" subtitle="Your approved payout for the previous payroll period." /><CardContent><div className="rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net payable</p><p className="mt-1 text-3xl font-bold text-slate-900">{money(lastMonthPayout)}</p><p className="mt-2 text-sm text-slate-500">{data?.components?.length ? "Approved payout is available in My Earnings." : "Payout will appear after payroll is approved."}</p></div></CardContent></Card>
    </div>
    <Card><CardHeader title="Leave request updates" subtitle="Your most recent leave requests and their current review status." /><CardContent>{leaveRequests.length ? <div className="divide-y divide-slate-100">{leaveRequests.slice(0, 5).map((leave) => <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={leave.id}><div><p className="font-medium text-slate-900">{leave.leaveType.replace(/_/g, " ")} leave</p><p className="mt-0.5 text-sm text-slate-500">{leave.startDate?.slice(0, 10) || "Date pending"}{leave.endDate && leave.endDate !== leave.startDate ? ` — ${leave.endDate.slice(0, 10)}` : ""}</p></div><Badge variant={leaveBadge(leave.status)}>{leave.status.replace(/_/g, " ")}</Badge></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No leave requests yet. Submit a request from Leave Management when needed.</div>}</CardContent></Card>
  </div></AppShell>;
}
