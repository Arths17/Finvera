type BudgetItem = {
  id: string;
  category: {
    id: string;
    name: string;
  };
  limit: string;
  spent: string;
  remaining: string;
  progress: number;
};

type BudgetOverviewProps = {
  totalBudget: number;
  totalSpent: number;
  utilization: number;
  items: BudgetItem[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export default function BudgetOverview({ totalBudget, totalSpent, utilization, items }: BudgetOverviewProps) {
  return (
    <section className="glass-panel rounded-[2rem] p-6 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Budget health</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-white">Planned vs actual</h2>
        </div>
        <p className="text-sm text-slate-300">Budget utilization this month is {utilization.toFixed(1)}%.</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Total budgeted</p>
          <p className="mt-4 font-display text-3xl font-semibold text-white">{formatMoney(totalBudget)}</p>
        </div>
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Total spent</p>
          <p className="mt-4 font-display text-3xl font-semibold text-white">{formatMoney(totalSpent)}</p>
        </div>
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Utilization</p>
          <p className="mt-4 font-display text-3xl font-semibold text-white">{utilization.toFixed(1)}%</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-300">
            No budgets yet. Create a budget to see category progress here.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{item.category.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatMoney(Number(item.spent))} spent of {formatMoney(Number(item.limit))}
                  </p>
                </div>
                <p className="text-sm text-slate-300">{item.progress.toFixed(1)}%</p>
              </div>

              <div className="mt-4 h-2 rounded-full bg-slate-800/80">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 transition-all"
                  style={{ width: `${Math.min(100, item.progress)}%` }}
                />
              </div>

              <div className="mt-3 flex justify-between text-sm text-slate-400">
                <span>Remaining {formatMoney(Number(item.remaining))}</span>
                <span>{item.progress >= 100 ? "Over budget" : "On track"}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}