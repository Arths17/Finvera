import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-emerald-300">
            Finvera Foundation
          </span>
          <div className="space-y-4">
            <h1 className="font-display text-5xl font-semibold tracking-tight text-white md:text-7xl">
              Personal finance, designed to scale with real data.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Authentication, user isolation, and the database primitives are in place so
              transactions, budgets, charts, and AI insights can all build on a stable backend.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/register"
              className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/12 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 md:p-8">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Foundation</p>
              <p className="mt-2 text-lg font-semibold text-white">Next.js + Prisma + NextAuth</p>
              <p className="mt-1 text-sm text-slate-300">Single source of truth for users and finance data.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["User isolation", "Every record is scoped by userId"],
                ["Budgets", "Category-based budget tracking"],
                ["Transactions", "Income and expense tracking"],
                ["AI-ready", "Data model prepared for insights"]
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}