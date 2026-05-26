import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BudgetsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const budgets = await prisma.budget.findMany({
    where: {
      userId: session.user.id
    },
    include: {
      category: {
        select: {
          name: true,
          color: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Budgets</p>
        <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Category planning</h1>
        <p className="max-w-3xl text-slate-300">
          Budgets are keyed by user, category, and period so you can layer forecasting, alerts, and
          spending controls on top later.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {budgets.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 text-slate-300 md:col-span-2 xl:col-span-3">
            No budgets configured yet. Create category budgets once transaction data starts flowing.
          </div>
        ) : (
          budgets.map((budget) => (
            <article key={budget.id} className="glass-panel rounded-3xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">{budget.period.toLowerCase()}</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">{budget.category.name}</h2>
                </div>
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: budget.category.color }} />
              </div>
              <p className="mt-6 font-display text-4xl font-semibold text-white">${Number(budget.amount).toFixed(2)}</p>
              <p className="mt-2 text-sm text-slate-300">
                {budget.rollover ? "Rollover enabled" : "No rollover"}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}