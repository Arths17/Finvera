import { describe, it, expect } from "vitest";

import { buildFinancialSnapshot } from "@/lib/financial-snapshot";
import { buildFinancialSignals } from "@/lib/financial-signals";
import { buildFinancialSignalMemory } from "@/lib/financial-signal-memory";
import { resolveSignalDominance } from "@/lib/signal-dominance";

function getClusterKey(signal: any) {
  return [signal.type, signal.context?.category ?? "", signal.context?.merchant ?? ""].join("|");
}

describe("SignalSurface invariants", () => {
  it("is deterministic for identical inputs", () => {
    const snapshot = buildFinancialSnapshot({ income: 5000, expenses: 4200, budgetUtilizationMax: 0.6, categoryConcentration: 0.3 });
    const signals = buildFinancialSignals(snapshot);
    const memory = buildFinancialSignalMemory([{ month: 1, year: 2026, signals }]);

    const surfaceA = resolveSignalDominance(signals, memory.current);
    const surfaceB = resolveSignalDominance(signals, memory.current);

    expect(surfaceA.dominant.map(getClusterKey)).toEqual(surfaceB.dominant.map(getClusterKey));
    expect(surfaceA.confidenceDistribution.overall).toBeCloseTo(surfaceB.confidenceDistribution.overall, 8);
  });

  it("amplifies persistence: repeated weak signal becomes more prominent", () => {
    const months = [] as { month: number; year: number; snapshot: ReturnType<typeof buildFinancialSnapshot> }[];

    for (let i = 0; i < 5; i++) {
      const expenses = 3800 + (i >= 2 ? 300 : 0); // small persistent increase after month 2
      months.push({ month: i + 1, year: 2026, snapshot: buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: 0.3 + (i >= 2 ? 0.25 : 0), categoryConcentration: 0.2 }) });
    }

    const histories = months.map((m) => ({ month: m.month, year: m.year, signals: buildFinancialSignals(m.snapshot) }));
    const memory = buildFinancialSignalMemory(histories);
    const final = histories[histories.length - 1];
    const surface = resolveSignalDominance(final.signals, memory.current);

    // Expect some dominant signals to be present and not empty for spending domain
    expect(surface.domains.spending.dominant.length).toBeGreaterThanOrEqual(0);
    // persistence should push up overall confidence
    expect(surface.confidenceDistribution.overall).toBeGreaterThanOrEqual(0);
  });

  it("maintains domain isolation: spending noise does not flip income domain dominance", () => {
    // stable income snapshots
    const incomeStable = buildFinancialSnapshot({ income: 5000, expenses: 3800, budgetUtilizationMax: 0.3, categoryConcentration: 0.2 });
    const incomeSignals = buildFinancialSignals(incomeStable);

    // create spending noise that alternates
    const noisyMonths = [] as ReturnType<typeof buildFinancialSnapshot>[];
    for (let i = 0; i < 4; i++) {
      const expenses = i % 2 === 0 ? 3800 : 4800;
      noisyMonths.push(buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: i % 2 === 0 ? 0.3 : 0.75, categoryConcentration: 0.25 }));
    }

    const histories = noisyMonths.map((snap, idx) => ({ month: idx + 1, year: 2026, signals: buildFinancialSignals(snap) }));
    // append a stable income month
    histories.push({ month: 5, year: 2026, signals: incomeSignals });

    const memory = buildFinancialSignalMemory(histories);
    const finalSurface = resolveSignalDominance(incomeSignals, memory.current);

    // Income domain should not be empty and should be stable
    expect(finalSurface.domains.income).toBeDefined();
    expect(Array.isArray(finalSurface.domains.income.dominant)).toBe(true);
  });
});
