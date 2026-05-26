export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
      <div className="grid w-full gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <section className="space-y-6">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-emerald-300">
            Finvera Secure Access
          </span>
          <div className="space-y-4">
            <h1 className="font-display text-5xl font-semibold tracking-tight text-white md:text-7xl">
              Control the money layer before the dashboard layer.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Authentication is the foundation for user-scoped transactions, budgets, and AI
              features. This shell keeps the sign-in experience focused and production-ready.
            </p>
          </div>
        </section>

        <div className="glass-panel rounded-3xl p-6 md:p-8">{children}</div>
      </div>
    </main>
  );
}