"use client";
import { useEffect, useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Drawer } from "../../../components/ui/Drawer";
import { Tabs } from "../../../components/ui/Tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/Table";
type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  jobTitle?: string;
  status: string;
};
const initial = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  department: "",
  jobTitle: "",
  startDate: "",
  fixedPay: "",
  variablePay: "",
  tdsEnabled: false,
  tdsPercent: "",
  login: false,
  loginMode: "invite",
  password: "",
  confirmPassword: "",
};
export default function EmployeeRecords() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(1);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [profileTab, setProfileTab] = useState("overview");
  const [profileUser, setProfileUser] = useState<{ id: string; name: string; email: string; status: string; lastLoginAt?: string | null } | null>(null);
  const load = () =>
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []));
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!selectedEmployee) return;
    void fetch(`/api/employees/${selectedEmployee.id}/user`)
      .then((response) => response.json())
      .then((payload) => setProfileUser(payload.user || null))
      .catch(() => setProfileUser(null));
  }, [selectedEmployee]);
  const save = async () => {
    const r = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) return setNotice(d.error || "Unable to create employee.");
    if (form.login) {
      const u = await fetch(`/api/employees/${d.employee.id}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: form.loginMode,
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });
      const ud = await u.json();
      if (!u.ok)
        return setNotice(
          `Employee created, but login was not created: ${ud.error}`,
        );
    }
    setOpen(false);
    setStep(1);
    setForm(initial);
    setNotice("Employee record created successfully.");
    void load();
  };
  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex justify-between">
          <div>
            <h1 className="text-2xl font-bold">Employee Records</h1>
            <p className="text-sm text-slate-500">
              Employee profiles and portal access.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>Add employee record</Button>
        </div>
        {notice && (
          <p className="rounded bg-indigo-50 p-3 text-sm text-indigo-800">
            {notice}
          </p>
        )}
        <Card>
          <CardHeader title="Employees" />
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.employeeCode}</TableCell>
                    <TableCell>
                      {e.firstName} {e.lastName}
                    </TableCell>
                    <TableCell>{e.email}</TableCell>
                    <TableCell>{e.department || "—"}</TableCell>
                    <TableCell>{e.status}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => { setSelectedEmployee(e); setProfileTab("overview"); }}
                        className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        View profile
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Drawer isOpen={Boolean(selectedEmployee)} onClose={() => setSelectedEmployee(null)} title={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : "Employee profile"} subtitle={selectedEmployee ? `Employee ID: ${selectedEmployee.employeeCode}` : ""} width="lg">
          {selectedEmployee && <div className="space-y-5 text-xs">
            <Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "attendance", label: "Attendance" }, { id: "earnings", label: "Earnings" }, { id: "payslips", label: "Payslips" }, { id: "user", label: "User" }]} activeTab={profileTab} onChange={setProfileTab} />
            {profileTab === "overview" && <div className="space-y-2 rounded-xl border bg-slate-50 p-4"><p><strong>Email:</strong> {selectedEmployee.email}</p><p><strong>Department:</strong> {selectedEmployee.department || "—"}</p><p><strong>Job title:</strong> {selectedEmployee.jobTitle || "—"}</p><p><strong>Status:</strong> {selectedEmployee.status}</p></div>}
            {profileTab === "attendance" && <p className="rounded-xl border p-4 text-slate-600">Attendance, check-in, and missed-attendance reports are managed from the Attendance section.</p>}
            {profileTab === "earnings" && <p className="rounded-xl border p-4 text-slate-600">Employee payroll and approved monthly earnings are available from Employee Payroll.</p>}
            {profileTab === "payslips" && <p className="rounded-xl border p-4 text-slate-600">No employee payslips are available yet.</p>}
            {profileTab === "user" && (!profileUser ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-900">No platform login created</p><p className="mt-1 text-amber-800">Create access only when this employee should use the Employee Portal.</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={async () => { const response = await fetch(`/api/employees/${selectedEmployee.id}/user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "invite" }) }); const payload = await response.json(); if (!response.ok) return setNotice(payload.error || "Unable to create user."); setProfileUser(payload.user); }}>Make user & send invitation</Button><Button size="sm" variant="outline" onClick={async () => { const password = window.prompt("Enter a password (minimum 8 characters):") || ""; const confirmPassword = window.prompt("Confirm the password:") || ""; const response = await fetch(`/api/employees/${selectedEmployee.id}/user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "password", password, confirmPassword }) }); const payload = await response.json(); if (!response.ok) return setNotice(payload.error || "Unable to create user."); setProfileUser(payload.user); }}>Make user & set password</Button></div></div> : <div className="rounded-xl border p-4"><p className="font-semibold">{profileUser.name}</p><p className="mt-1">{profileUser.email}</p><p className="mt-1 text-slate-500">Status: {profileUser.status} · Last login: {profileUser.lastLoginAt ? new Date(profileUser.lastLoginAt).toLocaleString() : "Never"}</p></div>)}
          </div>}
        </Drawer>
        {open && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader
                title={`Add employee — Step ${step} of 4`}
                subtitle={
                  [
                    "Personal details",
                    "Employment & compensation",
                    "Platform login",
                    "Review",
                  ][step - 1]
                }
              />
              <CardContent className="space-y-3">
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="First name"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                    />
                    <input
                      placeholder="Last name"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                    />
                    <input
                      className="col-span-2"
                      placeholder="Work email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                    <input
                      className="col-span-2"
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                )}
                {step === 2 && (
                  <div className="grid gap-3">
                    <input
                      placeholder="Department"
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                    />
                    <input
                      placeholder="Job title"
                      value={form.jobTitle}
                      onChange={(e) =>
                        setForm({ ...form, jobTitle: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      placeholder="Fixed pay"
                      value={form.fixedPay}
                      onChange={(e) =>
                        setForm({ ...form, fixedPay: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      placeholder="Variable pay"
                      value={form.variablePay}
                      onChange={(e) =>
                        setForm({ ...form, variablePay: e.target.value })
                      }
                    />
                  </div>
                )}
                {step === 3 && (
                  <div className="space-y-3">
                    <label className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={form.login}
                        onChange={(e) =>
                          setForm({ ...form, login: e.target.checked })
                        }
                      />{" "}
                      Create platform login
                    </label>
                    {form.login && (
                      <>
                        <select
                          value={form.loginMode}
                          onChange={(e) =>
                            setForm({ ...form, loginMode: e.target.value })
                          }
                        >
                          <option value="invite">
                            Send invitation / password setup
                          </option>
                          <option value="password">
                            Set administrator password
                          </option>
                        </select>
                        {form.loginMode === "password" && (
                          <>
                            <input
                              type="password"
                              placeholder="Password"
                              value={form.password}
                              onChange={(e) =>
                                setForm({ ...form, password: e.target.value })
                              }
                            />
                            <input
                              type="password"
                              placeholder="Confirm password"
                              value={form.confirmPassword}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  confirmPassword: e.target.value,
                                })
                              }
                            />
                          </>
                        )}
                      </>
                    )}
                    <p className="text-xs text-slate-500">
                      Leave this unchecked to skip portal access. Duplicate work
                      emails are prevented.
                    </p>
                  </div>
                )}
                {step === 4 && (
                  <p>
                    Create{" "}
                    <strong>
                      {form.firstName} {form.lastName}
                    </strong>
                    {form.login
                      ? " with Employee portal access."
                      : " without portal access."}
                  </p>
                )}
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      step === 1 ? setOpen(false) : setStep(step - 1)
                    }
                  >
                    {step === 1 ? "Cancel" : "Back"}
                  </Button>
                  <Button
                    onClick={() =>
                      step === 4 ? void save() : setStep(step + 1)
                    }
                  >
                    {step === 3 && !form.login ? "Skip login" : "Continue"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
