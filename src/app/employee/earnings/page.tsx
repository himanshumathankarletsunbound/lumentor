"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";

type Component = {
  type: "EMPLOYMENT" | "MENTOR";
  label: string;
  period: string;
  status: string;
  gross: number;
  deductions: number;
  net: number;
};
type Data = {
  employee: unknown;
  month: string;
  components: Component[];
  totalPayable: number;
  pendingMessage?: string | null;
};
const money = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function EarningsPage() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/employee-dashboard")
        .then((response) => response.json())
        .then(setData);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">My Earnings</h1>
          <p className="text-sm text-slate-500">
            Approved employment salary and mentor teaching payout are calculated
            separately.
          </p>
        </div>
        <Card>
          <CardHeader
            title="Approved monthly total"
            subtitle={data?.month || "Loading current month…"}
          />
          <CardContent>
            <p className="text-3xl font-bold text-indigo-700">
              {money(data?.totalPayable || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Earnings breakdown" />
          <CardContent className="space-y-3">
            {data?.components?.length ? (
              data.components.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Gross {money(item.gross)} · Deductions{" "}
                      {money(item.deductions)} · {item.status}
                    </p>
                  </div>
                  <p className="text-lg font-bold">{money(item.net)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                {data?.pendingMessage ||
                  "No approved earnings are available yet."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
