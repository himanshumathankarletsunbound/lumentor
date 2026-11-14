"use client";
import { useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/Table";
type L = {
  employeeId: string;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    tdsEnabled: boolean;
    tdsPercent?: number;
  };
  daysWorked: number;
  totalWorkingDays: number;
  leaveDays: number;
  fixedSalary: number;
  tdsAmount: number;
  totalPayable: number;
  mentorPayout?: number;
};
export default function P() {
  const [month, setMonth] = useState("");
  const [b, setB] = useState<{ lines: L[]; status?: string } | null>(null);
  const [c, setC] = useState<Record<string, { variablePercent: string }>>({});
  const load = async () => {
    const r = await fetch("/api/employee-payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, lines: c }),
    });
    setB(await r.json());
  };
  const preview = (x: L) => {
    const variable = Number(c[x.employeeId]?.variablePercent || 0);
    const before = Math.round(
      (x.daysWorked / x.totalWorkingDays) * x.fixedSalary -
        (x.fixedSalary * variable) / 100,
    );
    const tds = x.employee.tdsEnabled
      ? Math.round((before * Number(x.employee.tdsPercent || 0)) / 100)
      : 0;
    return { tds, payable: before - tds };
  };
  const approveEmploymentSalary = async () => {
    const response = await fetch("/api/employee-payroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const payload = await response.json();
    if (response.ok)
      setB((current) =>
        current ? { ...current, status: payload.batch.status } : current,
      );
  };
  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Employee Payroll</h1>
        <Card>
          <CardHeader
            title="1. Select month"
            subtitle="Uses imported attendance and fixed payout. Mentor teaching payout is shown separately and is never included in fixed salary."
          />
          <CardContent className="flex gap-3">
            <input
              className="border rounded p-2"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <Button disabled={!month} onClick={() => void load()}>
              Fetch attendance
            </Button>
          </CardContent>
        </Card>
        {b && (
          <Card>
            <CardHeader
              title="2. Attendance and payroll adjustments"
              subtitle="Variable percentage defaults to 0. Total payable updates instantly as you type. Teaching payout remains a separate approved component."
            />
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Working days</TableHead>
                    <TableHead>Leaves</TableHead>
                    <TableHead>Variable %</TableHead>
                    <TableHead>TDS applicable</TableHead>
                    <TableHead>TDS amount</TableHead>
                    <TableHead>Employment salary</TableHead>
                    <TableHead>Approved mentor payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {b.lines.map((x) => {
                    const p = preview(x);
                    return (
                      <TableRow key={x.employeeId}>
                        <TableCell>{x.employee.employeeCode}</TableCell>
                        <TableCell>
                          {x.employee.firstName} {x.employee.lastName}
                        </TableCell>
                        <TableCell>
                          {x.daysWorked}/{x.totalWorkingDays}
                        </TableCell>
                        <TableCell>{x.leaveDays}</TableCell>
                        <TableCell>
                          <input
                            className="w-20 border rounded p-1"
                            type="number"
                            value={c[x.employeeId]?.variablePercent || "0"}
                            onChange={(e) =>
                              setC({
                                ...c,
                                [x.employeeId]: {
                                  variablePercent: e.target.value,
                                },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {x.employee.tdsEnabled
                            ? `Yes (${x.employee.tdsPercent}%)`
                            : "No"}
                        </TableCell>
                        <TableCell>
                          {x.employee.tdsEnabled ? `₹${p.tds}` : "—"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ₹{p.payable}
                        </TableCell>
                        <TableCell>
                          {x.mentorPayout ? `₹${x.mentorPayout}` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void load()}>
                  Recalculate & send for approval
                </Button>
                {b.status === "SUBMITTED" && (
                  <Button
                    variant="outline"
                    onClick={() => void approveEmploymentSalary()}
                  >
                    Approve employment salary
                  </Button>
                )}
                {b.status === "APPROVED" && (
                  <p className="self-center text-sm font-medium text-emerald-700">
                    Employment salary approved. Mentor payout remains separately
                    approved.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
