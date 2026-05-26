"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type TransactionType = "INCOME" | "EXPENSE";

type Category = {
  id: string;
  name: string;
};

type Transaction = {
  id: string;
  type: TransactionType;
  amount: string;
  description?: string | null;
  merchant?: string | null;
  occurredAt: string;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: Category;
};

type TransactionFormState = {
  type: TransactionType;
  amount: string;
  description: string;
  merchant: string;
  categoryId: string;
  occurredAt: string;
};

type TransactionsManagerProps = {
  initialTransactions: Transaction[];
  categories: Category[];
};

const emptyFormState: TransactionFormState = {
  type: "EXPENSE",
  amount: "",
  description: "",
  merchant: "",
  categoryId: "",
  occurredAt: new Date().toISOString().slice(0, 16)
};

function formatCurrency(amount: string, type: TransactionType) {
  const sign = type === "INCOME" ? "+" : "-";
  return `${sign}$${Number(amount).toFixed(2)}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function toInputDateTime(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

export default function TransactionsManager({ initialTransactions, categories }: TransactionsManagerProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [formState, setFormState] = useState<TransactionFormState>(emptyFormState);
  selectedCategoryId: string;
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
function createEmptyFormState(defaultCategoryId = ""): TransactionFormState {
  return {
    type: "EXPENSE",
    amount: "",
    description: "",
    merchant: "",
    categoryId: defaultCategoryId,
    occurredAt: new Date().toISOString().slice(0, 16)
  };
}

const emptyFormState = createEmptyFormState();

function formatCurrency(amount: string, type: TransactionType) {
  const sign = type === "INCOME" ? "+" : "-";
  return `${sign}$${Number(amount).toFixed(2)}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function toInputDateTime(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

export default function TransactionsManager({ initialTransactions, categories, selectedCategoryId }: TransactionsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [formState, setFormState] = useState<TransactionFormState>(
    createEmptyFormState(selectedCategoryId || categories[0]?.id || "")
  );
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.name.localeCompare(right.name)),
    [categories]
  );

  const defaultCategoryId = selectedCategoryId || categories[0]?.id || "";

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  useEffect(() => {
    if (editingTransactionId) {
      return;
    }

    setFormState((current) => ({
      ...current,
      categoryId: defaultCategoryId
    }));
  }, [defaultCategoryId, editingTransactionId]);

  function setCategoryFilter(nextCategoryId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextCategoryId) {
      params.set("categoryId", nextCategoryId);
    } else {
      params.delete("categoryId");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  async function refreshTransactions() {
    const query = selectedCategoryId ? `?categoryId=${encodeURIComponent(selectedCategoryId)}` : "";
    const response = await fetch(`/api/transactions${query}`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Unable to load transactions");
    }

    const payload = (await response.json()) as { transactions: Transaction[] };
    setTransactions(payload.transactions);
  }

  function resetForm() {
    setFormState(createEmptyFormState(defaultCategoryId));
    setEditingTransactionId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!categories.length) {
      setError("Create a category before adding transactions.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      type: formState.type,
      amount: formState.amount,
      description: formState.description,
      merchant: formState.merchant,
      categoryId: formState.categoryId || defaultCategoryId,
      occurredAt: new Date(formState.occurredAt).toISOString()
    };

    const response = await fetch(
      editingTransactionId ? `/api/transactions/${editingTransactionId}` : "/api/transactions",
      {
        method: editingTransactionId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to save transaction");
      return;
    }

    const data = (await response.json()) as { transaction: Transaction };

    if (editingTransactionId) {
      setTransactions((current) =>
        current.map((transaction) => (transaction.id === editingTransactionId ? data.transaction : transaction))
      );
    } else {
      setTransactions((current) => [data.transaction, ...current]);
    }

    setSuccess(editingTransactionId ? "Transaction updated." : "Transaction added.");
    resetForm();
  }

  function beginEdit(transaction: Transaction) {
    setEditingTransactionId(transaction.id);
    setFormState({
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description ?? "",
      merchant: transaction.merchant ?? "",
      categoryId: transaction.category.id,
      occurredAt: toInputDateTime(transaction.occurredAt)
    });
    setError(null);
    setSuccess(null);
  }

  async function handleDelete(transactionId: string) {
    const confirmed = window.confirm("Delete this transaction? This cannot be undone.");

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/transactions/${transactionId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to delete transaction");
      return;
    }

    setTransactions((current) => current.filter((transaction) => transaction.id !== transactionId));
    setSuccess("Transaction deleted.");

    if (editingTransactionId === transactionId) {
      resetForm();
    }
  }

  async function handleReload() {
    try {
      await refreshTransactions();
    } catch {
      setError("Unable to refresh transactions");
    }
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Transactions</p>
        <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Track every dollar</h1>
        <p className="max-w-3xl text-slate-300">
          Add, edit, and delete transactions directly against the database. Every record is scoped to the signed-in user.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <form className="glass-panel rounded-3xl p-6" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                {editingTransactionId ? "Edit transaction" : "New transaction"}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                {editingTransactionId ? "Update entry" : "Create entry"}
              </h2>
            </div>
            {editingTransactionId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          {!categories.length ? (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              Create at least one category first, then return here to add transactions.
              <div className="mt-3">
                <Link href="/categories" className="text-amber-200 underline underline-offset-4 hover:text-amber-100">
                  Go to Categories
                </Link>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm text-slate-300">Type</span>
              <select
                value={formState.type}
                onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value as TransactionType }))}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-slate-300">Amount</span>
              <input
                value={formState.amount}
                onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))}
                type="number"
                min="0.01"
                step="0.01"
                required
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="0.00"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-slate-300">Description</span>
              <input
                value={formState.description}
                onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                type="text"
                maxLength={200}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="Groceries, salary, transport..."
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-slate-300">Merchant</span>
              <input
                value={formState.merchant}
                onChange={(event) => setFormState((current) => ({ ...current, merchant: event.target.value }))}
                type="text"
                maxLength={120}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="Store or employer"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-slate-300">Category</span>
              <select
                value={formState.categoryId}
                onChange={(event) => setFormState((current) => ({ ...current, categoryId: event.target.value }))}
                required
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                <option value="" disabled>
                  Select a category
                </option>
                {sortedCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-slate-300">Date and time</span>
              <input
                value={formState.occurredAt}
                onChange={(event) => setFormState((current) => ({ ...current, occurredAt: event.target.value }))}
                type="datetime-local"
                required
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || !categories.length}
            className="mt-6 w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : editingTransactionId ? "Update transaction" : "Add transaction"}
          </button>
        </form>

        <div className="space-y-4">
          <div className="glass-panel flex flex-col gap-4 rounded-3xl px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Ledger</p>
              <p className="mt-1 text-white">{transactions.length} transaction{transactions.length === 1 ? "" : "s"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="grid gap-2">
                <span className="sr-only">Filter by category</span>
                <select
                  value={selectedCategoryId}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none transition focus:border-emerald-400"
                >
                  <option value="">All categories</option>
                  {sortedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleReload()}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="glass-panel overflow-hidden rounded-3xl">
            {transactions.length === 0 ? (
              <div className="p-8 text-slate-300">
                No transactions yet. Add the first income or expense to start building your ledger.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {transactions.map((transaction) => (
                  <article key={transaction.id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-300">
                          {transaction.category.name}
                        </span>
                        <p className="truncate font-semibold text-white">
                          {transaction.description || transaction.merchant || "Untitled transaction"}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{formatDateTime(transaction.occurredAt)}</p>
                    </div>

                    <div className="flex items-center gap-4 md:justify-end">
                      <div className="text-right">
                        <p
                          className={`font-display text-2xl font-semibold ${
                            transaction.type === "INCOME" ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {formatCurrency(transaction.amount, transaction.type)}
                        </p>
                        <p className="text-sm uppercase tracking-[0.16em] text-slate-400">
                          {transaction.type.toLowerCase()}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => beginEdit(transaction)}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(transaction.id)}
                          className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}