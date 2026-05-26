import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-4 font-display text-4xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{detail}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [incomeAggregate, expenseAggregate, transactionCount, budgetCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId: session.user.id,
        type: "INCOME",
        occurredAt: {
          gte: monthStart
        }
      },
      _sum: {
        amount: true
      }
    }),
    prisma.transaction.aggregate({
      where: {
        userId: session.user.id,
        type: "EXPENSE",
        occurredAt: {
          gte: monthStart
        }
      },
      _sum: {
        amount: true
      }
    }),
    prisma.transaction.count({
      where: {
        userId: session.user.id,
        occurredAt: {
          gte: monthStart
        }
      }
    }),
    prisma.budget.count({
      where: {
        userId: session.user.id
      }
    })
  ]);

  const income = Number(incomeAggregate._sum.amount ?? 0);
  const expenses = Number(expenseAggregate._sum.amount ?? 0);
  const net = income - expenses;

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Protected dashboard</p>
        <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">
          Welcome back, {session.user.name ?? "there"}.
        </h1>
        <p className="max-w-3xl text-slate-300">
          The account layer, user scoping, and finance schema are active. This dashboard is already
          querying the database with the current authenticated user.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Monthly income" value={`$${income.toFixed(2)}`} detail="Income captured since the start of this month" />
        <MetricCard label="Monthly expenses" value={`$${expenses.toFixed(2)}`} detail="Expense transactions scoped to the logged-in user" />
        <MetricCard label="Net cash flow" value={`$${net.toFixed(2)}`} detail="Simple proxy for current-month surplus or deficit" />
        <MetricCard label="Budgets configured" value={`${budgetCount}`} detail="Budget rows ready for category-level planning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-panel rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Current scope</p>
          <div className="mt-4 space-y-3 text-slate-300">
            <p>• User-scoped user record with hashed password storage</p>
            <p>• Transactions tracked by type, amount, and category relation</p>
            <p>• Category budgets keyed by user, category, and budget period</p>
            <p>• Session-protected routes and API access</p>
          </div>
        </div>
        <div className="glass-panel rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Transaction activity</p>
          <p className="mt-4 font-display text-4xl font-semibold text-white">{transactionCount}</p>
          <p className="mt-2 text-sm text-slate-300">Transactions recorded for the current month.</p>
        </div>
      </div>
    </section>
  );
}