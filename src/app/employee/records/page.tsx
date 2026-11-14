"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  UserPlus,
} from "lucide-react";
import { AppShell } from "../../../components/layout/AppShell";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Drawer } from "../../../components/ui/Drawer";
import { Modal } from "../../../components/ui/Modal";
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
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  status: string;
};
type EmployeeUser = {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt?: string | null;
};

const blankForm = {
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
const steps = [
  { title: "Personal details", description: "Basic contact information" },
  { title: "Employment", description: "Role and compensation" },
  { title: "Platform access", description: "Employee portal login" },
  { title: "Review & create", description: "Confirm the record" },
];
const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const labelClass = "block text-xs font-semibold text-slate-700";

export default function EmployeeRecords() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState(blankForm);
  const [step, setStep] = useState(1);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [profileTab, setProfileTab] = useState("overview");
  const [profileUser, setProfileUser] = useState<EmployeeUser | null>(null);

  const loadEmployees = async () => {
    const response = await fetch("/api/employees");
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error || "Unable to load employees.");
    setEmployees(payload.employees || []);
  };

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        void loadEmployees().catch((error: unknown) =>
          setNotice(
            error instanceof Error
              ? error.message
              : "Unable to load employees.",
          ),
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedEmployee) {
      const timer = window.setTimeout(() => setProfileUser(null), 0);
      return () => window.clearTimeout(timer);
    }
    void fetch(`/api/employees/${selectedEmployee.id}/user`)
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) =>
        setProfileUser(response.ok ? payload.user || null : null),
      )
      .catch(() => setProfileUser(null));
  }, [selectedEmployee]);

  const canContinue = useMemo(() => {
    if (step === 1)
      return Boolean(
        form.firstName.trim() &&
        form.lastName.trim() &&
        /^\S+@\S+\.\S+$/.test(form.email),
      );
    if (step === 2)
      return Boolean(
        form.department.trim() &&
        form.jobTitle.trim() &&
        form.fixedPay !== "" &&
        Number(form.fixedPay) >= 0,
      );
    if (step === 3 && form.login && form.loginMode === "password")
      return (
        form.password.length >= 8 && form.password === form.confirmPassword
      );
    return true;
  }, [form, step]);

  const closeForm = () => {
    if (isSaving) return;
    setFormOpen(false);
    setFormError(null);
    setStep(1);
    setForm(blankForm);
  };
  const nextStep = () => {
    if (!canContinue) {
      setFormError(
        step === 3
          ? "Passwords must match and contain at least 8 characters."
          : "Complete the required fields before continuing.",
      );
      return;
    }
    setFormError(null);
    setStep((current) => Math.min(current + 1, steps.length));
  };
  const createEmployee = async () => {
    if (!canContinue) {
      setFormError(
        "Please correct the fields above before creating the employee.",
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Unable to create employee.");
      if (form.login) {
        const userResponse = await fetch(
          `/api/employees/${payload.employee.id}/user`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: form.loginMode,
              password: form.password,
              confirmPassword: form.confirmPassword,
            }),
          },
        );
        const userPayload = await userResponse.json();
        if (!userResponse.ok)
          throw new Error(
            `Employee record was created, but portal access was not: ${userPayload.error || "open the profile and try again."}`,
          );
      }
      await loadEmployees();
      closeForm();
      setNotice(
        form.login
          ? "Employee record and portal access were created."
          : "Employee record created. You can create portal access later from View profile.",
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create employee.",
      );
    } finally {
      setSaving(false);
    }
  };
  const createProfileUser = async (mode: "invite" | "password") => {
    if (!selectedEmployee) return;
    const password =
      mode === "password"
        ? window.prompt("Enter a password (minimum 8 characters):") || ""
        : undefined;
    const confirmPassword =
      mode === "password"
        ? window.prompt("Confirm the password:") || ""
        : undefined;
    const response = await fetch(`/api/employees/${selectedEmployee.id}/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, password, confirmPassword }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setNotice(payload.error || "Unable to create platform user.");
      return;
    }
    setProfileUser(payload.user);
    setNotice(
      mode === "invite"
        ? "Portal user created and invitation sent."
        : "Portal user created.",
    );
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Employee Records
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage employee details and Employee Portal access.
            </p>
          </div>
          <Button
            onClick={() => {
              setNotice(null);
              setFormOpen(true);
            }}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Add employee
          </Button>
        </div>
        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="font-medium hover:text-indigo-950"
            >
              Dismiss
            </button>
          </div>
        )}
        <Card>
          <CardHeader
            title="Employees"
            subtitle={`${employees.length} employee${employees.length === 1 ? "" : "s"} in the directory`}
          />
          <CardContent>
            <div className="overflow-x-auto">
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
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-mono text-xs">
                        {employee.employeeCode}
                      </TableCell>
                      <TableCell className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.department || "—"}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          {employee.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setProfileTab("overview");
                          }}
                        >
                          View profile
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!employees.length && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-sm text-slate-500"
                      >
                        No employees have been added yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Modal
          isOpen={isFormOpen}
          onClose={closeForm}
          maxWidth="2xl"
          title="Add employee"
          subtitle="Create an employee record and optionally grant portal access."
          footer={
            <div className="flex w-full items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => (step === 1 ? closeForm() : setStep(step - 1))}
                disabled={isSaving}
                leftIcon={
                  step === 1 ? undefined : <ChevronLeft className="h-4 w-4" />
                }
              >
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              {step < steps.length ? (
                <Button
                  onClick={nextStep}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  {step === 3 && !form.login ? "Skip login" : "Continue"}
                </Button>
              ) : (
                <Button
                  onClick={() => void createEmployee()}
                  isLoading={isSaving}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Create employee
                </Button>
              )}
            </div>
          }
        >
          <div className="grid gap-6 md:grid-cols-[185px_minmax(0,1fr)]">
            <aside
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              aria-label="Employee setup progress"
            >
              <ol className="space-y-1">
                {steps.map((item, index) => {
                  const itemStep = index + 1;
                  const complete = itemStep < step;
                  const active = itemStep === step;
                  return (
                    <li key={item.title}>
                      <button
                        type="button"
                        onClick={() => itemStep < step && setStep(itemStep)}
                        disabled={itemStep > step}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${active ? "bg-indigo-600 text-white shadow-sm" : complete ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "text-slate-400"}`}
                      >
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? "bg-white/20 text-white" : complete ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          {complete ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            itemStep
                          )}
                        </span>
                        <span>
                          <span className="block text-xs font-semibold">
                            {item.title}
                          </span>
                          <span
                            className={`mt-0.5 block text-[11px] ${active ? "text-indigo-100" : complete ? "text-emerald-700" : "text-slate-400"}`}
                          >
                            {complete ? "Complete" : item.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>
            <div className="min-w-0">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Step {step} of {steps.length}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {steps[step - 1].title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {steps[step - 1].description}
                </p>
              </div>
              {formError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    First name <span className="text-red-500">*</span>
                    <input
                      className={inputClass}
                      autoFocus
                      value={form.firstName}
                      onChange={(event) =>
                        setForm({ ...form, firstName: event.target.value })
                      }
                      placeholder="Priya"
                    />
                  </label>
                  <label className={labelClass}>
                    Last name <span className="text-red-500">*</span>
                    <input
                      className={inputClass}
                      value={form.lastName}
                      onChange={(event) =>
                        setForm({ ...form, lastName: event.target.value })
                      }
                      placeholder="Patel"
                    />
                  </label>
                  <label className={`${labelClass} sm:col-span-2`}>
                    Work email <span className="text-red-500">*</span>
                    <input
                      type="email"
                      className={inputClass}
                      value={form.email}
                      onChange={(event) =>
                        setForm({ ...form, email: event.target.value })
                      }
                      placeholder="priya@company.com"
                    />
                  </label>
                  <label className={`${labelClass} sm:col-span-2`}>
                    Phone{" "}
                    <span className="font-normal text-slate-400">
                      (optional)
                    </span>
                    <input
                      type="tel"
                      className={inputClass}
                      value={form.phone}
                      onChange={(event) =>
                        setForm({ ...form, phone: event.target.value })
                      }
                      placeholder="+91 98765 43210"
                    />
                  </label>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Department <span className="text-red-500">*</span>
                    <input
                      className={inputClass}
                      value={form.department}
                      onChange={(event) =>
                        setForm({ ...form, department: event.target.value })
                      }
                      placeholder="Operations"
                    />
                  </label>
                  <label className={labelClass}>
                    Job title <span className="text-red-500">*</span>
                    <input
                      className={inputClass}
                      value={form.jobTitle}
                      onChange={(event) =>
                        setForm({ ...form, jobTitle: event.target.value })
                      }
                      placeholder="Program coordinator"
                    />
                  </label>
                  <label className={labelClass}>
                    Start date{" "}
                    <span className="font-normal text-slate-400">
                      (optional)
                    </span>
                    <input
                      type="date"
                      className={inputClass}
                      value={form.startDate}
                      onChange={(event) =>
                        setForm({ ...form, startDate: event.target.value })
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    Fixed monthly pay <span className="text-red-500">*</span>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={form.fixedPay}
                      onChange={(event) =>
                        setForm({ ...form, fixedPay: event.target.value })
                      }
                      placeholder="0"
                    />
                  </label>
                  <label className={labelClass}>
                    Variable monthly pay{" "}
                    <span className="font-normal text-slate-400">
                      (optional)
                    </span>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={form.variablePay}
                      onChange={(event) =>
                        setForm({ ...form, variablePay: event.target.value })
                      }
                      placeholder="0"
                    />
                  </label>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                      <span>
                        <span className="block">TDS deduction</span>
                        <span className="mt-0.5 block font-normal text-slate-500">
                          Apply TDS in payroll
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.tdsEnabled}
                        onChange={(event) =>
                          setForm({ ...form, tdsEnabled: event.target.checked })
                        }
                        className="h-4 w-4 accent-indigo-600"
                      />
                    </label>
                    {form.tdsEnabled && (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className={inputClass}
                        value={form.tdsPercent}
                        onChange={(event) =>
                          setForm({ ...form, tdsPercent: event.target.value })
                        }
                        placeholder="TDS percentage"
                      />
                    )}
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-4">
                  <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300">
                    <input
                      type="checkbox"
                      checked={form.login}
                      onChange={(event) =>
                        setForm({ ...form, login: event.target.checked })
                      }
                      className="mt-0.5 h-4 w-4 accent-indigo-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Create Employee Portal login
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        The work email will be used. A duplicate platform
                        account is never created.
                      </span>
                    </span>
                  </label>
                  {form.login && (
                    <div className="space-y-4 rounded-xl bg-slate-50 p-4">
                      <label className={labelClass}>
                        Account setup method
                        <select
                          className={inputClass}
                          value={form.loginMode}
                          onChange={(event) =>
                            setForm({ ...form, loginMode: event.target.value })
                          }
                        >
                          <option value="invite">
                            Send invitation and password-setup link
                          </option>
                          <option value="password">Set a password now</option>
                        </select>
                      </label>
                      {form.loginMode === "invite" ? (
                        <p className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                          An invitation email with a secure password-setup link
                          will be sent after the employee is created.
                        </p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className={labelClass}>
                            Password <span className="text-red-500">*</span>
                            <input
                              type="password"
                              className={inputClass}
                              value={form.password}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  password: event.target.value,
                                })
                              }
                              placeholder="At least 8 characters"
                            />
                          </label>
                          <label className={labelClass}>
                            Confirm password{" "}
                            <span className="text-red-500">*</span>
                            <input
                              type="password"
                              className={inputClass}
                              value={form.confirmPassword}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  confirmPassword: event.target.value,
                                })
                              }
                              placeholder="Repeat password"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                  {!form.login && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      You can skip this for now and create access later from the
                      employee profile.
                    </p>
                  )}
                </div>
              )}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">Employee</dt>
                        <dd className="mt-0.5 font-semibold text-slate-900">
                          {form.firstName} {form.lastName}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Work email</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                          {form.email}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Employment</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                          {form.jobTitle} · {form.department}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">
                          Portal access
                        </dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                          {form.login
                            ? form.loginMode === "invite"
                              ? "Invitation email"
                              : "Password set by administrator"
                            : "Not created"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <p className="text-xs text-slate-500">
                    The employee ID is created automatically after confirmation.
                    Their work email and any existing platform account are
                    checked before saving.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>

        <Drawer
          isOpen={Boolean(selectedEmployee)}
          onClose={() => setSelectedEmployee(null)}
          title={
            selectedEmployee
              ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
              : "Employee profile"
          }
          subtitle={
            selectedEmployee
              ? `Employee ID: ${selectedEmployee.employeeCode}`
              : ""
          }
          width="lg"
        >
          {selectedEmployee && (
            <div className="space-y-5 text-xs">
              <Tabs
                tabs={[
                  { id: "overview", label: "Overview" },
                  { id: "attendance", label: "Attendance" },
                  { id: "earnings", label: "Earnings" },
                  { id: "payslips", label: "Payslips" },
                  { id: "user", label: "User" },
                ]}
                activeTab={profileTab}
                onChange={setProfileTab}
              />
              {profileTab === "overview" && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p>
                    <strong>Email:</strong> {selectedEmployee.email}
                  </p>
                  <p>
                    <strong>Phone:</strong> {selectedEmployee.phone || "—"}
                  </p>
                  <p>
                    <strong>Department:</strong>{" "}
                    {selectedEmployee.department || "—"}
                  </p>
                  <p>
                    <strong>Job title:</strong>{" "}
                    {selectedEmployee.jobTitle || "—"}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedEmployee.status}
                  </p>
                </div>
              )}
              {profileTab === "attendance" && (
                <p className="rounded-xl border p-4 text-slate-600">
                  Attendance, check-in, and missed-attendance reports are
                  managed from the Attendance section.
                </p>
              )}
              {profileTab === "earnings" && (
                <p className="rounded-xl border p-4 text-slate-600">
                  Employee payroll and approved monthly earnings are available
                  from Employee Payroll.
                </p>
              )}
              {profileTab === "payslips" && (
                <p className="rounded-xl border p-4 text-slate-600">
                  No employee payslips are available yet.
                </p>
              )}
              {profileTab === "user" &&
                (!profileUser ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-semibold text-amber-900">
                      No platform login created
                    </p>
                    <p className="mt-1 text-amber-800">
                      Create access only when this employee should use the
                      Employee Portal.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void createProfileUser("invite")}
                        leftIcon={<UserPlus className="h-3.5 w-3.5" />}
                      >
                        Make user & send invitation
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void createProfileUser("password")}
                        leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                      >
                        Make user & set password
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold">{profileUser.name}</p>
                    <p className="mt-1">{profileUser.email}</p>
                    <p className="mt-1 text-slate-500">
                      Status: {profileUser.status} · Last login:{" "}
                      {profileUser.lastLoginAt
                        ? new Date(profileUser.lastLoginAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </Drawer>
      </div>
    </AppShell>
  );
}
