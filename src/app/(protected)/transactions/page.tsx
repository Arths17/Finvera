import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function amountPrefix(type: "INCOME" | "EXPENSE") {
  return type === "INCOME" ? "+" : "-";
}

export default async function TransactionsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const transactions = await prisma.transaction.findMany({
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
      occurredAt: "desc"
    },
    take: 20
  });

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Transactions</p>
        <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Recent cash flow</h1>
        <p className="max-w-3xl text-slate-300">
          This route is wired to the database and scoped to the authenticated user. It is ready for
          import, manual entry, filtering, and categorization work.
        </p>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl">
        {transactions.length === 0 ? (
          <div className="p-8 text-slate-300">
            No transactions yet. Add the first import or manual entry to start populating the ledger.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">{transaction.description ?? transaction.merchant ?? "Untitled transaction"}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {transaction.category?.name ?? "Uncategorized"} • {transaction.occurredAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-display text-2xl font-semibold ${transaction.type === "INCOME" ? "text-emerald-300" : "text-rose-300"}`}>
                    {amountPrefix(transaction.type)}${Number(transaction.amount).toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-400">{transaction.type.toLowerCase()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}