import { NextResponse } from "next/server";

import { buildFinancialSnapshot } from "@/lib/financial-snapshot";
import { buildFinancialSignals } from "@/lib/financial-signals";
import { buildFinancialSignalMemory } from "@/lib/financial-signal-memory";
import { resolveSignalDominance } from "@/lib/signal-dominance";

type ScenarioResult = {
  name: string;
  months: Array<{
    month: number;
    year: number;
    snapshot: ReturnType<typeof buildFinancialSnapshot>;
    signals: ReturnType<typeof buildFinancialSignals>;
    surface: ReturnType<typeof resolveSignalDominance>;
    dominantKeys: string[];
  }>;
  stability: {
    meanJaccard: number;
    volatilityMonths: number;
    confidenceMeans: number[];
  };
};

function getClusterKeyFromSignal(signal: any) {
  return [signal.type, signal.context?.category ?? "", signal.context?.merchant ?? ""].join("|");
}

function jaccard(a: string[], b: string[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const uni = new Set([...sa, ...sb]).size || 1;
  return inter / uni;
}

function buildScenario(name: string, months: number, generator: (i: number) => ReturnType<typeof buildFinancialSnapshot>): ScenarioResult {
  const periods: { month: number; year: number; snapshot: ReturnType<typeof buildFinancialSnapshot>; signals: ReturnType<typeof buildFinancialSignals> }[] = [];

  for (let i = 0; i < months; i++) {
    const month = (i % 12) + 1;
    const year = 2026 + Math.floor(i / 12);
    const snapshot = generator(i);
    const signals = buildFinancialSignals(snapshot);

    periods.push({ month, year, snapshot, signals });
  }

  const monthSummaries: ScenarioResult["months"] = [];

  for (let i = 0; i < periods.length; i++) {
    const history = periods.slice(0, i + 1).map((p) => ({ month: p.month, year: p.year, signals: p.signals }));
    const memory = buildFinancialSignalMemory(history);
    const current = periods[i];
    const surface = resolveSignalDominance(current.signals, memory.current);

    const dominantKeys = surface.dominant.map(getClusterKeyFromSignal);

    monthSummaries.push({
      month: current.month,
      year: current.year,
      snapshot: current.snapshot,
      signals: current.signals,
      surface,
      dominantKeys
    });
  }

  const jaccards: number[] = [];
  for (let i = 1; i < monthSummaries.length; i++) {
    jaccards.push(jaccard(monthSummaries[i - 1].dominantKeys, monthSummaries[i].dominantKeys));
  }

  const meanJaccard = jaccards.length === 0 ? 1 : jaccards.reduce((s, v) => s + v, 0) / jaccards.length;
  const volatilityMonths = jaccards.filter((v) => v < 0.25).length;
  const confidenceMeans = monthSummaries.map((m) => m.surface.confidenceDistribution.overall);

  return {
    name,
    months: monthSummaries,
    stability: {
      meanJaccard,
      volatilityMonths,
      confidenceMeans
    }
  };
}

export async function GET() {
  const months = 6;

  const baseline = buildScenario("baseline-stable", months, () =>
    buildFinancialSnapshot({ income: 5000, expenses: 3800, budgetUtilizationMax: 0.3, categoryConcentration: 0.2 })
  );

  const noisySpikes = buildScenario("noisy-spikes", months, (i) => {
    const spike = Math.random() < 0.25 ? 800 + Math.round(Math.random() * 1200) : 0;
    const expenses = 3800 + spike + Math.round((Math.random() - 0.5) * 300);
    return buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: Math.min(0.9, 0.3 + spike / 5000), categoryConcentration: 0.2 + Math.random() * 0.2 });
  });

  const upwardTrend = buildScenario("upward-spending", months, (i) => {
    const expenses = 3600 + i * 200 + Math.round((Math.random() - 0.5) * 150);
    return buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: Math.min(0.95, 0.25 + (i * 0.12)), categoryConcentration: 0.25 + (i * 0.03) });
  });

  const alternatingShock = buildScenario("alternating-shock", months, (i) => {
    const expenses = i % 2 === 0 ? 3600 : 4600 + Math.round(Math.random() * 400);
    return buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: i % 2 === 0 ? 0.28 : 0.72, categoryConcentration: 0.18 + (i % 2 === 0 ? 0 : 0.35) });
  });

  const scenarios = [baseline, noisySpikes, upwardTrend, alternatingShock];

  return NextResponse.json({ scenarios });
}
