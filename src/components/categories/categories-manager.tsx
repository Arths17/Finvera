"use client";

import { FormEvent, useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  transactionCount: number;
  budgetCount: number;
};

type CategoriesManagerProps = {
  initialCategories: Category[];
};

type CategoryFormState = {
  name: string;
};

const emptyFormState: CategoryFormState = {
  name: ""
};

export default function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [formState, setFormState] = useState<CategoryFormState>(emptyFormState);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  function sortCategories(items: Category[]) {
    return [...items].sort((left, right) => left.name.localeCompare(right.name));
  }

  function resetForm() {
    setFormState(emptyFormState);
    setEditingCategoryId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const payload = {
      name: formState.name.trim()
    };

    const response = await fetch(
      editingCategoryId ? `/api/categories/${editingCategoryId}` : "/api/categories",
      {
        method: editingCategoryId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to save category");
      return;
    }

    const data = (await response.json()) as { category: Category };

    if (editingCategoryId) {
      setCategories((current) =>
        sortCategories(current.map((category) => (category.id === editingCategoryId ? data.category : category)))
      );
    } else {
      setCategories((current) => sortCategories([data.category, ...current]));
    }

    setSuccess(editingCategoryId ? "Category updated." : "Category created.");
    resetForm();
  }

  function beginEdit(category: Category) {
    setEditingCategoryId(category.id);
    setFormState({ name: category.name });
    setError(null);
    setSuccess(null);
  }

  async function handleDelete(category: Category) {
    const confirmed = window.confirm(`Delete ${category.name}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/categories/${category.id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to delete category");
      return;
    }

    setCategories((current) => sortCategories(current.filter((item) => item.id !== category.id)));
    setSuccess("Category deleted.");

    if (editingCategoryId === category.id) {
      resetForm();
    }
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Categories</p>
        <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Organize your spending</h1>
        <p className="max-w-3xl text-slate-300">
          Create and manage the categories that power transaction tracking and budget planning. Everything stays local and user-scoped.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form className="glass-panel rounded-3xl p-6" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                {editingCategoryId ? "Edit category" : "New category"}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                {editingCategoryId ? "Update category" : "Create category"}
              </h2>
            </div>
            {editingCategoryId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <label className="mt-6 grid gap-2">
            <span className="text-sm text-slate-300">Name</span>
            <input
              value={formState.name}
              onChange={(event) => setFormState({ name: event.target.value })}
              type="text"
              required
              maxLength={80}
              className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
              placeholder="Groceries, Rent, Salary..."
            />
          </label>

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : editingCategoryId ? "Update category" : "Add category"}
          </button>
        </form>

        <div className="space-y-4">
          <div className="glass-panel flex items-center justify-between rounded-3xl px-6 py-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Library</p>
              <p className="mt-1 text-white">{categories.length} categor{categories.length === 1 ? "y" : "ies"}</p>
            </div>
            <p className="text-sm text-slate-400">Used in transactions and budgets</p>
          </div>

          <div className="grid gap-4">
            {categories.length === 0 ? (
              <div className="glass-panel rounded-3xl p-8 text-slate-300">
                No categories yet. Add your first category to start tracking transactions.
              </div>
            ) : (
              categories.map((category) => {
                const isLocked = category.transactionCount > 0 || category.budgetCount > 0;

                return (
                  <article key={category.id} className="glass-panel rounded-3xl p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Category</p>
                        <h2 className="mt-2 font-display text-2xl font-semibold text-white">{category.name}</h2>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                        {category.transactionCount} tx
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                      <span>{category.budgetCount} budget{category.budgetCount === 1 ? "" : "s"}</span>
                      {isLocked ? <span>Delete locked until linked records are removed</span> : <span>Ready to delete</span>}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(category)}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(category)}
                        disabled={isLocked}
                        className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}