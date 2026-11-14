"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, GraduationCap } from "lucide-react";
import { AppShell } from "../../../components/layout/AppShell";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";

type Component = {
  type: "EMPLOYMENT" | "MENTOR";
  label: string;
  status: string;
  net: number;
  details: {
    daysWorked?: number;
    totalWorkingDays?: number;
    tdsApplied?: boolean;
    eligibleClasses?: number;
    planName?: string;
  };
};
type Data = {
  employee: {
    firstName: string;
    leaveRequests: Array<{ id: string; leaveType: string; status: string }>;
  } | null;
  dualRole: boolean;
  attendance: { present: number; leave: number };
  components: Component[];
  totalPayable: number;
  pendingMessage?: string | null;
};
const money = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/employee-dashboard")
        .then((response) => response.json())
        .then(setData);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!data?.employee)
    return (
      <AppShell>
        <Card>
          <CardHeader title="Profile pending" />
          <CardContent>
            Your portal account is not linked to an employee record yet. Ask an
            administrator to link it.
          </CardContent>
        </Card>
      </AppShell>
    );
  const employment = data.components.filter(
    (item) => item.type === "EMPLOYMENT",
  );
  const mentor = data.components.filter((item) => item.type === "MENTOR");
  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome, {data.employee.firstName}
          </h1>
          <p className="text-sm text-slate-500">
            Your approved employment salary and teaching payout are shown
            separately, then combined.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader title="Total approved earnings" />
            <CardContent>
              <p className="text-2xl font-bold text-indigo-700">
                {money(data.totalPayable)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Combined amount for this month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Employee attendance" />
            <CardContent>
              <p className="text-2xl font-bold">{data.attendance.present}</p>
              <p className="mt-1 text-xs text-slate-500">
                Present days · {data.attendance.leave} approved leave request(s)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Account type" />
            <CardContent>
              <p className="text-2xl font-bold">
                {data.dualRole ? "Employee + Mentor" : "Employee"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.dualRole
                  ? "Both pay components are kept separate."
                  : "Employment compensation only."}
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Employment salary"
              subtitle="Fixed salary, attendance calculation, and employee-only TDS."
            />
            <CardContent>
              {employment.length ? (
                employment.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-semibold">
                        <BriefcaseBusiness className="h-4 w-4 text-indigo-600" />
                        {item.label}
                      </span>
                      <span className="font-bold">{money(item.net)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.details.daysWorked}/{item.details.totalWorkingDays}{" "}
                      working days · TDS{" "}
                      {item.details.tdsApplied ? "applied" : "not applicable"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No approved employment salary for this month.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader
              title="Mentor teaching payout"
              subtitle="Class-based teaching earnings; never included in fixed salary."
            />
            <CardContent>
              {mentor.length ? (
                mentor.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-semibold">
                        <GraduationCap className="h-4 w-4 text-emerald-600" />
                        {item.label}
                      </span>
                      <span className="font-bold">{money(item.net)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.details.eligibleClasses} eligible class(es) ·{" "}
                      {item.details.planName}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No approved mentor payout for this month.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        {data.pendingMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {data.pendingMessage}
          </div>
        )}
        <Card>
          <CardHeader title="Recent leave requests" />
          <CardContent>
            {data.employee.leaveRequests.length ? (
              data.employee.leaveRequests.map((item) => (
                <p key={item.id} className="border-b py-2 text-sm">
                  {item.leaveType} · {item.status}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-500">No leave requests yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
