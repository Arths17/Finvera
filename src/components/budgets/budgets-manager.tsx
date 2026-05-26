"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import BudgetFormModal from "@/components/budgets/budget-form-modal";
import BudgetList from "@/components/budgets/budget-list";
import { formatMonthYear } from "@/lib/budgets";

type Category = {
  id: string;
  name: string;
};

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

type BudgetsManagerProps = {
  initialBudgets: Budget[];
  categories: Category[];
  selectedMonth: number;
  selectedYear: number;
};

export default function BudgetsManager({
  initialBudgets,
  categories,
  selectedMonth,
  selectedYear
}: BudgetsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  useEffect(() => {
    setBudgets(initialBudgets);
  }, [initialBudgets]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => currentYear - 2 + index);
  }, []);

  function updateFilter(month: number, year: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(month));
    params.set("year", String(year));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function openCreateModal() {
    setEditingBudget(null);
    setIsModalOpen(true);
  }

  function openEditModal(budget: Budget) {
    setEditingBudget(budget);
    setIsModalOpen(true);
  }

  async function handleDelete(budget: Budget) {
    const confirmed = window.confirm(`Delete the ${budget.category.name} budget for ${formatMonthYear(budget.month, budget.year)}?`);

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/budgets/${budget.id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      return;
    }

    router.refresh();
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Budgets</p>
        <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Monthly spending limits</h1>
        <p className="max-w-3xl text-slate-300">
          Budgets turn transaction data into a clear spending plan. Track spent vs remaining by category, month, and year.
        </p>
      </div>

      <div className="glass-panel flex flex-col gap-4 rounded-3xl p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Viewing</p>
          <p className="mt-2 font-display text-2xl font-semibold text-white">{formatMonthYear(selectedMonth, selectedYear)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2">
            <span className="text-sm text-slate-300">Month</span>
            <select
              value={selectedMonth}
              onChange={(event) => updateFilter(Number(event.target.value), selectedYear)}
              className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-slate-300">Year</span>
            <select
              value={selectedYear}
              onChange={(event) => updateFilter(selectedMonth, Number(event.target.value))}
              className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            disabled={categories.length === 0}
          >
            Add budget
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="glass-panel rounded-3xl p-8 text-slate-300">
          Create at least one category first. Budgets are attached to categories.
        </div>
      ) : null}

      <BudgetList budgets={budgets} onEdit={openEditModal} onDelete={(budget) => void handleDelete(budget)} />

      <BudgetFormModal
        open={isModalOpen}
        categories={categories}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        initialBudget={editingBudget}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => router.refresh()}
      />
    </section>
  );
}