type Budget = {
  id: string;
  limit: string;
  month: number;
  year: number;
  category: {
    id: string;
    name: string;
  };
  spent: string;
  remaining: string;
  progress: number;
};

type BudgetListProps = {
  budgets: Budget[];
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
};

function formatMoney(value: string) {
  return `$${Number(value).toFixed(2)}`;
}

export default function BudgetList({ budgets, onEdit, onDelete }: BudgetListProps) {
  if (budgets.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-8 text-slate-300">
        No budgets for this month yet. Add one to start tracking spending against a limit.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {budgets.map((budget) => {
        const isOverspent = Number(budget.remaining) < 0;

        return (
          <article key={budget.id} className="glass-panel rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                  {budget.month}/{budget.year}
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-white">{budget.category.name}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${isOverspent ? "bg-rose-400/10 text-rose-200" : "bg-emerald-400/10 text-emerald-200"}`}>
                {Math.round(budget.progress)}%
              </span>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${isOverspent ? "bg-rose-400" : "bg-emerald-400"}`}
                style={{ width: `${Math.min(100, budget.progress)}%` }}
              />
            </div>

            <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Limit</p>
                <p className="mt-1 font-semibold text-white">{formatMoney(budget.limit)}</p>
              </div>
              <div>
                <p className="text-slate-500">Spent</p>
                <p className="mt-1 font-semibold text-white">{formatMoney(budget.spent)}</p>
              </div>
              <div>
                <p className="text-slate-500">Remaining</p>
                <p className={`mt-1 font-semibold ${isOverspent ? "text-rose-200" : "text-white"}`}>
                  {formatMoney(budget.remaining)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEdit(budget)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(budget)}
                className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20"
              >
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}