"use client";

import { useEffect, useState } from "react";

type DashboardSummary = {
  month: number;
  year: number;
  state: {
    label: string;
    message: string;
  };
  totals: {
    income: number;
    expenses: number;
    net: number;
  };
  highlights: {
    spendingPressure: Array<{
      name: string;
      total: number;
    }>;
    alerts: Array<{
      id: string;
      category: {
        id: string;
        name: string;
      };
      limit: number;
      spent: number;
      remaining: number;
      progress: number;
      message: string;
    }>;
  };
};

function formatMonthYear(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

function getFinancialTone(summary: DashboardSummary) {
  if (summary.state.label === "Overspending month") {
    return {
      label: "Needs attention",
      className: "border-rose-400/30 bg-rose-400/10 text-rose-100"
    };
  }

  if (summary.state.label === "Unbalanced spending") {
    return {
      label: "Skewed",
      className: "border-amber-400/30 bg-amber-400/10 text-amber-50"
    };
  }

  if (summary.state.label === "Strong month") {
    return {
      label: "Strong",
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-50"
    };
  }

  return {
    label: "Controlled",
    className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-50"
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 md:space-y-6">
      <div className="h-[24rem] rounded-[2.5rem] border border-white/[0.08] bg-white/[0.04]" />
      <div className="h-[18rem] rounded-[2rem] border border-white/[0.08] bg-white/[0.04]" />
      <div className="h-[18rem] rounded-[2rem] border border-white/[0.08] bg-white/[0.04]" />
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.04] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function PressureList({ categories }: { categories: DashboardSummary["highlights"]["spendingPressure"] }) {
  const maxTotal = Math.max(...categories.map((category) => category.total), 0);

  return (
    <div className="space-y-4">
      {categories.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-300">
          No spending pressure is visible yet.
        </div>
      ) : (
        categories.map((category, index) => {
          const width = maxTotal <= 0 ? 0 : (category.total / maxTotal) * 100;

          return (
            <div key={`${category.name}-${index}`} className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Pressure point {index + 1}</p>
                  <p className="mt-2 font-medium text-white">{category.name}</p>
                </div>
                <p className="font-display text-2xl font-semibold text-white">{formatMoney(category.total)}</p>
              </div>

              <div className="mt-4 h-2 rounded-full bg-slate-800/80">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-400 to-teal-300"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function AlertList({ alerts }: { alerts: DashboardSummary["highlights"]["alerts"] }) {
  return (
    <div className="space-y-4">
      {alerts.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-300">
          No budget alerts right now.
        </div>
      ) : (
        alerts.map((alert) => (
          <div key={alert.id} className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-white">{alert.message}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {formatMoney(alert.spent)} spent of {formatMoney(alert.limit)} in {alert.category.name}
                </p>
              </div>
              <p className="font-display text-2xl font-semibold text-white">{formatPercent(alert.progress)}</p>
            </div>

            <div className="mt-4 h-2 rounded-full bg-slate-800/80">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 transition-all"
                style={{ width: `${Math.min(100, alert.progress)}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
              <span>Remaining {formatMoney(alert.remaining)}</span>
              <span>{alert.progress >= 100 ? "Exceeded" : "Near limit"}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function DashboardClient() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const response = await fetch("/api/dashboard/summary", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Unable to load dashboard summary");
        }

        const payload = (await response.json()) as DashboardSummary;

        if (isMounted) {
          setSummary(payload);
        }
      } catch {
        if (isMounted) {
          setError("We could not load your dashboard right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !summary) {
    return (
      <div className="glass-panel rounded-[2.5rem] p-8">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Monthly Financial State</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-white">Summary unavailable</h2>
        <p className="mt-2 max-w-2xl text-slate-300">{error ?? "No dashboard data is available for this account yet."}</p>
      </div>
    );
  }

  const financialTone = getFinancialTone(summary);

  return (
    <section className="space-y-5 md:space-y-6">
      <div className="glass-panel relative overflow-hidden rounded-[2.5rem] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Monthly Financial State</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-white md:text-4xl">
              {formatMonthYear(summary.month, summary.year)}
            </h2>
          </div>

          <div className={`inline-flex w-fit items-center rounded-full border px-4 py-2 text-sm font-medium ${financialTone.className}`}>
            {summary.state.label}
          </div>
        </div>

        <div className="relative mt-8 space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Net balance</p>
            <p className="mt-3 font-display text-5xl font-semibold tracking-tight text-white md:text-7xl">
              {formatMoney(summary.totals.net)}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">{summary.state.message}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <MetricPill label="Income" value={formatMoney(summary.totals.income)} tone="text-emerald-300" />
            <MetricPill label="Expenses" value={formatMoney(summary.totals.expenses)} tone="text-rose-300" />
          </div>
        </div>
      </div>

      <section className="glass-panel rounded-[2rem] p-6 md:p-7">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Where the money is leaning</p>
          <h3 className="font-display text-2xl font-semibold text-white">Spending pressure</h3>
          <p className="text-sm text-slate-300">The three categories carrying the most weight this month.</p>
        </div>

        <div className="mt-6">
          <PressureList categories={summary.highlights.spendingPressure} />
        </div>
      </section>

      <section className="glass-panel rounded-[2rem] p-6 md:p-7">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Attention needed</p>
          <h3 className="font-display text-2xl font-semibold text-white">Alerts</h3>
          <p className="text-sm text-slate-300">Budgets that are close to being breached, or already there.</p>
        </div>

        <div className="mt-6">
          <AlertList alerts={summary.highlights.alerts} />
        </div>
      </section>
    </section>
  );
}
