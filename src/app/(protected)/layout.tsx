import Link from "next/link";
import { redirect } from "next/navigation";

import SignOutButton from "@/components/auth/sign-out-button";
import { auth } from "@/lib/auth";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen px-6 py-6 md:px-8">
      <header className="glass-panel mx-auto flex max-w-7xl items-center justify-between rounded-3xl px-5 py-4">
        <div>
          <p className="font-display text-2xl font-semibold text-white">Finvera</p>
          <p className="text-sm text-slate-400">A calmer view of your money.</p>
        </div>
        <nav className="flex items-center gap-3">
          <Link className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10" href="/dashboard">
            Dashboard
          </Link>
          <Link className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10" href="/transactions">
            Transactions
          </Link>
          <Link className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10" href="/categories">
            Categories
          </Link>
          <Link className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10" href="/budgets">
            Budgets
          </Link>
          <SignOutButton />
        </nav>
      </header>
      <main className="mx-auto max-w-7xl py-8">{children}</main>
    </div>
  );
}