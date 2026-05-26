"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
};

type BudgetFormModalProps = {
  open: boolean;
  categories: Category[];
  selectedMonth: number;
  selectedYear: number;
  initialBudget: Budget | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  categoryId: string;
  limit: string;
  month: string;
  year: string;
};

function createInitialState(categories: Category[], month: number, year: number, initialBudget: Budget | null) {
  if (initialBudget) {
    return {
      categoryId: initialBudget.category.id,
      limit: initialBudget.limit,
      month: String(initialBudget.month),
      year: String(initialBudget.year)
    } satisfies FormState;
  }

  return {
    categoryId: categories[0]?.id ?? "",
    limit: "",
    month: String(month),
    year: String(year)
  } satisfies FormState;
}

export default function BudgetFormModal({
  open,
  categories,
  selectedMonth,
  selectedYear,
  initialBudget,
  onClose,
  onSaved
}: BudgetFormModalProps) {
  const initialState = useMemo(
    () => createInitialState(categories, selectedMonth, selectedYear, initialBudget),
    [categories, initialBudget, selectedMonth, selectedYear]
  );
  const [formState, setFormState] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormState(initialState);
  }, [initialState, open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!formState.categoryId) {
      setError("Choose a category.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      categoryId: formState.categoryId,
      limit: formState.limit,
      month: formState.month,
      year: formState.year
    };

    const response = await fetch(initialBudget ? `/api/budgets/${initialBudget.id}` : "/api/budgets", {
      method: initialBudget ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to save budget");
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm md:items-center">
      <div className="glass-panel w-full max-w-xl rounded-3xl p-6 shadow-glow md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
              {initialBudget ? "Edit budget" : "New budget"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-white">
              {initialBudget ? "Update budget" : "Create budget"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm text-slate-300">Category</span>
            <select
              value={formState.categoryId}
              onChange={(event) => setFormState((current) => ({ ...current, categoryId: event.target.value }))}
              className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm text-slate-300">Limit</span>
              <input
                value={formState.limit}
                onChange={(event) => setFormState((current) => ({ ...current, limit: event.target.value }))}
                type="number"
                min="0.01"
                step="0.01"
                required
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="0.00"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-slate-300">Month</span>
              <select
                value={formState.month}
                onChange={(event) => setFormState((current) => ({ ...current, month: event.target.value }))}
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
              <input
                value={formState.year}
                onChange={(event) => setFormState((current) => ({ ...current, year: event.target.value }))}
                type="number"
                min="2000"
                max="2100"
                required
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="2026"
              />
            </label>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || categories.length === 0}
            className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : initialBudget ? "Update budget" : "Create budget"}
          </button>
        </form>
      </div>
    </div>
  );
}