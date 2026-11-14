"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
  const load = () =>
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []));
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);
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
                      <Link
                        href={`/employee/records/${e.id}`}
                        className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        View profile
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
