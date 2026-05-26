type Category = {
  name: string;
  total: number;
};

type CategoryChartProps = {
  categories: Category[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export default function CategoryChart({ categories }: CategoryChartProps) {
  const topCategories = categories.slice(0, 6);
  const maxTotal = Math.max(...topCategories.map((category) => category.total), 0);

  return (
    <section className="glass-panel rounded-[2rem] p-6 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Category breakdown</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-white">Where the money went</h2>
        </div>
        <p className="text-sm text-slate-300">Top spending categories for the month.</p>
      </div>

      {topCategories.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-300">
          No expense transactions yet. Category insight will appear after the first spend is recorded.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {topCategories.map((category, index) => {
            const width = maxTotal <= 0 ? 0 : (category.total / maxTotal) * 100;

            return (
              <div key={`${category.name}-${index}`} className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{category.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{formatMoney(category.total)} spent</p>
                  </div>
                  <p className="text-sm text-slate-300">{width.toFixed(0)}%</p>
                </div>

                <div className="mt-4 h-2 rounded-full bg-slate-800/80">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-400 to-teal-300"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}