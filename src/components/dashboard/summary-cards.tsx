type SummaryCardsProps = {
  income: number;
  expenses: number;
  net: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.2)]">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-4 font-display text-4xl font-semibold ${tone}`}>{formatMoney(value)}</p>
      <p className="mt-2 text-sm text-slate-300">{detail}</p>
    </div>
  );
}

export default function SummaryCards({ income, expenses, net }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SummaryCard label="Income" value={income} detail="Money coming in this month." tone="text-emerald-300" />
      <SummaryCard label="Expenses" value={expenses} detail="Money going out this month." tone="text-rose-300" />
      <SummaryCard label="Net balance" value={net} detail="Positive means you kept more than you spent." tone="text-white" />
    </div>
  );
}